import type { Spark, WriterPackage } from "./types";
import {
  parseWriterDbPayload,
  WRITER_DB_APP_NAME,
  WRITER_DB_V2_SCHEMA_VERSION
} from "./writerDb";
import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";

export type WriterDbV2BackupVerificationSummary = Readonly<{
  schemaVersion: 2;
  sparkCount: number;
  sparkLiveCount: number;
  sparkTombstoneCount: number;
  packageCount: number;
  packageLiveCount: number;
  packageTombstoneCount: number;
  noteCount: number;
  deletedNoteCount: number;
  sparkIds: readonly string[];
  packageIds: readonly string[];
}>;

export type WriterDbV2BackupVerificationResult =
  | Readonly<{
      status: "structure-verified";
      summary: WriterDbV2BackupVerificationSummary;
    }>
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
): WriterDbV2BackupVerificationResult {
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

function sortedIds(records: readonly { id: string }[]): readonly string[] {
  return Object.freeze(
    records.map((record) => record.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

function countTombstones(records: readonly { deletedAt?: string }[]): number {
  return records.reduce((count, record) => count + (record.deletedAt === undefined ? 0 : 1), 0);
}

function countNotes(packages: readonly WriterPackage[]) {
  let noteCount = 0;
  let deletedNoteCount = 0;
  for (const writerPackage of packages) {
    noteCount += writerPackage.notes.length;
    deletedNoteCount += writerPackage.notes.reduce(
      (count, note) => count + (note.deletedAt === undefined ? 0 : 1),
      0
    );
  }
  return { noteCount, deletedNoteCount };
}

export function verifyLegacySparkRetirementWriterDbV2Backup(
  rawJson: string
): WriterDbV2BackupVerificationResult {
  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    return invalid(["WRITER_DB_PARSE_FAILED"]);
  }

  if (!isRecord(payload)) return invalid(["WRITER_DB_CONTENT_INVALID"]);
  if (payload.app !== WRITER_DB_APP_NAME) return invalid(["WRITER_DB_APP_MISMATCH"]);
  if (payload.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION) {
    return invalid(["WRITER_DB_SCHEMA_MISMATCH"]);
  }
  if (!isNonNegativeInteger(payload.sparkCount) || !isNonNegativeInteger(payload.packageCount)) {
    return invalid(["WRITER_DB_COUNT_MISMATCH"]);
  }

  const parsed = parseWriterDbPayload(payload);
  if (!parsed.ok || parsed.db.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION) {
    return invalid(["WRITER_DB_CONTENT_INVALID"]);
  }

  const db = parsed.db;
  if (db.sparkCount !== db.sparks.length || db.packageCount !== db.packages.length) {
    return invalid(["WRITER_DB_COUNT_MISMATCH"]);
  }

  const duplicateReasons: LegacySparkBackupVerificationReason[] = [];
  if (hasDuplicateIds(db.sparks)) duplicateReasons.push("DUPLICATE_SPARK_ID");
  if (hasDuplicateIds(db.packages)) duplicateReasons.push("DUPLICATE_PACKAGE_ID");
  if (duplicateReasons.length > 0) return invalid(duplicateReasons);

  const sparkTombstoneCount = countTombstones(db.sparks as readonly Spark[]);
  const packageTombstoneCount = countTombstones(db.packages);
  const { noteCount, deletedNoteCount } = countNotes(db.packages);
  const summary: WriterDbV2BackupVerificationSummary = Object.freeze({
    schemaVersion: 2,
    sparkCount: db.sparks.length,
    sparkLiveCount: db.sparks.length - sparkTombstoneCount,
    sparkTombstoneCount,
    packageCount: db.packages.length,
    packageLiveCount: db.packages.length - packageTombstoneCount,
    packageTombstoneCount,
    noteCount,
    deletedNoteCount,
    sparkIds: sortedIds(db.sparks),
    packageIds: sortedIds(db.packages)
  });

  return Object.freeze({ status: "structure-verified" as const, summary });
}
