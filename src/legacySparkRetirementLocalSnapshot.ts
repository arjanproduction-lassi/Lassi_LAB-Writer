import type { NewSparkDraft, Spark, WriterPackage, WriterPackageNote } from "./types";
import { parseWriterDbPayload, WRITER_DB_APP_NAME } from "./writerDb";
import { isWriterPackage } from "./writerPackageStorage";
import {
  buildLegacySparkBackupFileNames,
  type LegacySparkBackupVerificationReason
} from "./legacySparkRetirementBackupPlan";

export type LegacySparkRetirementRawStorageValue =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "present"; raw: string }>;

export type LegacySparkRetirementLocalSnapshotInput = Readonly<{
  createdAt: string;
  sparks: LegacySparkRetirementRawStorageValue;
  packages: LegacySparkRetirementRawStorageValue;
  draft: LegacySparkRetirementRawStorageValue;
}>;

type CapturedRawStorageValue = Readonly<{
  status: "missing" | "present";
  raw: string | null;
}>;

export type LegacySparkRetirementLocalSnapshotSummary = Readonly<{
  createdAt: string;
  sparkStorageStatus: "missing" | "present";
  packageStorageStatus: "missing" | "present";
  sparkCount: number;
  sparkLiveCount: number;
  sparkTombstoneCount: number;
  packageCount: number;
  packageLiveCount: number;
  packageTombstoneCount: number;
  noteCount: number;
  deletedNoteCount: number;
  draftPresent: false;
  sparkIds: readonly string[];
  packageIds: readonly string[];
}>;

export type LegacySparkRetirementLocalSnapshot = Readonly<{
  createdAt: string;
  sparkStorage: CapturedRawStorageValue;
  packageStorage: CapturedRawStorageValue;
  draftStorage: CapturedRawStorageValue;
  sparks: readonly Readonly<Spark>[];
  packages: readonly Readonly<WriterPackage>[];
}>;

export type LegacySparkRetirementLocalSnapshotResult =
  | Readonly<{
      status: "snapshot-captured";
      snapshot: LegacySparkRetirementLocalSnapshot;
      summary: LegacySparkRetirementLocalSnapshotSummary;
    }>
  | Readonly<{
      status: "incomplete" | "invalid";
      reasons: readonly LegacySparkBackupVerificationReason[];
    }>;

function failed(
  status: "incomplete" | "invalid",
  reason: LegacySparkBackupVerificationReason
): LegacySparkRetirementLocalSnapshotResult {
  return Object.freeze({ status, reasons: Object.freeze([reason]) });
}

function captured(value: LegacySparkRetirementRawStorageValue): CapturedRawStorageValue {
  return Object.freeze({
    status: value.status,
    raw: value.status === "present" ? value.raw : null
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

function cloneSpark(value: Spark): Readonly<Spark> {
  return Object.freeze({ ...value, tags: Object.freeze([...value.tags]) as string[] });
}

function cloneNote(value: WriterPackageNote): Readonly<WriterPackageNote> {
  return Object.freeze({ ...value });
}

function clonePackage(value: WriterPackage): Readonly<WriterPackage> {
  return Object.freeze({
    ...value,
    notes: Object.freeze(value.notes.map(cloneNote)) as WriterPackageNote[],
    ...(value.legacy ? { legacy: Object.freeze({ ...value.legacy }) } : {})
  });
}

function parseSparks(
  value: LegacySparkRetirementRawStorageValue,
  createdAt: string
): readonly Readonly<Spark>[] | LegacySparkRetirementLocalSnapshotResult {
  if (value.status === "missing") return Object.freeze([]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.raw);
  } catch {
    return failed("invalid", "SPARK_STORAGE_PARSE_FAILED");
  }
  if (!Array.isArray(parsed)) return failed("invalid", "SPARK_STORAGE_INVALID");
  const validation = parseWriterDbPayload({
    app: WRITER_DB_APP_NAME,
    schemaVersion: 1,
    exportedAt: createdAt,
    sparkCount: parsed.length,
    sparks: parsed
  });
  if (!validation.ok || validation.db.schemaVersion !== 1) {
    return failed("invalid", "SPARK_STORAGE_INVALID");
  }
  if (hasDuplicateIds(validation.db.sparks)) {
    return failed("invalid", "DUPLICATE_SPARK_ID");
  }
  return Object.freeze(validation.db.sparks.map(cloneSpark));
}

function parsePackages(
  value: LegacySparkRetirementRawStorageValue
): readonly Readonly<WriterPackage>[] | LegacySparkRetirementLocalSnapshotResult {
  if (value.status === "missing") return Object.freeze([]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.raw);
  } catch {
    return failed("invalid", "PACKAGE_STORAGE_PARSE_FAILED");
  }
  if (!Array.isArray(parsed) || !parsed.every(isWriterPackage)) {
    return failed("invalid", "PACKAGE_STORAGE_INVALID");
  }
  const packages = parsed as WriterPackage[];
  if (hasDuplicateIds(packages)) return failed("invalid", "DUPLICATE_PACKAGE_ID");
  return Object.freeze(packages.map(clonePackage));
}

function isValidDraft(value: unknown): value is NewSparkDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Partial<NewSparkDraft>;
  return typeof draft.text === "string" &&
    typeof draft.updatedAt === "string" &&
    !Number.isNaN(Date.parse(draft.updatedAt)) &&
    draft.schemaVersion === 1;
}

function inspectDraft(
  value: LegacySparkRetirementRawStorageValue
): LegacySparkRetirementLocalSnapshotResult | null {
  if (value.status === "missing") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.raw);
  } catch {
    return failed("invalid", "DRAFT_STORAGE_PARSE_FAILED");
  }
  if (!isValidDraft(parsed)) return failed("invalid", "DRAFT_STORAGE_INVALID");
  return parsed.text.trim().length > 0 ? failed("incomplete", "DRAFT_PRESENT") : null;
}

function isFailure(
  value: readonly unknown[] | LegacySparkRetirementLocalSnapshotResult
): value is LegacySparkRetirementLocalSnapshotResult {
  return !Array.isArray(value);
}

export function captureLegacySparkRetirementLocalSnapshotFromRaw(
  input: LegacySparkRetirementLocalSnapshotInput
): LegacySparkRetirementLocalSnapshotResult {
  try {
    buildLegacySparkBackupFileNames(input.createdAt);
  } catch {
    return failed("invalid", "INVALID_CREATED_AT");
  }

  const sparkStorage = captured(input.sparks);
  const packageStorage = captured(input.packages);
  const draftStorage = captured(input.draft);
  const draftFailure = inspectDraft(input.draft);
  if (draftFailure) return draftFailure;

  const sparks = parseSparks(input.sparks, input.createdAt);
  if (isFailure(sparks)) return sparks;
  const packages = parsePackages(input.packages);
  if (isFailure(packages)) return packages;

  const sparkTombstoneCount = sparks.reduce(
    (count, spark) => count + (spark.deletedAt === undefined ? 0 : 1), 0
  );
  const packageTombstoneCount = packages.reduce(
    (count, writerPackage) => count + (writerPackage.deletedAt === undefined ? 0 : 1), 0
  );
  const noteCount = packages.reduce((count, writerPackage) => count + writerPackage.notes.length, 0);
  const deletedNoteCount = packages.reduce(
    (count, writerPackage) => count + writerPackage.notes.reduce(
      (notes, note) => notes + (note.deletedAt === undefined ? 0 : 1), 0
    ), 0
  );
  const snapshot: LegacySparkRetirementLocalSnapshot = Object.freeze({
    createdAt: input.createdAt,
    sparkStorage,
    packageStorage,
    draftStorage,
    sparks,
    packages
  });
  const summary: LegacySparkRetirementLocalSnapshotSummary = Object.freeze({
    createdAt: input.createdAt,
    sparkStorageStatus: input.sparks.status,
    packageStorageStatus: input.packages.status,
    sparkCount: sparks.length,
    sparkLiveCount: sparks.length - sparkTombstoneCount,
    sparkTombstoneCount,
    packageCount: packages.length,
    packageLiveCount: packages.length - packageTombstoneCount,
    packageTombstoneCount,
    noteCount,
    deletedNoteCount,
    draftPresent: false,
    sparkIds: Object.freeze(sparks.map((spark) => spark.id).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)),
    packageIds: Object.freeze(packages.map((writerPackage) => writerPackage.id).sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
  });
  return Object.freeze({ status: "snapshot-captured" as const, snapshot, summary });
}
