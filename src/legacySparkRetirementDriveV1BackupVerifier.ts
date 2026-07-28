import {
  parseWriterDbPayload,
  WRITER_DB_APP_NAME,
  WRITER_DB_V1_SCHEMA_VERSION
} from "./writerDb";
import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";

export type DriveV1BackupVerificationInput =
  | Readonly<{ sourceStatus: "present"; rawJson: string }>
  | Readonly<{ sourceStatus: "not-applicable" }>
  | Readonly<{ sourceStatus: "required-but-missing" }>;

export type DriveV1BackupVerificationSummary = Readonly<{
  schemaVersion: 1;
  exportedAt: string;
  sparkCount: number;
  sparkLiveCount: number;
  sparkTombstoneCount: number;
  sparkIds: readonly string[];
}>;

export type DriveV1BackupVerificationResult =
  | Readonly<{
      status: "structure-verified";
      summary: DriveV1BackupVerificationSummary;
    }>
  | Readonly<{ status: "not-applicable" }>
  | Readonly<{
      status: "invalid";
      reasons: readonly LegacySparkBackupVerificationReason[];
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function invalid(
  reasons: readonly LegacySparkBackupVerificationReason[]
): DriveV1BackupVerificationResult {
  return Object.freeze({
    status: "invalid" as const,
    reasons: Object.freeze([...new Set(reasons)])
  });
}

function hasDuplicateIds(records: readonly { id: string }[]): boolean {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) return true;
    ids.add(record.id);
  }
  return false;
}

export function verifyLegacySparkRetirementDriveV1Backup(
  input: DriveV1BackupVerificationInput
): DriveV1BackupVerificationResult {
  if (input.sourceStatus === "not-applicable") {
    return Object.freeze({ status: "not-applicable" as const });
  }
  if (input.sourceStatus === "required-but-missing") {
    return invalid(["DRIVE_BACKUP_MISSING"]);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawJson);
  } catch {
    return invalid(["DRIVE_PARSE_FAILED"]);
  }

  if (!isRecord(payload)) return invalid(["DRIVE_CONTENT_INVALID"]);
  if (payload.app !== WRITER_DB_APP_NAME) return invalid(["DRIVE_APP_MISMATCH"]);
  if (payload.schemaVersion !== WRITER_DB_V1_SCHEMA_VERSION) {
    return invalid(["DRIVE_SCHEMA_MISMATCH"]);
  }
  if (!isNonNegativeInteger(payload.sparkCount)) {
    return invalid(["DRIVE_COUNT_MISMATCH"]);
  }

  const parsed = parseWriterDbPayload(payload);
  if (!parsed.ok || parsed.db.schemaVersion !== WRITER_DB_V1_SCHEMA_VERSION) {
    return invalid(["DRIVE_CONTENT_INVALID"]);
  }
  const db = parsed.db;
  if (db.sparkCount !== db.sparks.length) return invalid(["DRIVE_COUNT_MISMATCH"]);
  if (hasDuplicateIds(db.sparks)) return invalid(["DUPLICATE_SPARK_ID"]);

  const sparkTombstoneCount = db.sparks.reduce(
    (count, spark) => count + (spark.deletedAt === undefined ? 0 : 1),
    0
  );
  const sparkIds = Object.freeze(
    db.sparks.map((spark) => spark.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  );
  const summary: DriveV1BackupVerificationSummary = Object.freeze({
    schemaVersion: 1,
    exportedAt: db.exportedAt,
    sparkCount: db.sparks.length,
    sparkLiveCount: db.sparks.length - sparkTombstoneCount,
    sparkTombstoneCount,
    sparkIds
  });
  return Object.freeze({ status: "structure-verified" as const, summary });
}
