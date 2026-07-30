import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";
import {
  captureLegacySparkRetirementLocalSnapshotFromRaw,
  type LegacySparkRetirementLocalSnapshotResult,
  type LegacySparkRetirementRawStorageValue
} from "./legacySparkRetirementLocalSnapshot";

export const LEGACY_SPARK_RETIREMENT_SPARK_STORAGE_KEY =
  "lassilab-writer:v0.1:sparks";
export const LEGACY_SPARK_RETIREMENT_PACKAGE_STORAGE_KEY =
  "lassilab-writer:v0.1:packages";
export const LEGACY_SPARK_RETIREMENT_DRAFT_STORAGE_KEY =
  "lassilab-writer:v0.1:draft:new-spark";

export type LegacySparkRetirementStorageReader =
  (key: string) => string | null;

export type LegacySparkRetirementLocalStorageCaptureInput = Readonly<{
  createdAt: string;
}>;

export type LegacySparkRetirementLocalStorageCaptureDependencies = Readonly<{
  readStorageValue: LegacySparkRetirementStorageReader;
}>;

function readFailed(
  reason: LegacySparkBackupVerificationReason
): LegacySparkRetirementLocalSnapshotResult {
  return Object.freeze({
    status: "invalid" as const,
    reasons: Object.freeze([reason])
  });
}

function rawStorageValue(value: string | null): LegacySparkRetirementRawStorageValue {
  return value === null
    ? Object.freeze({ status: "missing" as const })
    : Object.freeze({ status: "present" as const, raw: value });
}

export function captureLegacySparkRetirementLocalStorageSnapshot(
  input: LegacySparkRetirementLocalStorageCaptureInput,
  dependencies: LegacySparkRetirementLocalStorageCaptureDependencies
): LegacySparkRetirementLocalSnapshotResult {
  let sparksRaw: string | null;
  try {
    sparksRaw = dependencies.readStorageValue(LEGACY_SPARK_RETIREMENT_SPARK_STORAGE_KEY);
  } catch {
    return readFailed("SPARK_STORAGE_READ_FAILED");
  }

  let packagesRaw: string | null;
  try {
    packagesRaw = dependencies.readStorageValue(LEGACY_SPARK_RETIREMENT_PACKAGE_STORAGE_KEY);
  } catch {
    return readFailed("PACKAGE_STORAGE_READ_FAILED");
  }

  let draftRaw: string | null;
  try {
    draftRaw = dependencies.readStorageValue(LEGACY_SPARK_RETIREMENT_DRAFT_STORAGE_KEY);
  } catch {
    return readFailed("DRAFT_STORAGE_READ_FAILED");
  }

  return captureLegacySparkRetirementLocalSnapshotFromRaw({
    createdAt: input.createdAt,
    sparks: rawStorageValue(sparksRaw),
    packages: rawStorageValue(packagesRaw),
    draft: rawStorageValue(draftRaw)
  });
}
