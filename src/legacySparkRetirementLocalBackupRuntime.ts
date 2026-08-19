import { captureLegacySparkRetirementBrowserLocalStorageSnapshot } from "./legacySparkRetirementBrowserLocalStorageCapture";
import {
  createLegacySparkRetirementLocalCaptureSession,
  type LegacySparkRetirementLocalCaptureSessionDependencies
} from "./legacySparkRetirementLocalCaptureSession";
import type { LegacySparkRetirementLocalSnapshotResult } from "./legacySparkRetirementLocalSnapshot";
import {
  createLegacySparkRetirementMinimalUiCaptureController,
  type LegacySparkRetirementMinimalUiCaptureController
} from "./legacySparkRetirementMinimalUiCaptureController";

export type LegacySparkRetirementLocalBackupRuntimeDependencies = Readonly<{
  getCurrentTimeMilliseconds: () => number;
  captureLocalSnapshot: (
    input: Readonly<{ createdAt: string }>
  ) => LegacySparkRetirementLocalSnapshotResult;
}>;

function createCanonicalUtcSecondTimestamp(
  getCurrentTimeMilliseconds: () => number
): string {
  const currentTimeMilliseconds = getCurrentTimeMilliseconds();
  if (!Number.isFinite(currentTimeMilliseconds)) throw new RangeError();

  const wholeSecondMilliseconds = Math.floor(currentTimeMilliseconds / 1000) * 1000;
  const timestamp = new Date(wholeSecondMilliseconds).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(timestamp)) {
    throw new RangeError();
  }
  return timestamp;
}

export function createLegacySparkRetirementLocalBackupControllerWithDependencies(
  dependencies: LegacySparkRetirementLocalBackupRuntimeDependencies
): LegacySparkRetirementMinimalUiCaptureController {
  const sessionDependencies: LegacySparkRetirementLocalCaptureSessionDependencies = Object.freeze({
    createCanonicalTimestamp: () =>
      createCanonicalUtcSecondTimestamp(dependencies.getCurrentTimeMilliseconds),
    captureLocalSnapshot: dependencies.captureLocalSnapshot
  });

  return createLegacySparkRetirementMinimalUiCaptureController(Object.freeze({
    createSession: () => createLegacySparkRetirementLocalCaptureSession(sessionDependencies)
  }));
}

export function createLegacySparkRetirementLocalBackupController(
): LegacySparkRetirementMinimalUiCaptureController {
  return createLegacySparkRetirementLocalBackupControllerWithDependencies(Object.freeze({
    getCurrentTimeMilliseconds: () => Date.now(),
    captureLocalSnapshot: captureLegacySparkRetirementBrowserLocalStorageSnapshot
  }));
}
