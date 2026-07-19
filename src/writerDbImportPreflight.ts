import type { Spark, WriterPackage } from "./types";
import {
  previewWriterDbImport,
  type WriterDb,
  type WriterDbImportPreview
} from "./writerDb";
import type { WriterDbRecoveryInspection } from "./writerDbRecovery";

export type WriterDbImportPreflightInput = {
  db: WriterDb;
  previousPreview: WriterDbImportPreview;
  currentLocalSparks: readonly Spark[];
  currentLocalPackages: readonly WriterPackage[];
  recoveryInspection: WriterDbRecoveryInspection;
};

export type WriterDbImportPreflightResult =
  | {
      status: "ready";
      preview: WriterDbImportPreview;
    }
  | {
      status: "stale";
      previousPreview: WriterDbImportPreview;
      refreshedPreview: WriterDbImportPreview;
    }
  | {
      status: "blocked";
      reason: "recovery-required" | "recovery-blocked" | "preview-blocked";
      error: string;
      preview?: WriterDbImportPreview;
    };

function comparablePreview(preview: WriterDbImportPreview) {
  return {
    schemaVersion: preview.schemaVersion,
    status: preview.status,
    source: preview.source,
    sparks: preview.sparks,
    packages: preview.packages,
    warnings: preview.warnings,
    blockingIssues: preview.blockingIssues
  };
}

export function areWriterDbImportPreviewsEquivalent(
  a: WriterDbImportPreview,
  b: WriterDbImportPreview
): boolean {
  return JSON.stringify(comparablePreview(a)) === JSON.stringify(comparablePreview(b));
}

export function prepareWriterDbImportPreflight(
  input: WriterDbImportPreflightInput
): WriterDbImportPreflightResult {
  if (input.recoveryInspection.status === "recoverable") {
    return {
      status: "blocked",
      reason: "recovery-required",
      error: "Predchadzajuci import vyzaduje obnovu pred novym importom."
    };
  }

  if (input.recoveryInspection.status === "blocked") {
    return {
      status: "blocked",
      reason: "recovery-blocked",
      error: "Predchadzajuci import sa neda bezpecne obnovit bez kontroly."
    };
  }

  const refreshedPreview = previewWriterDbImport({
    incoming: input.db,
    localSparks: input.currentLocalSparks,
    localPackages: input.currentLocalPackages
  });

  if (refreshedPreview.status === "blocked") {
    return {
      status: "blocked",
      reason: "preview-blocked",
      error: "Aktualizovany nahlad importu je blokovany.",
      preview: refreshedPreview
    };
  }

  if (areWriterDbImportPreviewsEquivalent(input.previousPreview, refreshedPreview)) {
    return { status: "ready", preview: refreshedPreview };
  }

  return {
    status: "stale",
    previousPreview: input.previousPreview,
    refreshedPreview
  };
}
