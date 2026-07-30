import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";

export type LegacySparkRetirementBackupGuideStatus =
  | "idle"
  | "checking-prerequisites"
  | "snapshot-capturing"
  | "drive-reading"
  | "assembling"
  | "assembly-verified"
  | "backup-presented"
  | "downloads-triggered"
  | "downloaded-files-reselected"
  | "backup-verified"
  | "incomplete"
  | "invalid";

export type LegacySparkRetirementBackupGuideEventType =
  | "START_PREREQUISITE_CHECK"
  | "PREREQUISITES_CONFIRMED"
  | "PREREQUISITES_INCOMPLETE"
  | "PREREQUISITES_INVALID"
  | "SNAPSHOT_CAPTURED"
  | "SNAPSHOT_INCOMPLETE"
  | "SNAPSHOT_FAILED"
  | "DRIVE_READ_STARTED"
  | "DRIVE_READ_COMPLETED"
  | "DRIVE_READ_INCOMPLETE"
  | "DRIVE_READ_INVALID"
  | "ASSEMBLY_VERIFIED"
  | "ASSEMBLY_INCOMPLETE"
  | "ASSEMBLY_INVALID"
  | "BACKUP_PRESENTED"
  | "BACKUP_PRESENTATION_INVALID"
  | "DOWNLOADS_TRIGGERED"
  | "FILES_RESELECTED"
  | "RESELECT_VERIFIED"
  | "RESELECT_INCOMPLETE"
  | "RESELECT_INVALID"
  | "START_OVER";

export type LegacySparkRetirementBackupGuideTransitionReason =
  | "INVALID_TRANSITION"
  | "PREREQUISITES_NOT_CONFIRMED"
  | "SNAPSHOT_NOT_CAPTURED"
  | "DRIVE_NOT_READ"
  | "ASSEMBLY_NOT_VERIFIED"
  | "BACKUP_NOT_PRESENTED"
  | "DOWNLOADS_NOT_TRIGGERED"
  | "FILES_NOT_RESELECTED"
  | "BACKUP_REVERIFICATION_FAILED";

export type LegacySparkRetirementBackupGuideReason =
  | LegacySparkRetirementBackupGuideTransitionReason
  | LegacySparkBackupVerificationReason;

export type LegacySparkRetirementBackupGuideDriveStatus =
  | "required"
  | "present"
  | "required-but-missing"
  | "not-applicable";

export type LegacySparkRetirementBackupGuideCountSummary = Readonly<{
  total: number;
  live?: number;
  tombstones?: number;
}>;

export type LegacySparkRetirementBackupGuideMetadata = Readonly<{
  createdAt?: string;
  fileNames?: Readonly<{
    writerDbV2?: string;
    driveV1Raw?: string | null;
    manifest?: string;
  }>;
  counts?: Readonly<{
    artifacts?: number;
    sparks?: LegacySparkRetirementBackupGuideCountSummary;
    packages?: LegacySparkRetirementBackupGuideCountSummary;
    notes?: Readonly<{
      total: number;
      deleted: number;
    }>;
  }>;
  drive?: Readonly<{
    status: LegacySparkRetirementBackupGuideDriveStatus;
  }>;
  shortHashes?: Readonly<{
    writerDbV2?: string;
    driveV1Raw?: string | null;
    manifest?: string;
    semanticPackage?: string;
    rawPackageStorage?: string | null;
  }>;
  packageBaselineMatched?: boolean;
  nextAllowedStep?: "stop-after-backup-verification";
  reasons?: readonly LegacySparkRetirementBackupGuideReason[];
}>;

export type LegacySparkRetirementBackupGuideState = Readonly<{
  status: LegacySparkRetirementBackupGuideStatus;
  metadata?: LegacySparkRetirementBackupGuideMetadata;
}>;

type BaseEvent = Readonly<{
  type: Exclude<LegacySparkRetirementBackupGuideEventType, "RESELECT_VERIFIED">;
  metadata?: LegacySparkRetirementBackupGuideMetadata;
  reasons?: readonly LegacySparkRetirementBackupGuideReason[];
}>;

export type LegacySparkRetirementBackupGuideReverificationEvent = Readonly<{
  type: "RESELECT_VERIFIED";
  rawHashMatch: boolean;
  writerDbStructureVerified: boolean;
  driveStructureVerified: boolean;
  driveNotApplicable?: boolean;
  manifestCrossCheckPassed: boolean;
  packageBaselineMatched: boolean;
  metadata?: LegacySparkRetirementBackupGuideMetadata;
  reasons?: readonly LegacySparkRetirementBackupGuideReason[];
}>;

export type LegacySparkRetirementBackupGuideEvent =
  | BaseEvent
  | LegacySparkRetirementBackupGuideReverificationEvent;

export type LegacySparkRetirementBackupGuideTransitionResult =
  | Readonly<{
      status: "transitioned";
      state: LegacySparkRetirementBackupGuideState;
    }>
  | Readonly<{
      status: "rejected";
      state: LegacySparkRetirementBackupGuideState;
      reason: LegacySparkRetirementBackupGuideTransitionReason;
      reasons: readonly LegacySparkRetirementBackupGuideTransitionReason[];
    }>;

export const LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_STATUSES: readonly LegacySparkRetirementBackupGuideStatus[] =
  Object.freeze([
    "idle",
    "checking-prerequisites",
    "snapshot-capturing",
    "drive-reading",
    "assembling",
    "assembly-verified",
    "backup-presented",
    "downloads-triggered",
    "downloaded-files-reselected",
    "backup-verified",
    "incomplete",
    "invalid"
  ]);

export const LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_EVENT_TYPES: readonly LegacySparkRetirementBackupGuideEventType[] =
  Object.freeze([
    "START_PREREQUISITE_CHECK",
    "PREREQUISITES_CONFIRMED",
    "PREREQUISITES_INCOMPLETE",
    "PREREQUISITES_INVALID",
    "SNAPSHOT_CAPTURED",
    "SNAPSHOT_INCOMPLETE",
    "SNAPSHOT_FAILED",
    "DRIVE_READ_STARTED",
    "DRIVE_READ_COMPLETED",
    "DRIVE_READ_INCOMPLETE",
    "DRIVE_READ_INVALID",
    "ASSEMBLY_VERIFIED",
    "ASSEMBLY_INCOMPLETE",
    "ASSEMBLY_INVALID",
    "BACKUP_PRESENTED",
    "BACKUP_PRESENTATION_INVALID",
    "DOWNLOADS_TRIGGERED",
    "FILES_RESELECTED",
    "RESELECT_VERIFIED",
    "RESELECT_INCOMPLETE",
    "RESELECT_INVALID",
    "START_OVER"
  ]);

const TERMINAL_STATUSES = new Set<LegacySparkRetirementBackupGuideStatus>([
  "backup-verified",
  "incomplete",
  "invalid"
]);
const REASON_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;
const HASH_ID = /^[0-9a-f]{8,16}$/;
const CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/;
const BACKUP_FILE_NAME =
  /^LassiLAB_Writer_pre-retirement_(DBv2|DriveV1|manifest)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}Z\.json$/;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function safeFileName(value: unknown): string | undefined {
  return typeof value === "string" && BACKUP_FILE_NAME.test(value) ? value : undefined;
}

function safeNullableFileName(value: unknown): string | null | undefined {
  if (value === null) return null;
  return safeFileName(value);
}

function safeHash(value: unknown): string | undefined {
  return typeof value === "string" && HASH_ID.test(value) ? value : undefined;
}

function safeNullableHash(value: unknown): string | null | undefined {
  if (value === null) return null;
  return safeHash(value);
}

function safeReasons(
  reasons: readonly LegacySparkRetirementBackupGuideReason[] | undefined
): readonly LegacySparkRetirementBackupGuideReason[] | undefined {
  if (!Array.isArray(reasons)) return undefined;
  const filtered = reasons.filter(
    (reason): reason is LegacySparkRetirementBackupGuideReason =>
      typeof reason === "string" && REASON_CODE.test(reason)
  );
  return filtered.length > 0 ? Object.freeze([...new Set(filtered)]) : undefined;
}

function safeCountSummary(
  summary: LegacySparkRetirementBackupGuideCountSummary | undefined
): LegacySparkRetirementBackupGuideCountSummary | undefined {
  if (!summary || !isNonNegativeInteger(summary.total)) return undefined;
  const result: { total: number; live?: number; tombstones?: number } = { total: summary.total };
  if (isNonNegativeInteger(summary.live)) result.live = summary.live;
  if (isNonNegativeInteger(summary.tombstones)) result.tombstones = summary.tombstones;
  return Object.freeze(result);
}

function safeMetadata(
  metadata: LegacySparkRetirementBackupGuideMetadata | undefined,
  eventReasons?: readonly LegacySparkRetirementBackupGuideReason[]
): LegacySparkRetirementBackupGuideMetadata | undefined {
  const result: {
    createdAt?: string;
    fileNames?: NonNullable<LegacySparkRetirementBackupGuideMetadata["fileNames"]>;
    counts?: NonNullable<LegacySparkRetirementBackupGuideMetadata["counts"]>;
    drive?: NonNullable<LegacySparkRetirementBackupGuideMetadata["drive"]>;
    shortHashes?: NonNullable<LegacySparkRetirementBackupGuideMetadata["shortHashes"]>;
    packageBaselineMatched?: boolean;
    nextAllowedStep?: "stop-after-backup-verification";
    reasons?: readonly LegacySparkRetirementBackupGuideReason[];
  } = {};

  if (metadata?.createdAt && CREATED_AT.test(metadata.createdAt)) {
    result.createdAt = metadata.createdAt;
  }

  const fileNames: {
    writerDbV2?: string;
    driveV1Raw?: string | null;
    manifest?: string;
  } = {};
  const writerDbV2FileName = safeFileName(metadata?.fileNames?.writerDbV2);
  const driveV1RawFileName = safeNullableFileName(metadata?.fileNames?.driveV1Raw);
  const manifestFileName = safeFileName(metadata?.fileNames?.manifest);
  if (writerDbV2FileName) fileNames.writerDbV2 = writerDbV2FileName;
  if (driveV1RawFileName !== undefined) fileNames.driveV1Raw = driveV1RawFileName;
  if (manifestFileName) fileNames.manifest = manifestFileName;
  if (Object.keys(fileNames).length > 0) result.fileNames = Object.freeze(fileNames);

  const counts: {
    artifacts?: number;
    sparks?: LegacySparkRetirementBackupGuideCountSummary;
    packages?: LegacySparkRetirementBackupGuideCountSummary;
    notes?: Readonly<{ total: number; deleted: number }>;
  } = {};
  if (isNonNegativeInteger(metadata?.counts?.artifacts)) {
    counts.artifacts = metadata.counts.artifacts;
  }
  const sparkCounts = safeCountSummary(metadata?.counts?.sparks);
  const packageCounts = safeCountSummary(metadata?.counts?.packages);
  if (sparkCounts) counts.sparks = sparkCounts;
  if (packageCounts) counts.packages = packageCounts;
  if (
    isNonNegativeInteger(metadata?.counts?.notes?.total) &&
    isNonNegativeInteger(metadata?.counts?.notes?.deleted)
  ) {
    counts.notes = Object.freeze({
      total: metadata.counts.notes.total,
      deleted: metadata.counts.notes.deleted
    });
  }
  if (Object.keys(counts).length > 0) result.counts = Object.freeze(counts);

  if (
    metadata?.drive?.status === "required" ||
    metadata?.drive?.status === "present" ||
    metadata?.drive?.status === "required-but-missing" ||
    metadata?.drive?.status === "not-applicable"
  ) {
    result.drive = Object.freeze({ status: metadata.drive.status });
  }

  const shortHashes: {
    writerDbV2?: string;
    driveV1Raw?: string | null;
    manifest?: string;
    semanticPackage?: string;
    rawPackageStorage?: string | null;
  } = {};
  const writerDbV2Hash = safeHash(metadata?.shortHashes?.writerDbV2);
  const driveV1RawHash = safeNullableHash(metadata?.shortHashes?.driveV1Raw);
  const manifestHash = safeHash(metadata?.shortHashes?.manifest);
  const semanticPackageHash = safeHash(metadata?.shortHashes?.semanticPackage);
  const rawPackageStorageHash = safeNullableHash(metadata?.shortHashes?.rawPackageStorage);
  if (writerDbV2Hash) shortHashes.writerDbV2 = writerDbV2Hash;
  if (driveV1RawHash !== undefined) shortHashes.driveV1Raw = driveV1RawHash;
  if (manifestHash) shortHashes.manifest = manifestHash;
  if (semanticPackageHash) shortHashes.semanticPackage = semanticPackageHash;
  if (rawPackageStorageHash !== undefined) shortHashes.rawPackageStorage = rawPackageStorageHash;
  if (Object.keys(shortHashes).length > 0) result.shortHashes = Object.freeze(shortHashes);

  if (typeof metadata?.packageBaselineMatched === "boolean") {
    result.packageBaselineMatched = metadata.packageBaselineMatched;
  }

  if (metadata?.nextAllowedStep === "stop-after-backup-verification") {
    result.nextAllowedStep = metadata.nextAllowedStep;
  }

  const reasons = safeReasons(eventReasons ?? metadata?.reasons);
  if (reasons) result.reasons = reasons;

  return Object.keys(result).length > 0 ? Object.freeze(result) : undefined;
}

function state(
  status: LegacySparkRetirementBackupGuideStatus,
  metadata?: LegacySparkRetirementBackupGuideMetadata,
  reasons?: readonly LegacySparkRetirementBackupGuideReason[]
): LegacySparkRetirementBackupGuideState {
  const safe = safeMetadata(metadata, reasons);
  return Object.freeze({
    status,
    ...(safe ? { metadata: safe } : {})
  });
}

function transitioned(
  nextState: LegacySparkRetirementBackupGuideState
): LegacySparkRetirementBackupGuideTransitionResult {
  return Object.freeze({ status: "transitioned" as const, state: nextState });
}

function rejected(
  currentState: LegacySparkRetirementBackupGuideState,
  reason: LegacySparkRetirementBackupGuideTransitionReason
): LegacySparkRetirementBackupGuideTransitionResult {
  return Object.freeze({
    status: "rejected" as const,
    state: currentState,
    reason,
    reasons: Object.freeze([reason])
  });
}

function rejectionReason(
  eventType: LegacySparkRetirementBackupGuideEventType
): LegacySparkRetirementBackupGuideTransitionReason {
  switch (eventType) {
    case "PREREQUISITES_CONFIRMED":
    case "PREREQUISITES_INCOMPLETE":
    case "PREREQUISITES_INVALID":
      return "PREREQUISITES_NOT_CONFIRMED";
    case "SNAPSHOT_CAPTURED":
    case "SNAPSHOT_INCOMPLETE":
    case "SNAPSHOT_FAILED":
    case "DRIVE_READ_STARTED":
      return "SNAPSHOT_NOT_CAPTURED";
    case "DRIVE_READ_COMPLETED":
    case "DRIVE_READ_INCOMPLETE":
    case "DRIVE_READ_INVALID":
      return "DRIVE_NOT_READ";
    case "ASSEMBLY_VERIFIED":
    case "ASSEMBLY_INCOMPLETE":
    case "ASSEMBLY_INVALID":
      return "ASSEMBLY_NOT_VERIFIED";
    case "BACKUP_PRESENTED":
    case "BACKUP_PRESENTATION_INVALID":
      return "ASSEMBLY_NOT_VERIFIED";
    case "DOWNLOADS_TRIGGERED":
      return "BACKUP_NOT_PRESENTED";
    case "FILES_RESELECTED":
      return "DOWNLOADS_NOT_TRIGGERED";
    case "RESELECT_VERIFIED":
    case "RESELECT_INCOMPLETE":
    case "RESELECT_INVALID":
      return "FILES_NOT_RESELECTED";
    default:
      return "INVALID_TRANSITION";
  }
}

function isReverificationConfirmed(
  event: LegacySparkRetirementBackupGuideReverificationEvent
): boolean {
  return event.rawHashMatch === true &&
    event.writerDbStructureVerified === true &&
    (event.driveStructureVerified === true || event.driveNotApplicable === true) &&
    event.manifestCrossCheckPassed === true &&
    event.packageBaselineMatched === true;
}

export function createLegacySparkRetirementBackupGuideState(): LegacySparkRetirementBackupGuideState {
  return state("idle");
}

export function transitionLegacySparkRetirementBackupGuide(
  currentState: LegacySparkRetirementBackupGuideState,
  event: LegacySparkRetirementBackupGuideEvent
): LegacySparkRetirementBackupGuideTransitionResult {
  if (event.type === "START_OVER") {
    return transitioned(createLegacySparkRetirementBackupGuideState());
  }

  if (TERMINAL_STATUSES.has(currentState.status)) {
    return rejected(currentState, "INVALID_TRANSITION");
  }

  switch (currentState.status) {
    case "idle":
      if (event.type === "START_PREREQUISITE_CHECK") {
        return transitioned(state("checking-prerequisites", event.metadata, event.reasons));
      }
      break;
    case "checking-prerequisites":
      if (event.type === "PREREQUISITES_CONFIRMED") {
        return transitioned(state("snapshot-capturing", event.metadata, event.reasons));
      }
      if (event.type === "PREREQUISITES_INCOMPLETE") {
        return transitioned(state("incomplete", event.metadata, event.reasons));
      }
      if (event.type === "PREREQUISITES_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "snapshot-capturing":
      if (event.type === "SNAPSHOT_CAPTURED" || event.type === "DRIVE_READ_STARTED") {
        return transitioned(state("drive-reading", event.metadata, event.reasons));
      }
      if (event.type === "SNAPSHOT_INCOMPLETE") {
        return transitioned(state("incomplete", event.metadata, event.reasons));
      }
      if (event.type === "SNAPSHOT_FAILED") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "drive-reading":
      if (event.type === "DRIVE_READ_COMPLETED") {
        return transitioned(state("assembling", event.metadata, event.reasons));
      }
      if (event.type === "DRIVE_READ_INCOMPLETE") {
        return transitioned(state("incomplete", event.metadata, event.reasons));
      }
      if (event.type === "DRIVE_READ_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "assembling":
      if (event.type === "ASSEMBLY_VERIFIED") {
        return transitioned(state("assembly-verified", event.metadata, event.reasons));
      }
      if (event.type === "ASSEMBLY_INCOMPLETE") {
        return transitioned(state("incomplete", event.metadata, event.reasons));
      }
      if (event.type === "ASSEMBLY_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "assembly-verified":
      if (event.type === "BACKUP_PRESENTED") {
        return transitioned(state("backup-presented", event.metadata, event.reasons));
      }
      if (event.type === "BACKUP_PRESENTATION_INVALID" || event.type === "ASSEMBLY_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "backup-presented":
      if (event.type === "DOWNLOADS_TRIGGERED") {
        return transitioned(state("downloads-triggered", event.metadata, event.reasons));
      }
      if (event.type === "BACKUP_PRESENTATION_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "downloads-triggered":
      if (event.type === "FILES_RESELECTED") {
        return transitioned(state("downloaded-files-reselected", event.metadata, event.reasons));
      }
      if (event.type === "RESELECT_INCOMPLETE") {
        return transitioned(state("incomplete", event.metadata, event.reasons));
      }
      if (event.type === "RESELECT_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    case "downloaded-files-reselected":
      if (event.type === "RESELECT_VERIFIED") {
        if (!isReverificationConfirmed(event)) {
          return rejected(currentState, "BACKUP_REVERIFICATION_FAILED");
        }
        return transitioned(state("backup-verified", {
          ...event.metadata,
          packageBaselineMatched: true,
          nextAllowedStep: "stop-after-backup-verification"
        }, event.reasons));
      }
      if (event.type === "RESELECT_INCOMPLETE") {
        return transitioned(state("incomplete", event.metadata, event.reasons));
      }
      if (event.type === "RESELECT_INVALID") {
        return transitioned(state("invalid", event.metadata, event.reasons));
      }
      break;
    default:
      break;
  }

  return rejected(currentState, rejectionReason(event.type));
}
