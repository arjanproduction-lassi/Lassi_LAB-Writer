import type { Spark, WriterPackage, WriterPackageNote } from "./types";
import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";
import {
  createLegacySparkRetirementBackupGuideState,
  transitionLegacySparkRetirementBackupGuide,
  type LegacySparkRetirementBackupGuideMetadata,
  type LegacySparkRetirementBackupGuideState,
  type LegacySparkRetirementBackupGuideTransitionReason
} from "./legacySparkRetirementBackupGuideState";
import type {
  LegacySparkRetirementLocalSnapshot,
  LegacySparkRetirementLocalSnapshotResult,
  LegacySparkRetirementLocalSnapshotSummary
} from "./legacySparkRetirementLocalSnapshot";

export type LegacySparkRetirementCapturedLocalSnapshotResult = Extract<
  LegacySparkRetirementLocalSnapshotResult,
  { status: "snapshot-captured" }
>;

export type LegacySparkRetirementLocalCaptureCommandReason =
  | "CAPTURE_ALREADY_IN_PROGRESS"
  | "CAPTURE_ALREADY_ATTEMPTED"
  | "CAPTURE_SESSION_RELEASED"
  | "CAPTURE_DEPENDENCY_FAILED"
  | "CREATED_AT_CREATION_FAILED"
  | "GUIDE_TRANSITION_REJECTED";

export type LegacySparkRetirementLocalCaptureNextAllowedStep =
  | "prepare-local-snapshot"
  | "provide-captured-snapshot-to-next-step"
  | "start-new-session"
  | "none";

export type LegacySparkRetirementLocalCaptureSnapshotSummary = Readonly<
  Omit<LegacySparkRetirementLocalSnapshotSummary, "sparkIds" | "packageIds">
>;

export type LegacySparkRetirementLocalCapturePublicState = Readonly<{
  guideState: LegacySparkRetirementBackupGuideState;
  snapshotSummary: LegacySparkRetirementLocalCaptureSnapshotSummary | null;
  createdAt: string | null;
  isPreparing: boolean;
  isReleased: boolean;
  commandReasons: readonly LegacySparkRetirementLocalCaptureCommandReason[];
  nextAllowedStep: LegacySparkRetirementLocalCaptureNextAllowedStep;
}>;

export type LegacySparkRetirementLocalCaptureCommandResult =
  | Readonly<{
      status: "prepared";
      publicState: LegacySparkRetirementLocalCapturePublicState;
    }>
  | Readonly<{
      status: "rejected";
      reason: LegacySparkRetirementLocalCaptureCommandReason;
      reasons: readonly LegacySparkRetirementLocalCaptureCommandReason[];
      guideReason?: LegacySparkRetirementBackupGuideTransitionReason;
      publicState: LegacySparkRetirementLocalCapturePublicState;
    }>;

export type LegacySparkRetirementLocalCaptureSessionDependencies = Readonly<{
  createCanonicalTimestamp: () => string;
  captureLocalSnapshot: (
    input: Readonly<{ createdAt: string }>
  ) => LegacySparkRetirementLocalSnapshotResult;
}>;

export type LegacySparkRetirementLocalCaptureSession = Readonly<{
  prepareLocalSnapshot: () => LegacySparkRetirementLocalCaptureCommandResult;
  getPublicState: () => LegacySparkRetirementLocalCapturePublicState;
  withCapturedSnapshotForInternalUse: <T>(
    operation: (snapshot: LegacySparkRetirementCapturedLocalSnapshotResult) => T
  ) => T | undefined;
  release: () => void;
}>;

type SessionPhase = "ready" | "capturing" | "captured" | "incomplete" | "invalid" | "released";

function freezeCommandReasons(
  reasons: readonly LegacySparkRetirementLocalCaptureCommandReason[]
): readonly LegacySparkRetirementLocalCaptureCommandReason[] {
  return Object.freeze([...new Set(reasons)]);
}

function freezeVerificationReasons(
  reasons: readonly LegacySparkBackupVerificationReason[] | undefined
): readonly LegacySparkBackupVerificationReason[] {
  const filtered = Array.isArray(reasons)
    ? reasons.filter((reason): reason is LegacySparkBackupVerificationReason =>
        typeof reason === "string" && /^[A-Z][A-Z0-9_]{2,63}$/.test(reason)
      )
    : [];
  return Object.freeze(
    filtered.length > 0
      ? [...new Set(filtered)]
      : ["SNAPSHOT_NOT_CAPTURED" as LegacySparkBackupVerificationReason]
  );
}

function cloneSpark(value: Readonly<Spark>): Readonly<Spark> {
  return Object.freeze({
    ...value,
    tags: Object.freeze([...value.tags]) as string[]
  });
}

function cloneNote(value: Readonly<WriterPackageNote>): Readonly<WriterPackageNote> {
  return Object.freeze({ ...value });
}

function clonePackage(value: Readonly<WriterPackage>): Readonly<WriterPackage> {
  return Object.freeze({
    ...value,
    notes: Object.freeze(value.notes.map(cloneNote)) as WriterPackageNote[],
    ...(value.legacy ? { legacy: Object.freeze({ ...value.legacy }) } : {})
  });
}

function cloneSnapshot(
  snapshot: LegacySparkRetirementLocalSnapshot
): LegacySparkRetirementLocalSnapshot {
  return Object.freeze({
    createdAt: snapshot.createdAt,
    sparkStorage: Object.freeze({ ...snapshot.sparkStorage }),
    packageStorage: Object.freeze({ ...snapshot.packageStorage }),
    draftStorage: Object.freeze({ ...snapshot.draftStorage }),
    sparks: Object.freeze(snapshot.sparks.map(cloneSpark)) as readonly Readonly<Spark>[],
    packages: Object.freeze(snapshot.packages.map(clonePackage)) as readonly Readonly<WriterPackage>[]
  });
}

function cloneSummary(
  summary: LegacySparkRetirementLocalSnapshotSummary
): LegacySparkRetirementLocalSnapshotSummary {
  return Object.freeze({
    createdAt: summary.createdAt,
    sparkStorageStatus: summary.sparkStorageStatus,
    packageStorageStatus: summary.packageStorageStatus,
    sparkCount: summary.sparkCount,
    sparkLiveCount: summary.sparkLiveCount,
    sparkTombstoneCount: summary.sparkTombstoneCount,
    packageCount: summary.packageCount,
    packageLiveCount: summary.packageLiveCount,
    packageTombstoneCount: summary.packageTombstoneCount,
    noteCount: summary.noteCount,
    deletedNoteCount: summary.deletedNoteCount,
    draftPresent: false,
    sparkIds: Object.freeze([...summary.sparkIds]),
    packageIds: Object.freeze([...summary.packageIds])
  });
}

function publicSummary(
  summary: LegacySparkRetirementLocalSnapshotSummary
): LegacySparkRetirementLocalCaptureSnapshotSummary {
  return Object.freeze({
    createdAt: summary.createdAt,
    sparkStorageStatus: summary.sparkStorageStatus,
    packageStorageStatus: summary.packageStorageStatus,
    sparkCount: summary.sparkCount,
    sparkLiveCount: summary.sparkLiveCount,
    sparkTombstoneCount: summary.sparkTombstoneCount,
    packageCount: summary.packageCount,
    packageLiveCount: summary.packageLiveCount,
    packageTombstoneCount: summary.packageTombstoneCount,
    noteCount: summary.noteCount,
    deletedNoteCount: summary.deletedNoteCount,
    draftPresent: false
  });
}

function cloneCapturedResult(
  result: LegacySparkRetirementCapturedLocalSnapshotResult
): LegacySparkRetirementCapturedLocalSnapshotResult {
  return Object.freeze({
    status: "snapshot-captured" as const,
    snapshot: cloneSnapshot(result.snapshot),
    summary: cloneSummary(result.summary)
  });
}

function summaryMetadata(
  summary: LegacySparkRetirementLocalSnapshotSummary
): LegacySparkRetirementBackupGuideMetadata {
  return Object.freeze({
    createdAt: summary.createdAt,
    counts: Object.freeze({
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
    })
  });
}

function createdAtMetadata(createdAt: string | null): LegacySparkRetirementBackupGuideMetadata | undefined {
  return createdAt === null ? undefined : Object.freeze({ createdAt });
}

function nextAllowedStep(
  phase: SessionPhase
): LegacySparkRetirementLocalCaptureNextAllowedStep {
  if (phase === "ready") return "prepare-local-snapshot";
  if (phase === "captured") return "provide-captured-snapshot-to-next-step";
  if (phase === "released") return "start-new-session";
  return "none";
}

export function createLegacySparkRetirementLocalCaptureSession(
  dependencies: LegacySparkRetirementLocalCaptureSessionDependencies
): LegacySparkRetirementLocalCaptureSession {
  let guideState = createLegacySparkRetirementBackupGuideState();
  let phase: SessionPhase = "ready";
  let capturedResult: LegacySparkRetirementCapturedLocalSnapshotResult | null = null;
  let snapshotSummary: LegacySparkRetirementLocalCaptureSnapshotSummary | null = null;
  let attemptCreatedAt: string | null = null;
  let commandReasons: readonly LegacySparkRetirementLocalCaptureCommandReason[] = Object.freeze([]);

  const publicState = (
    overrideReasons: readonly LegacySparkRetirementLocalCaptureCommandReason[] = commandReasons
  ): LegacySparkRetirementLocalCapturePublicState => Object.freeze({
    guideState,
    snapshotSummary,
    createdAt: phase === "released"
      ? null
      : snapshotSummary?.createdAt ?? guideState.metadata?.createdAt ?? null,
    isPreparing: phase === "capturing",
    isReleased: phase === "released",
    commandReasons: freezeCommandReasons(overrideReasons),
    nextAllowedStep: nextAllowedStep(phase)
  });

  const rejectCommand = (
    reason: LegacySparkRetirementLocalCaptureCommandReason,
    guideReason?: LegacySparkRetirementBackupGuideTransitionReason
  ): LegacySparkRetirementLocalCaptureCommandResult => {
    const reasons = freezeCommandReasons([reason]);
    return Object.freeze({
      status: "rejected" as const,
      reason,
      reasons,
      ...(guideReason ? { guideReason } : {}),
      publicState: publicState(reasons)
    });
  };

  const prepared = (): LegacySparkRetirementLocalCaptureCommandResult => Object.freeze({
    status: "prepared" as const,
    publicState: publicState()
  });

  const prepareGuideForCapture = ():
    | Readonly<{ ok: true; state: LegacySparkRetirementBackupGuideState }>
    | Readonly<{ ok: false; reason: LegacySparkRetirementBackupGuideTransitionReason }> => {
    const started = transitionLegacySparkRetirementBackupGuide(guideState, {
      type: "START_PREREQUISITE_CHECK"
    });
    if (started.status === "rejected") return Object.freeze({ ok: false as const, reason: started.reason });

    const confirmed = transitionLegacySparkRetirementBackupGuide(started.state, {
      type: "PREREQUISITES_CONFIRMED"
    });
    if (confirmed.status === "rejected") {
      return Object.freeze({ ok: false as const, reason: confirmed.reason });
    }

    return Object.freeze({ ok: true as const, state: confirmed.state });
  };

  const finishCapture = (
    result: LegacySparkRetirementLocalSnapshotResult,
    createdAt: string
  ): LegacySparkRetirementLocalCaptureCommandResult => {
    if (phase === "released") return rejectCommand("CAPTURE_SESSION_RELEASED");

    if (result.status === "snapshot-captured") {
      const captured = cloneCapturedResult(result);
      capturedResult = captured;
      snapshotSummary = publicSummary(captured.summary);
      const transitioned = transitionLegacySparkRetirementBackupGuide(guideState, {
        type: "SNAPSHOT_CAPTURED",
        metadata: summaryMetadata(captured.summary)
      });
      if (transitioned.status === "rejected") {
        capturedResult = null;
        snapshotSummary = null;
        phase = "invalid";
        commandReasons = freezeCommandReasons(["GUIDE_TRANSITION_REJECTED"]);
        return rejectCommand("GUIDE_TRANSITION_REJECTED", transitioned.reason);
      }
      guideState = transitioned.state;
      phase = "captured";
      commandReasons = Object.freeze([]);
      return prepared();
    }

    capturedResult = null;
    snapshotSummary = null;
    const reasons = freezeVerificationReasons(result.reasons);
    const transitioned = transitionLegacySparkRetirementBackupGuide(guideState, {
      type: result.status === "incomplete" ? "SNAPSHOT_INCOMPLETE" : "SNAPSHOT_FAILED",
      metadata: createdAtMetadata(createdAt),
      reasons
    });
    if (transitioned.status === "rejected") {
      phase = "invalid";
      commandReasons = freezeCommandReasons(["GUIDE_TRANSITION_REJECTED"]);
      return rejectCommand("GUIDE_TRANSITION_REJECTED", transitioned.reason);
    }
    guideState = transitioned.state;
    phase = result.status;
    commandReasons = Object.freeze([]);
    return prepared();
  };

  const failTimestampCreation = (): LegacySparkRetirementLocalCaptureCommandResult => {
    capturedResult = null;
    snapshotSummary = null;
    attemptCreatedAt = null;
    const transitioned = transitionLegacySparkRetirementBackupGuide(guideState, {
      type: "SNAPSHOT_FAILED",
      reasons: Object.freeze(["SNAPSHOT_NOT_CAPTURED" as LegacySparkBackupVerificationReason])
    });
    if (transitioned.status === "transitioned") guideState = transitioned.state;
    phase = "invalid";
    commandReasons = freezeCommandReasons(["CREATED_AT_CREATION_FAILED"]);
    return prepared();
  };

  const failCaptureDependency = (): LegacySparkRetirementLocalCaptureCommandResult => {
    capturedResult = null;
    snapshotSummary = null;
    const transitioned = transitionLegacySparkRetirementBackupGuide(guideState, {
      type: "SNAPSHOT_FAILED",
      metadata: createdAtMetadata(attemptCreatedAt),
      reasons: Object.freeze(["SNAPSHOT_NOT_CAPTURED" as LegacySparkBackupVerificationReason])
    });
    if (transitioned.status === "transitioned") guideState = transitioned.state;
    phase = "invalid";
    commandReasons = freezeCommandReasons(["CAPTURE_DEPENDENCY_FAILED"]);
    return prepared();
  };

  const prepareLocalSnapshot = (): LegacySparkRetirementLocalCaptureCommandResult => {
    if (phase === "released") return rejectCommand("CAPTURE_SESSION_RELEASED");
    if (phase === "capturing") return rejectCommand("CAPTURE_ALREADY_IN_PROGRESS");
    if (phase !== "ready") return rejectCommand("CAPTURE_ALREADY_ATTEMPTED");

    const captureReady = prepareGuideForCapture();
    if (!captureReady.ok) return rejectCommand("GUIDE_TRANSITION_REJECTED", captureReady.reason);

    guideState = captureReady.state;
    phase = "capturing";
    capturedResult = null;
    snapshotSummary = null;
    attemptCreatedAt = null;
    commandReasons = Object.freeze([]);

    let createdAt: string;
    try {
      createdAt = dependencies.createCanonicalTimestamp();
    } catch {
      return failTimestampCreation();
    }

    attemptCreatedAt = createdAt;
    let result: LegacySparkRetirementLocalSnapshotResult;
    try {
      result = dependencies.captureLocalSnapshot(Object.freeze({ createdAt }));
    } catch {
      return failCaptureDependency();
    }

    return finishCapture(result, createdAt);
  };

  const getPublicState = (): LegacySparkRetirementLocalCapturePublicState => publicState();

  const withCapturedSnapshotForInternalUse = <T>(
    operation: (snapshot: LegacySparkRetirementCapturedLocalSnapshotResult) => T
  ): T | undefined => {
    if (phase !== "captured" || capturedResult === null) return undefined;
    return operation(capturedResult);
  };

  const release = (): void => {
    capturedResult = null;
    snapshotSummary = null;
    attemptCreatedAt = null;
    commandReasons = Object.freeze([]);
    phase = "released";
    const reset = transitionLegacySparkRetirementBackupGuide(guideState, { type: "START_OVER" });
    if (reset.status === "transitioned") guideState = reset.state;
  };

  return Object.freeze({
    prepareLocalSnapshot,
    getPublicState,
    withCapturedSnapshotForInternalUse,
    release
  });
}
