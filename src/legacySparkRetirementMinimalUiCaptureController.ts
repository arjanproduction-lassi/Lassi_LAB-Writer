import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";
import type {
  LegacySparkRetirementBackupGuideReason,
  LegacySparkRetirementBackupGuideStatus,
  LegacySparkRetirementBackupGuideTransitionReason
} from "./legacySparkRetirementBackupGuideState";
import type {
  LegacySparkRetirementLocalCaptureCommandReason,
  LegacySparkRetirementLocalCaptureNextAllowedStep,
  LegacySparkRetirementLocalCapturePublicState,
  LegacySparkRetirementLocalCaptureSession
} from "./legacySparkRetirementLocalCaptureSession";

export const LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL =
  "Pripraviť lokálnu zálohu" as const;

export type LegacySparkRetirementMinimalUiCaptureStatus =
  | "ready"
  | "preparing"
  | "snapshot-ready"
  | "incomplete"
  | "invalid"
  | "released";

export type LegacySparkRetirementMinimalUiCaptureUiCommandReason =
  | "UI_COMMAND_ALREADY_IN_PROGRESS"
  | "UI_CONTROLLER_RELEASED"
  | "UI_COMMAND_NOT_AVAILABLE";

export type LegacySparkRetirementMinimalUiCaptureReason =
  | LegacySparkRetirementLocalCaptureCommandReason
  | LegacySparkBackupVerificationReason
  | LegacySparkRetirementBackupGuideTransitionReason
  | LegacySparkRetirementMinimalUiCaptureUiCommandReason;

export type LegacySparkRetirementMinimalUiCaptureMessageKey =
  | "ready"
  | "preparing"
  | "snapshot-ready"
  | "incomplete"
  | "invalid"
  | "released"
  | "local-storage-unavailable"
  | "spark-storage-read-failed"
  | "package-storage-read-failed"
  | "draft-storage-read-failed"
  | "invalid-created-at"
  | "created-at-creation-failed"
  | "capture-dependency-failed"
  | "unfinished-draft-present"
  | "spark-storage-invalid"
  | "package-storage-invalid"
  | "draft-storage-invalid"
  | "capture-already-in-progress"
  | "capture-already-attempted"
  | "capture-session-released"
  | "guide-transition-rejected"
  | "invalid-transition"
  | "ui-command-already-in-progress"
  | "ui-controller-released"
  | "ui-command-not-available"
  | "safe-operation-blocked";

export type LegacySparkRetirementMinimalUiCaptureCounts = Readonly<{
  sparks: Readonly<{
    total: number;
    live: number;
    tombstones: number;
  }>;
  packages: Readonly<{
    total: number;
    live: number;
    tombstones: number;
  }>;
  notes: Readonly<{
    total: number;
    deleted: number;
  }>;
}>;

export type LegacySparkRetirementMinimalUiCaptureStorageStatuses = Readonly<{
  sparks: "missing" | "present" | null;
  packages: "missing" | "present" | null;
}>;

export type LegacySparkRetirementMinimalUiCaptureViewModel = Readonly<{
  status: LegacySparkRetirementMinimalUiCaptureStatus;
  guideStatus: LegacySparkRetirementBackupGuideStatus;
  primaryActionLabel: typeof LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL;
  primaryActionDisabled: boolean;
  showStartOver: boolean;
  showCancel: boolean;
  safeMessageKey: LegacySparkRetirementMinimalUiCaptureMessageKey;
  createdAt: string | null;
  counts: LegacySparkRetirementMinimalUiCaptureCounts | null;
  storageStatuses: LegacySparkRetirementMinimalUiCaptureStorageStatuses;
  reasonCodes: readonly LegacySparkRetirementMinimalUiCaptureReason[];
  nextAllowedStep: LegacySparkRetirementLocalCaptureNextAllowedStep;
}>;

export type LegacySparkRetirementMinimalUiCaptureCommandResult =
  | Readonly<{
      status: "handled";
      viewModel: LegacySparkRetirementMinimalUiCaptureViewModel;
    }>
  | Readonly<{
      status: "rejected";
      reason: LegacySparkRetirementMinimalUiCaptureUiCommandReason;
      messageKey: LegacySparkRetirementMinimalUiCaptureMessageKey;
      viewModel: LegacySparkRetirementMinimalUiCaptureViewModel;
    }>;

export type LegacySparkRetirementMinimalUiCaptureController = Readonly<{
  getViewModel: () => LegacySparkRetirementMinimalUiCaptureViewModel;
  prepareLocalBackup: () => LegacySparkRetirementMinimalUiCaptureCommandResult;
  startOver: () => LegacySparkRetirementMinimalUiCaptureCommandResult;
  dispose: () => LegacySparkRetirementMinimalUiCaptureCommandResult;
}>;

export type LegacySparkRetirementMinimalUiCaptureControllerDependencies = Readonly<{
  createSession: () => LegacySparkRetirementLocalCaptureSession;
}>;

function freezeReasons(
  reasons: readonly LegacySparkRetirementMinimalUiCaptureReason[]
): readonly LegacySparkRetirementMinimalUiCaptureReason[] {
  return Object.freeze([...new Set(reasons)]);
}

function freezeCounts(
  publicState: LegacySparkRetirementLocalCapturePublicState
): LegacySparkRetirementMinimalUiCaptureCounts | null {
  const summary = publicState.snapshotSummary;
  if (summary === null) return null;
  return Object.freeze({
    sparks: Object.freeze({
      total: summary.sparkCount,
      live: summary.sparkLiveCount,
      tombstones: summary.sparkTombstoneCount
    }),
    packages: Object.freeze({
      total: summary.packageCount,
      live: summary.packageLiveCount,
      tombstones: summary.packageTombstoneCount
    }),
    notes: Object.freeze({
      total: summary.noteCount,
      deleted: summary.deletedNoteCount
    })
  });
}

function freezeStorageStatuses(
  publicState: LegacySparkRetirementLocalCapturePublicState
): LegacySparkRetirementMinimalUiCaptureStorageStatuses {
  return Object.freeze({
    sparks: publicState.snapshotSummary?.sparkStorageStatus ?? null,
    packages: publicState.snapshotSummary?.packageStorageStatus ?? null
  });
}

function safeReasonsFromPublicState(
  publicState: LegacySparkRetirementLocalCapturePublicState,
  uiReasons: readonly LegacySparkRetirementMinimalUiCaptureUiCommandReason[]
): readonly LegacySparkRetirementMinimalUiCaptureReason[] {
  const guideReasons = publicState.guideState.metadata?.reasons ?? [];
  return freezeReasons([
    ...publicState.commandReasons,
    ...(guideReasons as readonly LegacySparkRetirementBackupGuideReason[]),
    ...uiReasons
  ]);
}

function statusFromPublicState(
  publicState: LegacySparkRetirementLocalCapturePublicState,
  commandActive: boolean,
  disposed: boolean
): LegacySparkRetirementMinimalUiCaptureStatus {
  if (disposed || publicState.isReleased) return "released";
  if (commandActive || publicState.isPreparing) return "preparing";
  if (
    publicState.nextAllowedStep === "provide-captured-snapshot-to-next-step" ||
    publicState.guideState.status === "drive-reading"
  ) {
    return "snapshot-ready";
  }
  if (publicState.guideState.status === "incomplete") return "incomplete";
  if (publicState.guideState.status === "invalid") return "invalid";
  return "ready";
}

function defaultMessageKeyForStatus(
  status: LegacySparkRetirementMinimalUiCaptureStatus
): LegacySparkRetirementMinimalUiCaptureMessageKey {
  switch (status) {
    case "ready":
      return "ready";
    case "preparing":
      return "preparing";
    case "snapshot-ready":
      return "snapshot-ready";
    case "incomplete":
      return "incomplete";
    case "invalid":
      return "invalid";
    case "released":
      return "released";
  }
}

export function legacySparkRetirementMinimalUiCaptureMessageKeyForReason(
  reason: LegacySparkRetirementMinimalUiCaptureReason
): LegacySparkRetirementMinimalUiCaptureMessageKey {
  switch (reason) {
    case "LOCAL_STORAGE_UNAVAILABLE":
      return "local-storage-unavailable";
    case "SPARK_STORAGE_READ_FAILED":
      return "spark-storage-read-failed";
    case "PACKAGE_STORAGE_READ_FAILED":
      return "package-storage-read-failed";
    case "DRAFT_STORAGE_READ_FAILED":
      return "draft-storage-read-failed";
    case "INVALID_CREATED_AT":
      return "invalid-created-at";
    case "CREATED_AT_CREATION_FAILED":
      return "created-at-creation-failed";
    case "CAPTURE_DEPENDENCY_FAILED":
      return "capture-dependency-failed";
    case "DRAFT_PRESENT":
      return "unfinished-draft-present";
    case "SPARK_STORAGE_PARSE_FAILED":
    case "SPARK_STORAGE_INVALID":
    case "DUPLICATE_SPARK_ID":
      return "spark-storage-invalid";
    case "PACKAGE_STORAGE_PARSE_FAILED":
    case "PACKAGE_STORAGE_INVALID":
    case "DUPLICATE_PACKAGE_ID":
      return "package-storage-invalid";
    case "DRAFT_STORAGE_PARSE_FAILED":
    case "DRAFT_STORAGE_INVALID":
      return "draft-storage-invalid";
    case "CAPTURE_ALREADY_IN_PROGRESS":
      return "capture-already-in-progress";
    case "CAPTURE_ALREADY_ATTEMPTED":
      return "capture-already-attempted";
    case "CAPTURE_SESSION_RELEASED":
      return "capture-session-released";
    case "GUIDE_TRANSITION_REJECTED":
      return "guide-transition-rejected";
    case "INVALID_TRANSITION":
      return "invalid-transition";
    case "UI_COMMAND_ALREADY_IN_PROGRESS":
      return "ui-command-already-in-progress";
    case "UI_CONTROLLER_RELEASED":
      return "ui-controller-released";
    case "UI_COMMAND_NOT_AVAILABLE":
      return "ui-command-not-available";
    default:
      return "safe-operation-blocked";
  }
}

function messageKeyForViewModel(
  status: LegacySparkRetirementMinimalUiCaptureStatus,
  reasons: readonly LegacySparkRetirementMinimalUiCaptureReason[]
): LegacySparkRetirementMinimalUiCaptureMessageKey {
  return reasons.length > 0
    ? legacySparkRetirementMinimalUiCaptureMessageKeyForReason(reasons[0])
    : defaultMessageKeyForStatus(status);
}

function freezeHandled(
  viewModel: LegacySparkRetirementMinimalUiCaptureViewModel
): LegacySparkRetirementMinimalUiCaptureCommandResult {
  return Object.freeze({ status: "handled" as const, viewModel });
}

function freezeRejected(
  reason: LegacySparkRetirementMinimalUiCaptureUiCommandReason,
  viewModel: LegacySparkRetirementMinimalUiCaptureViewModel
): LegacySparkRetirementMinimalUiCaptureCommandResult {
  return Object.freeze({
    status: "rejected" as const,
    reason,
    messageKey: viewModel.safeMessageKey,
    viewModel
  });
}

export function createLegacySparkRetirementMinimalUiCaptureController(
  dependencies: LegacySparkRetirementMinimalUiCaptureControllerDependencies
): LegacySparkRetirementMinimalUiCaptureController {
  let session: LegacySparkRetirementLocalCaptureSession | null = dependencies.createSession();
  let publicState = session.getPublicState();
  let commandActive = false;
  let disposed = false;
  let uiReasons: readonly LegacySparkRetirementMinimalUiCaptureUiCommandReason[] = Object.freeze([]);

  const readPublicState = (): LegacySparkRetirementLocalCapturePublicState => {
    if (session !== null) publicState = session.getPublicState();
    return publicState;
  };

  const viewModel = (
    overrideUiReasons: readonly LegacySparkRetirementMinimalUiCaptureUiCommandReason[] = uiReasons
  ): LegacySparkRetirementMinimalUiCaptureViewModel => {
    const currentPublicState = readPublicState();
    const status = statusFromPublicState(currentPublicState, commandActive, disposed);
    const reasons = safeReasonsFromPublicState(currentPublicState, overrideUiReasons);
    const primaryActionDisabled = status !== "ready";
    return Object.freeze({
      status,
      guideStatus: currentPublicState.guideState.status,
      primaryActionLabel: LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL,
      primaryActionDisabled,
      showStartOver: !disposed && (status === "snapshot-ready" || status === "incomplete" || status === "invalid"),
      showCancel: !disposed && (status === "ready" || status === "preparing"),
      safeMessageKey: messageKeyForViewModel(status, reasons),
      createdAt: status === "released" ? null : currentPublicState.createdAt,
      counts: freezeCounts(currentPublicState),
      storageStatuses: freezeStorageStatuses(currentPublicState),
      reasonCodes: reasons,
      nextAllowedStep: currentPublicState.nextAllowedStep
    });
  };

  const reject = (
    reason: LegacySparkRetirementMinimalUiCaptureUiCommandReason
  ): LegacySparkRetirementMinimalUiCaptureCommandResult => {
    uiReasons = Object.freeze([reason]);
    return freezeRejected(reason, viewModel(uiReasons));
  };

  const getViewModel = (): LegacySparkRetirementMinimalUiCaptureViewModel => viewModel();

  const prepareLocalBackup = (): LegacySparkRetirementMinimalUiCaptureCommandResult => {
    if (disposed || session === null) return reject("UI_CONTROLLER_RELEASED");
    if (commandActive) return reject("UI_COMMAND_ALREADY_IN_PROGRESS");
    if (viewModel().status !== "ready") return reject("UI_COMMAND_NOT_AVAILABLE");

    commandActive = true;
    uiReasons = Object.freeze([]);
    let sessionResultStatus: "prepared" | "rejected";
    try {
      const sessionResult = session.prepareLocalSnapshot();
      sessionResultStatus = sessionResult.status;
      publicState = sessionResult.publicState;
    } catch {
      commandActive = false;
      return reject("UI_COMMAND_NOT_AVAILABLE");
    }
    commandActive = false;

    const currentViewModel = viewModel();
    return sessionResultStatus === "prepared"
      ? freezeHandled(currentViewModel)
      : freezeRejected("UI_COMMAND_NOT_AVAILABLE", currentViewModel);
  };

  const startOver = (): LegacySparkRetirementMinimalUiCaptureCommandResult => {
    if (disposed || session === null) return reject("UI_CONTROLLER_RELEASED");
    if (commandActive) return reject("UI_COMMAND_ALREADY_IN_PROGRESS");

    uiReasons = Object.freeze([]);
    session.release();
    session = dependencies.createSession();
    publicState = session.getPublicState();
    return freezeHandled(viewModel());
  };

  const dispose = (): LegacySparkRetirementMinimalUiCaptureCommandResult => {
    uiReasons = Object.freeze([]);
    if (!disposed && session !== null) {
      session.release();
      publicState = session.getPublicState();
      session = null;
    }
    commandActive = false;
    disposed = true;
    return freezeHandled(viewModel());
  };

  return Object.freeze({
    getViewModel,
    prepareLocalBackup,
    startOver,
    dispose
  });
}
