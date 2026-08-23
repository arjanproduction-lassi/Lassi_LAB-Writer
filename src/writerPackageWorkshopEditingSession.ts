import type { WriterPackage } from "./types";
import {
  cloneAndFreezeWriterPackageCollection,
  validateWriterPackageCollectionCompatibility
} from "./writerPackageCollectionCodec";
import {
  applyWriterPackageWorkshopPersistenceResult,
  type WriterPackageWorkshopAutosaveRefresh
} from "./writerPackageWorkshopAutosaveBridge";
import {
  applyWriterPackageWorkshopAutosaveEvent,
  createWriterPackageWorkshopAutosaveState,
  inspectWriterPackageWorkshopExit,
  type WriterPackageWorkshopAutosaveRejectionReason,
  type WriterPackageWorkshopAutosaveState,
  type WriterPackageWorkshopExitAction,
  type WriterPackageWorkshopExitDecision
} from "./writerPackageWorkshopAutosaveState";
import type {
  WriterPackageWorkshopPersistenceBlockedReason,
  WriterPackageWorkshopPersistenceResult
} from "./writerPackageWorkshopPersistence";

export type WriterPackageWorkshopInspectionBlockedReason =
  | "inspection-failed"
  | "invalid-package"
  | "package-not-found"
  | "package-deleted"
  | "stale-revision";

export type WriterPackageWorkshopEditableInspection =
  | Readonly<{
      status: "editable";
      package: Readonly<WriterPackage>;
    }>
  | Readonly<{
      status: "blocked";
      reason: WriterPackageWorkshopInspectionBlockedReason;
    }>;

export type WriterPackageWorkshopSessionReadOnlyReason =
  | "write-ownership-unavailable"
  | WriterPackageWorkshopInspectionBlockedReason;

export type WriterPackageWorkshopSessionIssue =
  | "write-ownership-lost"
  | "time-unavailable"
  | "persistence-threw"
  | "invalid-persistence-result";

export type WriterPackageWorkshopSessionPersistenceInput = Readonly<{
  packageId: string;
  expectedUpdatedAt: string;
  workshopText: string;
  now: string;
}>;

export type WriterPackageWorkshopEditingSessionDependencies = Readonly<{
  inspectEditablePackage: (input: Readonly<{
    packageId: string;
    expectedUpdatedAt: string;
  }>) => WriterPackageWorkshopEditableInspection;
  hasWriteOwnership: () => boolean;
  releaseWriteOwnership: () => void;
  persistWorkshopEdit: (
    input: WriterPackageWorkshopSessionPersistenceInput
  ) => WriterPackageWorkshopPersistenceResult;
  now: () => string;
}>;

export type WriterPackageWorkshopEditingSessionInput = Readonly<{
  packageId: string;
  expectedUpdatedAt: string;
  dependencies: WriterPackageWorkshopEditingSessionDependencies;
}>;

export type WriterPackageWorkshopEditingSessionView =
  | Readonly<{
      status: "read-only";
      reason: WriterPackageWorkshopSessionReadOnlyReason;
    }>
  | Readonly<{
      status: "editable";
      workshopText: string;
      autosaveState: WriterPackageWorkshopAutosaveState;
      refresh: WriterPackageWorkshopAutosaveRefresh;
      canSave: boolean;
      canRetry: boolean;
      writeOwnershipActive: boolean;
      blockedReason?: WriterPackageWorkshopPersistenceBlockedReason;
      issue?: WriterPackageWorkshopSessionIssue;
    }>
  | Readonly<{
      status: "closed";
    }>;

export type WriterPackageWorkshopSessionActionReason =
  | "read-only"
  | "closed"
  | WriterPackageWorkshopAutosaveRejectionReason;

export type WriterPackageWorkshopSessionActionResult = Readonly<{
  accepted: boolean;
  view: WriterPackageWorkshopEditingSessionView;
  reason?: WriterPackageWorkshopSessionActionReason;
}>;

export type WriterPackageWorkshopSessionExitResult = Readonly<{
  decision: WriterPackageWorkshopExitDecision;
  view: WriterPackageWorkshopEditingSessionView;
}>;

export type WriterPackageWorkshopEditingSession = Readonly<{
  getViewModel: () => WriterPackageWorkshopEditingSessionView;
  editWorkshopText: (workshopText: string) => WriterPackageWorkshopSessionActionResult;
  requestAutosave: () => WriterPackageWorkshopSessionActionResult;
  retryAutosave: () => WriterPackageWorkshopSessionActionResult;
  requestExit: (
    action: WriterPackageWorkshopExitAction,
    confirmed?: boolean
  ) => WriterPackageWorkshopSessionExitResult;
}>;

function cloneFreshPackage(
  writerPackage: Readonly<WriterPackage>,
  packageId: string,
  expectedUpdatedAt: string
):
  | Readonly<{ ok: true; package: Readonly<WriterPackage> }>
  | Readonly<{ ok: false; reason: WriterPackageWorkshopInspectionBlockedReason }> {
  const validation = validateWriterPackageCollectionCompatibility([writerPackage]);
  if (!validation.ok) {
    return Object.freeze({ ok: false as const, reason: "invalid-package" as const });
  }
  if (writerPackage.id !== packageId) {
    return Object.freeze({ ok: false as const, reason: "package-not-found" as const });
  }
  if (writerPackage.deletedAt !== undefined) {
    return Object.freeze({ ok: false as const, reason: "package-deleted" as const });
  }
  if (writerPackage.updatedAt !== expectedUpdatedAt) {
    return Object.freeze({ ok: false as const, reason: "stale-revision" as const });
  }
  const [detached] = cloneAndFreezeWriterPackageCollection([writerPackage]);
  return Object.freeze({ ok: true as const, package: detached });
}

function isTerminalExit(action: WriterPackageWorkshopExitAction): boolean {
  return action !== "layer-switch";
}

export function createWriterPackageWorkshopEditingSession({
  packageId,
  expectedUpdatedAt,
  dependencies
}: WriterPackageWorkshopEditingSessionInput): WriterPackageWorkshopEditingSession {
  let ownershipActive = false;
  let ownershipReleased = false;
  let closed = false;
  let readOnlyReason: WriterPackageWorkshopSessionReadOnlyReason | undefined;
  let writerPackage: Readonly<WriterPackage> | undefined;
  let workshopText = "";
  let autosaveState: WriterPackageWorkshopAutosaveState = Object.freeze({
    status: "read-only" as const
  });
  let refresh: WriterPackageWorkshopAutosaveRefresh = "none";
  let blockedReason: WriterPackageWorkshopPersistenceBlockedReason | undefined;
  let issue: WriterPackageWorkshopSessionIssue | undefined;

  function releaseOwnership() {
    if (!ownershipActive || ownershipReleased) {
      return;
    }
    ownershipReleased = true;
    ownershipActive = false;
    try {
      dependencies.releaseWriteOwnership();
    } catch {
      // Ownership is treated as lost even when the injected release reports failure.
    }
  }

  function failReadOnly(reason: WriterPackageWorkshopSessionReadOnlyReason) {
    readOnlyReason = reason;
    releaseOwnership();
  }

  try {
    ownershipActive = dependencies.hasWriteOwnership();
  } catch {
    ownershipActive = false;
  }

  if (!ownershipActive) {
    failReadOnly("write-ownership-unavailable");
  } else {
    let inspection: WriterPackageWorkshopEditableInspection;
    try {
      inspection = dependencies.inspectEditablePackage({
        packageId,
        expectedUpdatedAt
      });
    } catch {
      inspection = Object.freeze({
        status: "blocked" as const,
        reason: "inspection-failed" as const
      });
    }

    if (inspection.status === "blocked") {
      failReadOnly(inspection.reason);
    } else {
      const fresh = cloneFreshPackage(
        inspection.package,
        packageId,
        expectedUpdatedAt
      );
      if (!fresh.ok) {
        failReadOnly(fresh.reason);
      } else {
        writerPackage = fresh.package;
        workshopText = fresh.package.workshopText;
        autosaveState = createWriterPackageWorkshopAutosaveState({
          editable: true,
          baseUpdatedAt: fresh.package.updatedAt
        });
      }
    }
  }

  function getViewModel(): WriterPackageWorkshopEditingSessionView {
    if (closed) {
      return Object.freeze({ status: "closed" as const });
    }
    if (!writerPackage || readOnlyReason) {
      return Object.freeze({
        status: "read-only" as const,
        reason: readOnlyReason ?? "inspection-failed"
      });
    }
    return Object.freeze({
      status: "editable" as const,
      workshopText,
      autosaveState,
      refresh,
      canSave: ownershipActive && autosaveState.status === "dirty",
      canRetry: ownershipActive && autosaveState.status === "failed-safe",
      writeOwnershipActive: ownershipActive,
      ...(blockedReason ? { blockedReason } : {}),
      ...(issue ? { issue } : {})
    });
  }

  function rejectedAction(
    reason: WriterPackageWorkshopSessionActionReason
  ): WriterPackageWorkshopSessionActionResult {
    return Object.freeze({ accepted: false, reason, view: getViewModel() });
  }

  function acceptedAction(): WriterPackageWorkshopSessionActionResult {
    return Object.freeze({ accepted: true, view: getViewModel() });
  }

  function applyFailure(
    saveRevision: number,
    failureIssue: WriterPackageWorkshopSessionIssue,
    unsafe: boolean
  ) {
    const transition = applyWriterPackageWorkshopAutosaveEvent(autosaveState, {
      type: "save-failed",
      saveRevision,
      failure: Object.freeze({
        stage: unsafe ? ("write" as const) : ("blocked" as const),
        writeAttempted: unsafe,
        rollbackAttempted: false,
        rollbackSucceeded: false,
        storageState: unsafe ? ("unknown" as const) : ("not-written" as const)
      })
    });
    if (transition.accepted) {
      autosaveState = transition.state;
    }
    refresh = "none";
    blockedReason = undefined;
    issue = failureIssue;
  }

  function hasValidRefreshPackage(
    result: Extract<WriterPackageWorkshopPersistenceResult, { status: "saved" | "unchanged" }>
  ): boolean {
    const expectedResultUpdatedAt =
      result.status === "saved" ? result.nextUpdatedAt : autosaveState.status === "saving"
        ? autosaveState.saveBaseUpdatedAt
        : "";
    const fresh = cloneFreshPackage(result.package, packageId, expectedResultUpdatedAt);
    return fresh.ok;
  }

  function runAutosave(
    requestType: "save-requested" | "retry-requested"
  ): WriterPackageWorkshopSessionActionResult {
    if (closed) {
      return rejectedAction("closed");
    }
    if (!writerPackage || readOnlyReason) {
      return rejectedAction("read-only");
    }

    const requested = applyWriterPackageWorkshopAutosaveEvent(autosaveState, {
      type: requestType
    });
    if (!requested.accepted || !requested.command) {
      return rejectedAction(
        requested.accepted ? "not-dirty" : requested.reason
      );
    }
    autosaveState = requested.state;
    refresh = "none";
    blockedReason = undefined;
    issue = undefined;

    let stillOwned = false;
    try {
      stillOwned = ownershipActive && dependencies.hasWriteOwnership();
    } catch {
      stillOwned = false;
    }
    if (!stillOwned) {
      ownershipActive = false;
      releaseOwnership();
      applyFailure(requested.command.localRevision, "write-ownership-lost", false);
      return acceptedAction();
    }

    let now: string;
    try {
      now = dependencies.now();
    } catch {
      applyFailure(requested.command.localRevision, "time-unavailable", false);
      return acceptedAction();
    }

    let persistenceResult: WriterPackageWorkshopPersistenceResult;
    try {
      persistenceResult = dependencies.persistWorkshopEdit({
        packageId,
        expectedUpdatedAt: requested.command.expectedUpdatedAt,
        workshopText,
        now
      });
    } catch {
      applyFailure(requested.command.localRevision, "persistence-threw", true);
      return acceptedAction();
    }

    if (
      (persistenceResult.status === "saved" ||
        persistenceResult.status === "unchanged") &&
      !hasValidRefreshPackage(persistenceResult)
    ) {
      applyFailure(
        requested.command.localRevision,
        "invalid-persistence-result",
        persistenceResult.status === "saved"
      );
      return acceptedAction();
    }

    const application = applyWriterPackageWorkshopPersistenceResult({
      state: autosaveState,
      saveRevision: requested.command.localRevision,
      result: persistenceResult
    });
    if (!application.transition.accepted) {
      applyFailure(
        requested.command.localRevision,
        "invalid-persistence-result",
        persistenceResult.status === "saved" ||
          (persistenceResult.status === "failed" &&
            persistenceResult.writeAttempted)
      );
      return acceptedAction();
    }

    autosaveState = application.transition.state;
    refresh = application.refresh;
    blockedReason = application.blockedReason;
    issue = undefined;
    if (
      application.refresh !== "none" &&
      (persistenceResult.status === "saved" ||
        persistenceResult.status === "unchanged")
    ) {
      const [updated] = cloneAndFreezeWriterPackageCollection([
        persistenceResult.package
      ]);
      writerPackage = updated;
    }
    return acceptedAction();
  }

  const session: WriterPackageWorkshopEditingSession = Object.freeze({
    getViewModel,
    editWorkshopText(nextWorkshopText) {
      if (closed) {
        return rejectedAction("closed");
      }
      if (!writerPackage || readOnlyReason) {
        return rejectedAction("read-only");
      }
      const transition = applyWriterPackageWorkshopAutosaveEvent(autosaveState, {
        type: "edited"
      });
      if (!transition.accepted) {
        return rejectedAction(transition.reason);
      }
      autosaveState = transition.state;
      workshopText = nextWorkshopText;
      refresh = "none";
      return acceptedAction();
    },
    requestAutosave() {
      return runAutosave("save-requested");
    },
    retryAutosave() {
      return runAutosave("retry-requested");
    },
    requestExit(action, confirmed = false) {
      const decision = inspectWriterPackageWorkshopExit(
        autosaveState,
        action,
        confirmed
      );
      if (decision.allowed && isTerminalExit(action)) {
        releaseOwnership();
        closed = true;
      }
      return Object.freeze({ decision, view: getViewModel() });
    }
  });

  return session;
}
