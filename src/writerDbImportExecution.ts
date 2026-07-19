import type { Spark, WriterPackage } from "./types";
import {
  createWriterDbImportBackup,
  mergeWriterDbInMemory,
  type WriterDb,
  type WriterDbImportBackup,
  type WriterDbImportPreview
} from "./writerDb";
import { prepareWriterDbImportPreflight } from "./writerDbImportPreflight";
import type { WriterDbRecoveryInspection } from "./writerDbRecovery";

export type PrepareWriterDbImportExecutionInput = {
  db: WriterDb;
  previousPreview: WriterDbImportPreview;
  currentLocalSparks: readonly Spark[];
  currentLocalPackages: readonly WriterPackage[];
  recoveryInspection: WriterDbRecoveryInspection;
  backupCreatedAt: string;
};

export type WriterDbImportExecutionResult =
  | {
      status: "ready";
      preview: WriterDbImportPreview;
      mergedSparks: Spark[];
      mergedPackages: WriterPackage[];
      backup: WriterDbImportBackup;
      sourceSchemaVersion: 1 | 2;
    }
  | {
      status: "stale";
      previousPreview: WriterDbImportPreview;
      refreshedPreview: WriterDbImportPreview;
    }
  | {
      status: "blocked";
      reason:
        | "recovery-required"
        | "recovery-blocked"
        | "preview-blocked"
        | "merge-failed"
        | "backup-failed";
      error: string;
      preview?: WriterDbImportPreview;
    };

export function prepareWriterDbImportExecution(
  input: PrepareWriterDbImportExecutionInput
): WriterDbImportExecutionResult {
  const preflight = prepareWriterDbImportPreflight({
    db: input.db,
    previousPreview: input.previousPreview,
    currentLocalSparks: input.currentLocalSparks,
    currentLocalPackages: input.currentLocalPackages,
    recoveryInspection: input.recoveryInspection
  });

  if (preflight.status === "stale") {
    return preflight;
  }

  if (preflight.status === "blocked") {
    return preflight;
  }

  const merged = mergeWriterDbInMemory({
    incoming: input.db,
    localSparks: input.currentLocalSparks,
    localPackages: input.currentLocalPackages
  });

  if (!merged.ok) {
    return {
      status: "blocked",
      reason: "merge-failed",
      error: merged.error,
      preview: merged.preview
    };
  }

  const backup = createWriterDbImportBackup({
    sourceSchemaVersion: input.db.schemaVersion,
    localSparks: input.currentLocalSparks,
    localPackages: input.currentLocalPackages,
    now: input.backupCreatedAt
  });

  if (!backup.ok) {
    return {
      status: "blocked",
      reason: "backup-failed",
      error: backup.error,
      preview: preflight.preview
    };
  }

  return {
    status: "ready",
    preview: preflight.preview,
    mergedSparks: merged.sparks,
    mergedPackages: merged.packages,
    backup: backup.backup,
    sourceSchemaVersion: input.db.schemaVersion
  };
}
