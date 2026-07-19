import type { WriterDb, WriterDbImportBlockingIssue, WriterDbImportPreview } from "./writerDb";
import type { WriterDbImportPreflightResult } from "./writerDbImportPreflight";

export type WriterDbImportPreviewUiState =
  | { status: "idle" }
  | { status: "reading-file"; fileName: string }
  | {
      status: "preview-ready";
      fileName: string;
      db: WriterDb;
      preview: WriterDbImportPreview;
    }
  | {
      status: "preview-blocked";
      fileName: string;
      error: string;
      blockingIssues: WriterDbImportBlockingIssue[];
    }
  | {
      status: "preview-stale";
      fileName: string;
      db: WriterDb;
      previousPreview: WriterDbImportPreview;
      refreshedPreview: WriterDbImportPreview;
      message: string;
    }
  | {
      status: "preview-confirmed-ready";
      fileName: string;
      db: WriterDb;
      preview: WriterDbImportPreview;
      message: string;
    }
  | {
      status: "preflight-blocked";
      fileName: string;
      db: WriterDb;
      reason: "recovery-required" | "recovery-blocked" | "preview-blocked";
      message: string;
      preview?: WriterDbImportPreview;
    };

export type WriterDbImportPreviewUiAction =
  | "check-readiness"
  | "choose-file"
  | "close";

export function resetWriterDbImportPreviewUiState(): WriterDbImportPreviewUiState {
  return { status: "idle" };
}

export function getWriterDbImportPreviewUiActions(
  state: WriterDbImportPreviewUiState
): WriterDbImportPreviewUiAction[] {
  switch (state.status) {
    case "preview-ready":
    case "preview-stale":
      return ["check-readiness", "close"];
    case "preview-confirmed-ready":
    case "preview-blocked":
    case "preflight-blocked":
      return ["choose-file", "close"];
    default:
      return [];
  }
}

function blockedMessage(reason: "recovery-required" | "recovery-blocked" | "preview-blocked") {
  switch (reason) {
    case "recovery-required":
      return "Predchádzajúca databázová operácia zostala nedokončená. Pred novým importom bude potrebné vykonať kontrolu obnovy.";
    case "recovery-blocked":
      return "Predchádzajúcu databázovú operáciu nemožno bezpečne vyhodnotiť. Nový import je zablokovaný.";
    case "preview-blocked":
      return "Aktualizovaný náhľad importu už nie je bezpečne použiteľný. Nič nebolo zmenené.";
  }
}

export function applyWriterDbImportPreflightResult(
  state: Extract<WriterDbImportPreviewUiState, { status: "preview-ready" | "preview-stale" }>,
  result: WriterDbImportPreflightResult
): WriterDbImportPreviewUiState {
  if (result.status === "ready") {
    return {
      status: "preview-confirmed-ready",
      fileName: state.fileName,
      db: state.db,
      preview: result.preview,
      message: "Náhľad je aktuálny. Miestne dáta sa od jeho vytvorenia nezmenili."
    };
  }

  if (result.status === "stale") {
    return {
      status: "preview-stale",
      fileName: state.fileName,
      db: state.db,
      previousPreview: result.previousPreview,
      refreshedPreview: result.refreshedPreview,
      message: "Miestne dáta sa medzitým zmenili. Skontrolujte aktualizovaný náhľad."
    };
  }

  return {
    status: "preflight-blocked",
    fileName: state.fileName,
    db: state.db,
    reason: result.reason,
    message: blockedMessage(result.reason),
    ...(result.preview ? { preview: result.preview } : {})
  };
}
