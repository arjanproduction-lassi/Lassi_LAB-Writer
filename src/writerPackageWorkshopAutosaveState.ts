export type WriterPackageWorkshopAutosaveFailureStage =
  | "blocked"
  | "current-read"
  | "serialize"
  | "write"
  | "read-back"
  | "verify";

export type WriterPackageWorkshopAutosaveFailureFacts = Readonly<{
  stage: WriterPackageWorkshopAutosaveFailureStage;
  writeAttempted: boolean;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  storageState: "not-written" | "previous-verified" | "unknown";
}>;

type EditableStateBase = Readonly<{
  localRevision: number;
  baseUpdatedAt: string;
}>;

export type WriterPackageWorkshopAutosaveState =
  | Readonly<{ status: "read-only" }>
  | (EditableStateBase & Readonly<{ status: "clean" }>)
  | (EditableStateBase & Readonly<{ status: "dirty" }>)
  | (EditableStateBase &
      Readonly<{
        status: "saving";
        saveRevision: number;
        saveBaseUpdatedAt: string;
      }>)
  | (EditableStateBase & Readonly<{ status: "saved" }>)
  | (EditableStateBase &
      Readonly<{
        status: "conflict";
        currentStoredUpdatedAt: string;
      }>)
  | (EditableStateBase &
      Readonly<{
        status: "failed-safe";
        failure: WriterPackageWorkshopAutosaveFailureFacts;
      }>)
  | (EditableStateBase &
      Readonly<{
        status: "failed-unsafe";
        failure: WriterPackageWorkshopAutosaveFailureFacts;
      }>);

export type CreateWriterPackageWorkshopAutosaveStateInput =
  | Readonly<{ editable: false }>
  | Readonly<{ editable: true; baseUpdatedAt: string }>;

export type WriterPackageWorkshopAutosaveEvent =
  | Readonly<{ type: "edited" }>
  | Readonly<{ type: "save-requested" }>
  | Readonly<{ type: "retry-requested" }>
  | Readonly<{
      type: "save-succeeded";
      saveRevision: number;
      previousUpdatedAt: string;
      nextUpdatedAt: string;
    }>
  | Readonly<{
      type: "save-unchanged";
      saveRevision: number;
      currentUpdatedAt: string;
    }>
  | Readonly<{
      type: "save-conflicted";
      saveRevision: number;
      currentUpdatedAt: string;
    }>
  | Readonly<{
      type: "save-failed";
      saveRevision: number;
      failure: WriterPackageWorkshopAutosaveFailureFacts;
    }>;

export type WriterPackageWorkshopAutosaveSaveCommand = Readonly<{
  type: "persist-workshop";
  localRevision: number;
  expectedUpdatedAt: string;
}>;

export type WriterPackageWorkshopAutosaveRejectionReason =
  | "read-only"
  | "revision-overflow"
  | "not-dirty"
  | "save-in-progress"
  | "retry-required"
  | "retry-not-available"
  | "no-matching-save"
  | "invalid-save-result";

export type WriterPackageWorkshopAutosaveTransitionResult =
  | Readonly<{
      accepted: true;
      state: WriterPackageWorkshopAutosaveState;
      command?: WriterPackageWorkshopAutosaveSaveCommand;
    }>
  | Readonly<{
      accepted: false;
      state: WriterPackageWorkshopAutosaveState;
      reason: WriterPackageWorkshopAutosaveRejectionReason;
    }>;

export type WriterPackageWorkshopExitAction =
  | "package-switch"
  | "layer-switch"
  | "library-return"
  | "reset"
  | "unload";

export type WriterPackageWorkshopExitDecision = Readonly<{
  action: WriterPackageWorkshopExitAction;
  allowed: boolean;
  requiresConfirmation: boolean;
}>;

function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isCanonicalLaterTimestamp(next: string, previous: string): boolean {
  if (!isValidDateString(next) || !isValidDateString(previous)) {
    return false;
  }

  const nextMs = Date.parse(next);
  const previousMs = Date.parse(previous);
  return nextMs > previousMs && new Date(nextMs).toISOString() === next;
}

function freezeFailureFacts(
  failure: WriterPackageWorkshopAutosaveFailureFacts
): WriterPackageWorkshopAutosaveFailureFacts {
  return Object.freeze({ ...failure });
}

function hasConsistentFailureFacts(
  failure: WriterPackageWorkshopAutosaveFailureFacts
): boolean {
  if (failure.rollbackSucceeded && !failure.rollbackAttempted) {
    return false;
  }

  if (
    failure.rollbackSucceeded &&
    failure.storageState !== "previous-verified"
  ) {
    return false;
  }

  if (failure.storageState === "not-written") {
    return (
      !failure.writeAttempted &&
      !failure.rollbackAttempted &&
      !failure.rollbackSucceeded
    );
  }

  return failure.writeAttempted;
}

function accepted(
  state: WriterPackageWorkshopAutosaveState,
  command?: WriterPackageWorkshopAutosaveSaveCommand
): WriterPackageWorkshopAutosaveTransitionResult {
  return Object.freeze({
    accepted: true as const,
    state,
    ...(command ? { command } : {})
  });
}

function rejected(
  state: WriterPackageWorkshopAutosaveState,
  reason: WriterPackageWorkshopAutosaveRejectionReason
): WriterPackageWorkshopAutosaveTransitionResult {
  return Object.freeze({ accepted: false as const, state, reason });
}

function createSaveTransition(
  state: Extract<
    WriterPackageWorkshopAutosaveState,
    { status: "dirty" | "failed-safe" }
  >
): WriterPackageWorkshopAutosaveTransitionResult {
  const command = Object.freeze({
    type: "persist-workshop" as const,
    localRevision: state.localRevision,
    expectedUpdatedAt: state.baseUpdatedAt
  });
  return accepted(
    Object.freeze({
      status: "saving" as const,
      localRevision: state.localRevision,
      baseUpdatedAt: state.baseUpdatedAt,
      saveRevision: state.localRevision,
      saveBaseUpdatedAt: state.baseUpdatedAt
    }),
    command
  );
}

function incrementRevision(
  state: Exclude<WriterPackageWorkshopAutosaveState, { status: "read-only" }>
): number | undefined {
  if (!Number.isSafeInteger(state.localRevision) || state.localRevision < 0) {
    return undefined;
  }
  const next = state.localRevision + 1;
  return Number.isSafeInteger(next) ? next : undefined;
}

function applyEdit(
  state: WriterPackageWorkshopAutosaveState
): WriterPackageWorkshopAutosaveTransitionResult {
  if (state.status === "read-only") {
    return rejected(state, "read-only");
  }

  const localRevision = incrementRevision(state);
  if (localRevision === undefined) {
    return rejected(state, "revision-overflow");
  }

  switch (state.status) {
    case "clean":
    case "dirty":
    case "saved":
      return accepted(
        Object.freeze({
          status: "dirty" as const,
          localRevision,
          baseUpdatedAt: state.baseUpdatedAt
        })
      );
    case "saving":
      return accepted(
        Object.freeze({
          ...state,
          localRevision
        })
      );
    case "conflict":
      return accepted(
        Object.freeze({
          ...state,
          localRevision
        })
      );
    case "failed-safe":
    case "failed-unsafe":
      return accepted(
        Object.freeze({
          ...state,
          localRevision,
          failure: freezeFailureFacts(state.failure)
        })
      );
  }
}

function matchingSavingState(
  state: WriterPackageWorkshopAutosaveState,
  saveRevision: number
): Extract<WriterPackageWorkshopAutosaveState, { status: "saving" }> | undefined {
  return state.status === "saving" && state.saveRevision === saveRevision
    ? state
    : undefined;
}

function afterCompletedSave(
  state: Extract<WriterPackageWorkshopAutosaveState, { status: "saving" }>,
  baseUpdatedAt: string
): WriterPackageWorkshopAutosaveState {
  return state.localRevision === state.saveRevision
    ? Object.freeze({
        status: "saved" as const,
        localRevision: state.localRevision,
        baseUpdatedAt
      })
    : Object.freeze({
        status: "dirty" as const,
        localRevision: state.localRevision,
        baseUpdatedAt
      });
}

export function createWriterPackageWorkshopAutosaveState(
  input: CreateWriterPackageWorkshopAutosaveStateInput
): WriterPackageWorkshopAutosaveState {
  if (!input.editable || !isValidDateString(input.baseUpdatedAt)) {
    return Object.freeze({ status: "read-only" as const });
  }

  return Object.freeze({
    status: "clean" as const,
    localRevision: 0,
    baseUpdatedAt: input.baseUpdatedAt
  });
}

export function applyWriterPackageWorkshopAutosaveEvent(
  state: WriterPackageWorkshopAutosaveState,
  event: WriterPackageWorkshopAutosaveEvent
): WriterPackageWorkshopAutosaveTransitionResult {
  if (event.type === "edited") {
    return applyEdit(state);
  }

  if (event.type === "save-requested") {
    if (state.status === "dirty") {
      return createSaveTransition(state);
    }
    if (state.status === "saving") {
      return rejected(state, "save-in-progress");
    }
    if (state.status === "failed-safe") {
      return rejected(state, "retry-required");
    }
    return rejected(state, state.status === "read-only" ? "read-only" : "not-dirty");
  }

  if (event.type === "retry-requested") {
    return state.status === "failed-safe"
      ? createSaveTransition(state)
      : rejected(state, "retry-not-available");
  }

  const saving = matchingSavingState(state, event.saveRevision);
  if (!saving) {
    return rejected(state, "no-matching-save");
  }

  switch (event.type) {
    case "save-succeeded":
      if (
        event.previousUpdatedAt !== saving.saveBaseUpdatedAt ||
        !isCanonicalLaterTimestamp(
          event.nextUpdatedAt,
          saving.saveBaseUpdatedAt
        )
      ) {
        return rejected(state, "invalid-save-result");
      }
      return accepted(afterCompletedSave(saving, event.nextUpdatedAt));

    case "save-unchanged":
      if (event.currentUpdatedAt !== saving.saveBaseUpdatedAt) {
        return rejected(state, "invalid-save-result");
      }
      return accepted(afterCompletedSave(saving, saving.saveBaseUpdatedAt));

    case "save-conflicted":
      if (
        !isValidDateString(event.currentUpdatedAt) ||
        event.currentUpdatedAt === saving.saveBaseUpdatedAt
      ) {
        return rejected(state, "invalid-save-result");
      }
      return accepted(
        Object.freeze({
          status: "conflict" as const,
          localRevision: saving.localRevision,
          baseUpdatedAt: saving.baseUpdatedAt,
          currentStoredUpdatedAt: event.currentUpdatedAt
        })
      );

    case "save-failed": {
      if (!hasConsistentFailureFacts(event.failure)) {
        return rejected(state, "invalid-save-result");
      }
      const failure = freezeFailureFacts(event.failure);
      return accepted(
        Object.freeze({
          status:
            failure.storageState === "unknown"
              ? ("failed-unsafe" as const)
              : ("failed-safe" as const),
          localRevision: saving.localRevision,
          baseUpdatedAt: saving.baseUpdatedAt,
          failure
        })
      );
    }
  }
}

export function writerPackageWorkshopHasUnsavedDraft(
  state: WriterPackageWorkshopAutosaveState
): boolean {
  return (
    state.status === "dirty" ||
    state.status === "saving" ||
    state.status === "conflict" ||
    state.status === "failed-safe" ||
    state.status === "failed-unsafe"
  );
}

export function inspectWriterPackageWorkshopExit(
  state: WriterPackageWorkshopAutosaveState,
  action: WriterPackageWorkshopExitAction,
  confirmed = false
): WriterPackageWorkshopExitDecision {
  const hasUnsavedDraft = writerPackageWorkshopHasUnsavedDraft(state);
  return Object.freeze({
    action,
    allowed: !hasUnsavedDraft || confirmed,
    requiresConfirmation: hasUnsavedDraft && !confirmed
  });
}
