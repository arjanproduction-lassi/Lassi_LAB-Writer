import type { PrepareWriterDbImportPreviewResult } from "./writerDbImportPreview";
import type { WriterDbImportPreflightResult } from "./writerDbImportPreflight";
import type { ExecuteWriterDbImportResult } from "./writerDbImportCoordinator";
import {
  transitionWriterDbImportUiState,
  type WriterDbImportUiState,
  type WriterDbImportUiTransitionResult
} from "./writerDbImportUiState";

export const WRITER_DB_IMPORT_STALE_MESSAGE =
  "Miestne dáta sa medzitým zmenili. Import nebol spustený. Skontrolujte aktualizovaný náhľad a potvrďte ho znova.";

type NonStaleCoordinatorResult = Exclude<ExecuteWriterDbImportResult, { status: "stale" }>;

export type ApplyWriterDbCoordinatorResultInput =
  | {
      result: Extract<ExecuteWriterDbImportResult, { status: "stale" }>;
      refreshedRevision: string;
    }
  | {
      result: NonStaleCoordinatorResult;
      refreshedRevision?: never;
    };

export function applyWriterDbFileSelected(
  state: WriterDbImportUiState,
  fileName: string
): WriterDbImportUiTransitionResult {
  return transitionWriterDbImportUiState(state, { type: "file-selected", fileName });
}

export function applyWriterDbPreparedPreview(
  state: WriterDbImportUiState,
  input: {
    fileName: string;
    result: PrepareWriterDbImportPreviewResult;
    revision: string;
  }
): WriterDbImportUiTransitionResult {
  if (!input.result.ok) {
    return transitionWriterDbImportUiState(state, {
      type: "preview-blocked",
      fileName: input.fileName,
      error: input.result.error,
      blockingIssues: input.result.blockingIssues
    });
  }

  return transitionWriterDbImportUiState(state, {
    type: "preview-ready",
    fileName: input.fileName,
    db: input.result.db,
    preview: input.result.preview,
    revision: input.revision
  });
}

export function applyWriterDbPreflightResult(
  state: WriterDbImportUiState,
  input: { result: WriterDbImportPreflightResult; revision: string }
): WriterDbImportUiTransitionResult {
  switch (input.result.status) {
    case "ready":
      return transitionWriterDbImportUiState(state, {
        type: "preflight-ready",
        preview: input.result.preview,
        revision: input.revision
      });
    case "stale":
      return transitionWriterDbImportUiState(state, {
        type: "preflight-stale",
        refreshedPreview: input.result.refreshedPreview,
        revision: input.revision,
        message: WRITER_DB_IMPORT_STALE_MESSAGE
      });
    case "blocked":
      return transitionWriterDbImportUiState(state, {
        type: "preflight-blocked",
        error: input.result.error,
        reason: input.result.reason,
        ...(input.result.preview
          ? {
              preview: input.result.preview,
              blockingIssues: input.result.preview.blockingIssues
            }
          : {})
      });
  }
}

export function requestWriterDbImportStart(
  state: WriterDbImportUiState,
  confirmedRevision: string
): WriterDbImportUiTransitionResult {
  return transitionWriterDbImportUiState(state, {
    type: "import-started",
    revision: confirmedRevision
  });
}

export function applyWriterDbCoordinatorResult(
  state: WriterDbImportUiState,
  input: ApplyWriterDbCoordinatorResultInput
): WriterDbImportUiTransitionResult {
  switch (input.result.status) {
    case "success":
      return transitionWriterDbImportUiState(state, {
        type: "import-success",
        result: input.result
      });
    case "stale":
      return transitionWriterDbImportUiState(state, {
        type: "import-stale",
        preview: input.result.refreshedPreview,
        revision: input.refreshedRevision as string,
        message: WRITER_DB_IMPORT_STALE_MESSAGE
      });
    case "blocked":
      return transitionWriterDbImportUiState(state, {
        type: "import-blocked",
        error: input.result.error,
        reason: input.result.reason,
        ...(input.result.preview
          ? {
              preview: input.result.preview,
              blockingIssues: input.result.preview.blockingIssues
            }
          : {})
      });
    case "failed":
      return transitionWriterDbImportUiState(state, {
        type: "import-failed",
        result: input.result
      });
  }
}

export function resetWriterDbImportUi(
  state: WriterDbImportUiState
): WriterDbImportUiTransitionResult {
  return transitionWriterDbImportUiState(state, { type: "reset" });
}
