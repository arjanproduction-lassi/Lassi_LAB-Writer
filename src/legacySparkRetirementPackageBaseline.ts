import type { WriterPackage, WriterPackageNote } from "./types";
import { isWriterPackage } from "./writerPackageStorage";
import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";

export type LegacySparkRetirementSha256Hasher = (
  canonicalUtf8Text: string
) => string | Promise<string>;

export type LegacySparkRetirementPackageBaselineInput = Readonly<{
  packages: readonly WriterPackage[];
  hashCanonicalUtf8Sha256: LegacySparkRetirementSha256Hasher;
  rawStorageSha256?: string | null;
}>;

export type LegacySparkRetirementPackageBaseline = Readonly<{
  packageCount: number;
  packageLiveCount: number;
  packageTombstoneCount: number;
  noteCount: number;
  deletedNoteCount: number;
  packageIds: readonly string[];
  semanticPackageSha256: string;
  rawStorageSha256: string | null;
}>;

export type LegacySparkRetirementPackageBaselineResult =
  | Readonly<{
      status: "baseline-built";
      baseline: LegacySparkRetirementPackageBaseline;
    }>
  | Readonly<{
      status: "invalid";
      reasons: readonly LegacySparkBackupVerificationReason[];
    }>;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const PACKAGE_KEYS = new Set([
  "id", "title", "sparkText", "notes", "workshopText", "finalText",
  "createdAt", "updatedAt", "deletedAt", "packageVersion", "legacy"
]);
const NOTE_KEYS = new Set(["id", "text", "createdAt", "updatedAt", "deletedAt"]);
const LEGACY_KEYS = new Set(["source", "stage"]);

function invalid(
  reason: LegacySparkBackupVerificationReason
): LegacySparkRetirementPackageBaselineResult {
  return Object.freeze({
    status: "invalid" as const,
    reasons: Object.freeze([reason])
  });
}

function hasOnlyKeys(value: object, allowed: ReadonlySet<string>): boolean {
  return Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && allowed.has(key)
  );
}

function hasUndefinedOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key) &&
    (value as Record<string, unknown>)[key] === undefined;
}

function hasCanonicalShape(writerPackage: WriterPackage): boolean {
  if (!hasOnlyKeys(writerPackage, PACKAGE_KEYS)) return false;
  if (hasUndefinedOwn(writerPackage, "deletedAt") || hasUndefinedOwn(writerPackage, "legacy")) {
    return false;
  }
  for (const note of writerPackage.notes) {
    if (!hasOnlyKeys(note, NOTE_KEYS) || hasUndefinedOwn(note, "deletedAt")) return false;
  }
  if (writerPackage.legacy) {
    if (!hasOnlyKeys(writerPackage.legacy, LEGACY_KEYS) || hasUndefinedOwn(writerPackage.legacy, "stage")) {
      return false;
    }
  }
  return true;
}

function canonicalNote(note: WriterPackageNote) {
  return {
    id: note.id,
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    ...(note.deletedAt !== undefined ? { deletedAt: note.deletedAt } : {})
  };
}

function canonicalPackage(writerPackage: WriterPackage) {
  return {
    id: writerPackage.id,
    title: writerPackage.title,
    sparkText: writerPackage.sparkText,
    notes: writerPackage.notes.map(canonicalNote),
    workshopText: writerPackage.workshopText,
    finalText: writerPackage.finalText,
    createdAt: writerPackage.createdAt,
    updatedAt: writerPackage.updatedAt,
    ...(writerPackage.deletedAt !== undefined ? { deletedAt: writerPackage.deletedAt } : {}),
    packageVersion: writerPackage.packageVersion,
    ...(writerPackage.legacy
      ? {
          legacy: {
            source: writerPackage.legacy.source,
            ...(writerPackage.legacy.stage !== undefined
              ? { stage: writerPackage.legacy.stage }
              : {})
          }
        }
      : {})
  };
}

export async function buildLegacySparkRetirementPackageBaseline(
  input: LegacySparkRetirementPackageBaselineInput
): Promise<LegacySparkRetirementPackageBaselineResult> {
  const packageIds = new Set<string>();
  for (const candidate of input.packages) {
    let valid = false;
    try {
      valid = isWriterPackage(candidate) && hasCanonicalShape(candidate);
    } catch {
      valid = false;
    }
    if (!valid) return invalid("PACKAGE_DATA_INVALID");
    if (packageIds.has(candidate.id)) return invalid("DUPLICATE_PACKAGE_ID");
    packageIds.add(candidate.id);
  }

  const rawStorageSha256 = input.rawStorageSha256 ?? null;
  if (rawStorageSha256 !== null && !SHA256_HEX.test(rawStorageSha256)) {
    return invalid("PACKAGE_RAW_HASH_INVALID");
  }

  const sortedPackages = [...input.packages].sort(
    (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const sortedPackageIds = sortedPackages.map((writerPackage) => writerPackage.id);
  let packageTombstoneCount = 0;
  let noteCount = 0;
  let deletedNoteCount = 0;
  for (const writerPackage of sortedPackages) {
    if (writerPackage.deletedAt !== undefined) packageTombstoneCount += 1;
    noteCount += writerPackage.notes.length;
    deletedNoteCount += writerPackage.notes.reduce(
      (count, note) => count + (note.deletedAt === undefined ? 0 : 1),
      0
    );
  }
  let canonicalText: string;
  try {
    canonicalText = JSON.stringify(sortedPackages.map(canonicalPackage));
  } catch {
    return invalid("PACKAGE_DATA_INVALID");
  }

  let semanticPackageSha256: unknown;
  try {
    semanticPackageSha256 = await input.hashCanonicalUtf8Sha256(canonicalText);
  } catch {
    return invalid("PACKAGE_SEMANTIC_HASH_FAILED");
  }
  if (typeof semanticPackageSha256 !== "string" || !SHA256_HEX.test(semanticPackageSha256)) {
    return invalid("PACKAGE_SEMANTIC_HASH_INVALID");
  }

  const baseline: LegacySparkRetirementPackageBaseline = Object.freeze({
    packageCount: sortedPackages.length,
    packageLiveCount: sortedPackages.length - packageTombstoneCount,
    packageTombstoneCount,
    noteCount,
    deletedNoteCount,
    packageIds: Object.freeze(sortedPackageIds),
    semanticPackageSha256,
    rawStorageSha256
  });
  return Object.freeze({ status: "baseline-built" as const, baseline });
}
