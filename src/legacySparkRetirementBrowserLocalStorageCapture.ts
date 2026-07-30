import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";
import {
  captureLegacySparkRetirementLocalStorageSnapshot,
  type LegacySparkRetirementLocalStorageCaptureInput
} from "./legacySparkRetirementLocalStorageCapture";
import type { LegacySparkRetirementLocalSnapshotResult } from "./legacySparkRetirementLocalSnapshot";

export type LegacySparkRetirementBrowserStorage = Readonly<{
  getItem: (key: string) => string | null;
}>;

export type LegacySparkRetirementBrowserLocalStorageDependencies = Readonly<{
  getLocalStorage: () => LegacySparkRetirementBrowserStorage | null | undefined;
}>;

function unavailable(
  reason: LegacySparkBackupVerificationReason = "LOCAL_STORAGE_UNAVAILABLE"
): LegacySparkRetirementLocalSnapshotResult {
  return Object.freeze({
    status: "invalid" as const,
    reasons: Object.freeze([reason])
  });
}

export function captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(
  input: LegacySparkRetirementLocalStorageCaptureInput,
  dependencies: LegacySparkRetirementBrowserLocalStorageDependencies
): LegacySparkRetirementLocalSnapshotResult {
  let storage: LegacySparkRetirementBrowserStorage;
  try {
    const candidate = dependencies.getLocalStorage();
    if (!candidate || typeof candidate.getItem !== "function") return unavailable();
    storage = candidate;
  } catch {
    return unavailable();
  }

  return captureLegacySparkRetirementLocalStorageSnapshot(input, {
    readStorageValue: (key) => storage.getItem(key)
  });
}

export function captureLegacySparkRetirementBrowserLocalStorageSnapshot(
  input: LegacySparkRetirementLocalStorageCaptureInput
): LegacySparkRetirementLocalSnapshotResult {
  return captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(input, {
    getLocalStorage: () => typeof window === "undefined" ? null : window.localStorage
  });
}
