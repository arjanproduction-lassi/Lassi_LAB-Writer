export type LegacySparkBackupArtifactKind =
  | "writer-db-v2"
  | "drive-v1-raw"
  | "manifest";

export type LegacySparkBackupDriveStatus = "required" | "not-applicable";

export type LegacySparkBackupVerificationReason =
  | "INVALID_CREATED_AT"
  | "INVALID_COUNT"
  | "SPARK_COUNT_MISMATCH"
  | "PACKAGE_COUNT_MISMATCH"
  | "NOTE_COUNT_MISMATCH"
  | "DUPLICATE_PACKAGE_ID"
  | "WRITER_DB_SCHEMA_MISMATCH"
  | "DRIVE_SCHEMA_MISMATCH"
  | "DRIVE_METADATA_MISMATCH"
  | "WRITER_DB_BACKUP_MISSING"
  | "WRITER_DB_PARSE_FAILED"
  | "WRITER_DB_APP_MISMATCH"
  | "WRITER_DB_CONTENT_INVALID"
  | "WRITER_DB_COUNT_MISMATCH"
  | "DRIVE_BACKUP_MISSING"
  | "DRIVE_PARSE_FAILED"
  | "DRIVE_APP_MISMATCH"
  | "DRIVE_CONTENT_INVALID"
  | "DRIVE_COUNT_MISMATCH"
  | "HASH_MISMATCH"
  | "PACKAGE_BASELINE_MISMATCH"
  | "PACKAGE_DATA_INVALID"
  | "PACKAGE_SEMANTIC_HASH_FAILED"
  | "PACKAGE_SEMANTIC_HASH_INVALID"
  | "PACKAGE_RAW_HASH_INVALID"
  | "WRITER_DB_READ_FAILED"
  | "WRITER_DB_UTF8_DECODE_FAILED"
  | "WRITER_DB_RAW_HASH_FAILED"
  | "DRIVE_READ_FAILED"
  | "DRIVE_UTF8_DECODE_FAILED"
  | "DRIVE_RAW_HASH_FAILED"
  | "PACKAGE_READ_FAILED"
  | "PACKAGE_RAW_HASH_FAILED"
  | "DUPLICATE_SPARK_ID"
  | "TOMBSTONE_COUNT_MISMATCH"
  | "ARTIFACT_RELOAD_FAILED"
  | "MANIFEST_INCOMPLETE";

export type LegacySparkBackupFileNames = Readonly<{
  timestampToken: string;
  writerDbV2: string;
  driveV1Raw: string;
  manifest: string;
}>;

export type LegacySparkBackupArtifactPlan = Readonly<{
  kind: LegacySparkBackupArtifactKind;
  fileName: string;
  required: true;
}>;

export type LegacySparkRetirementBackupManifestPlan = Readonly<{
  backupVersion: 1;
  purpose: "legacy-spark-retirement-r2";
  createdAt: string;
  verificationStatus: "planned";
  writerDbV2: Readonly<{
    fileName: string;
    schemaVersion: 2;
    rawSha256: null;
    semanticSparkSha256: null;
    semanticPackageSha256: null;
    sparkCount: number;
    liveSparkCount: number;
    sparkTombstoneCount: number;
    packageCount: number;
    livePackageCount: number;
    packageTombstoneCount: number;
    noteCount: number;
    deletedNoteCount: number;
  }>;
  driveV1:
    | Readonly<{
        status: "required";
        fileName: string;
        schemaVersion: 1;
        rawSha256: null;
        sparkCount: number;
        liveSparkCount: number;
        sparkTombstoneCount: number;
      }>
    | Readonly<{
        status: "not-applicable";
        fileName: null;
        schemaVersion: null;
        rawSha256: null;
        sparkCount: null;
        liveSparkCount: null;
        sparkTombstoneCount: null;
      }>;
  packageBaseline: Readonly<{
    packageIds: readonly string[];
    semanticSha256: null;
    rawStorageSha256: null;
  }>;
}>;

export type LegacySparkRetirementBackupPlan = Readonly<{
  status: "planned";
  artifacts: readonly LegacySparkBackupArtifactPlan[];
  manifest: LegacySparkRetirementBackupManifestPlan;
  nextAllowedStep: "verify-backup";
}>;

type CountSummary = Readonly<{
  total: number;
  live: number;
  tombstones: number;
}>;

export type BuildLegacySparkRetirementBackupPlanInput = Readonly<{
  createdAt: string;
  writerDbSchemaVersion: 2;
  writerDbSparks: CountSummary;
  writerDbPackages: CountSummary;
  noteCount: number;
  deletedNoteCount: number;
  packageIds: readonly string[];
  drive:
    | Readonly<{
        status: "required";
        schemaVersion: 1;
        sparks: CountSummary;
      }>
    | Readonly<{
        status: "not-applicable";
      }>;
}>;

export type BuildLegacySparkRetirementBackupPlanResult =
  | Readonly<{ ok: true; plan: LegacySparkRetirementBackupPlan }>
  | Readonly<{
      ok: false;
      reasons: readonly LegacySparkBackupVerificationReason[];
    }>;

const CREATED_AT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.000Z$/;

function timestampToken(createdAt: string): string | null {
  const match = CREATED_AT_PATTERN.exec(createdAt);
  if (!match || new Date(createdAt).toISOString() !== createdAt) return null;
  return `${match[1]}-${match[2]}-${match[3]}_${match[4]}-${match[5]}-${match[6]}Z`;
}

export function buildLegacySparkBackupFileNames(
  createdAt: string
): LegacySparkBackupFileNames {
  const token = timestampToken(createdAt);
  if (!token) {
    throw new Error(
      "Legacy Spark backup createdAt must be a canonical UTC timestamp with .000Z precision."
    );
  }
  return Object.freeze({
    timestampToken: token,
    writerDbV2: `LassiLAB_Writer_pre-retirement_DBv2_${token}.json`,
    driveV1Raw: `LassiLAB_Writer_pre-retirement_DriveV1_${token}.json`,
    manifest: `LassiLAB_Writer_pre-retirement_manifest_${token}.json`
  });
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validateSummary(
  summary: CountSummary,
  mismatchReason: LegacySparkBackupVerificationReason,
  reasons: LegacySparkBackupVerificationReason[]
) {
  if (!isCount(summary.total) || !isCount(summary.live) || !isCount(summary.tombstones)) {
    reasons.push("INVALID_COUNT");
  } else if (summary.live + summary.tombstones !== summary.total) {
    reasons.push(mismatchReason);
  }
}

function uniqueReasons(
  reasons: readonly LegacySparkBackupVerificationReason[]
): readonly LegacySparkBackupVerificationReason[] {
  return Object.freeze([...new Set(reasons)]);
}

export function buildLegacySparkRetirementBackupPlan(
  input: BuildLegacySparkRetirementBackupPlanInput
): BuildLegacySparkRetirementBackupPlanResult {
  const reasons: LegacySparkBackupVerificationReason[] = [];
  let fileNames: LegacySparkBackupFileNames | null = null;
  try {
    fileNames = buildLegacySparkBackupFileNames(input.createdAt);
  } catch {
    reasons.push("INVALID_CREATED_AT");
  }

  if (input.writerDbSchemaVersion !== 2) reasons.push("WRITER_DB_SCHEMA_MISMATCH");
  validateSummary(input.writerDbSparks, "SPARK_COUNT_MISMATCH", reasons);
  validateSummary(input.writerDbPackages, "PACKAGE_COUNT_MISMATCH", reasons);

  if (!isCount(input.noteCount) || !isCount(input.deletedNoteCount)) {
    reasons.push("INVALID_COUNT");
  } else if (input.deletedNoteCount > input.noteCount) {
    reasons.push("NOTE_COUNT_MISMATCH");
  }

  const packageIds = [...input.packageIds];
  if (new Set(packageIds).size !== packageIds.length) {
    reasons.push("DUPLICATE_PACKAGE_ID");
  }

  if (input.drive.status === "required") {
    if (input.drive.schemaVersion !== 1) reasons.push("DRIVE_SCHEMA_MISMATCH");
    validateSummary(input.drive.sparks, "DRIVE_METADATA_MISMATCH", reasons);
  }

  if (reasons.length > 0 || !fileNames) {
    return Object.freeze({ ok: false as const, reasons: uniqueReasons(reasons) });
  }

  packageIds.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const driveV1 = input.drive.status === "required"
    ? Object.freeze({
        status: "required" as const,
        fileName: fileNames.driveV1Raw,
        schemaVersion: 1 as const,
        rawSha256: null,
        sparkCount: input.drive.sparks.total,
        liveSparkCount: input.drive.sparks.live,
        sparkTombstoneCount: input.drive.sparks.tombstones
      })
    : Object.freeze({
        status: "not-applicable" as const,
        fileName: null,
        schemaVersion: null,
        rawSha256: null,
        sparkCount: null,
        liveSparkCount: null,
        sparkTombstoneCount: null
      });

  const writerDbV2 = Object.freeze({
    fileName: fileNames.writerDbV2,
    schemaVersion: 2 as const,
    rawSha256: null,
    semanticSparkSha256: null,
    semanticPackageSha256: null,
    sparkCount: input.writerDbSparks.total,
    liveSparkCount: input.writerDbSparks.live,
    sparkTombstoneCount: input.writerDbSparks.tombstones,
    packageCount: input.writerDbPackages.total,
    livePackageCount: input.writerDbPackages.live,
    packageTombstoneCount: input.writerDbPackages.tombstones,
    noteCount: input.noteCount,
    deletedNoteCount: input.deletedNoteCount
  });
  const packageBaseline = Object.freeze({
    packageIds: Object.freeze(packageIds),
    semanticSha256: null,
    rawStorageSha256: null
  });
  const manifest: LegacySparkRetirementBackupManifestPlan = Object.freeze({
    backupVersion: 1,
    purpose: "legacy-spark-retirement-r2",
    createdAt: input.createdAt,
    verificationStatus: "planned",
    writerDbV2,
    driveV1,
    packageBaseline
  });
  const artifacts: readonly LegacySparkBackupArtifactPlan[] = Object.freeze([
    Object.freeze({ kind: "writer-db-v2" as const, fileName: fileNames.writerDbV2, required: true as const }),
    ...(input.drive.status === "required"
      ? [Object.freeze({ kind: "drive-v1-raw" as const, fileName: fileNames.driveV1Raw, required: true as const })]
      : []),
    Object.freeze({ kind: "manifest" as const, fileName: fileNames.manifest, required: true as const })
  ]);
  const plan: LegacySparkRetirementBackupPlan = Object.freeze({
    status: "planned",
    artifacts,
    manifest,
    nextAllowedStep: "verify-backup"
  });
  return Object.freeze({ ok: true as const, plan });
}
