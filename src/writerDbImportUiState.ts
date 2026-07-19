import type {
  WriterDb,
  WriterDbImportBlockingIssue,
  WriterDbImportPreview
} from "./writerDb";
import type { ExecuteWriterDbImportResult } from "./writerDbImportCoordinator";
import { areWriterDbImportPreviewsEquivalent } from "./writerDbImportPreflight";

export type ExecuteWriterDbImportSuccessResult = Extract<
  ExecuteWriterDbImportResult,
  { status: "success" }
>;

export type ExecuteWriterDbImportFailedResult = Extract<
  ExecuteWriterDbImportResult,
  { status: "failed" }
>;

export type WriterDbImportUiBlockedReason = Extract<
  ExecuteWriterDbImportResult,
  { status: "blocked" }
>["reason"];

export type WriterDbImportUiState =
  | { status: "idle" }
  | { status: "reading-file"; fileName: string }
  | {
      status: "preview-ready";
      fileName: string;
      db: WriterDb;
      preview: WriterDbImportPreview;
      previewRevision: string;
    }
  | {
      status: "preview-blocked";
      fileName: string;
      error: string;
      blockingIssues: WriterDbImportBlockingIssue[];
      reason?: WriterDbImportUiBlockedReason;
      preview?: WriterDbImportPreview;
    }
  | {
      status: "preview-stale";
      fileName: string;
      db: WriterDb;
      preview: WriterDbImportPreview;
      previewRevision: string;
      message: string;
    }
  | {
      status: "import-confirm-ready";
      fileName: string;
      db: WriterDb;
      confirmedPreview: WriterDbImportPreview;
      confirmedRevision: string;
    }
  | {
      status: "importing";
      fileName: string;
      db: WriterDb;
      confirmedPreview: WriterDbImportPreview;
      confirmedRevision: string;
    }
  | {
      status: "success";
      fileName: string;
      result: ExecuteWriterDbImportSuccessResult;
    }
  | {
      status: "failed";
      fileName: string;
      result: ExecuteWriterDbImportFailedResult;
      canSafelyClose: boolean;
    };

export type WriterDbImportUiEvent =
  | { type: "file-selected"; fileName: string }
  | {
      type: "preview-ready";
      fileName: string;
      db: WriterDb;
      preview: WriterDbImportPreview;
      revision: string;
    }
  | {
      type: "preview-blocked";
      fileName: string;
      error: string;
      blockingIssues: WriterDbImportBlockingIssue[];
    }
  | {
      type: "preflight-ready";
      preview: WriterDbImportPreview;
      revision: string;
    }
  | {
      type: "preflight-stale";
      refreshedPreview: WriterDbImportPreview;
      revision: string;
      message: string;
    }
  | {
      type: "preflight-blocked";
      error: string;
      reason: Extract<
        WriterDbImportUiBlockedReason,
        "recovery-required" | "recovery-blocked" | "preview-blocked"
      >;
      preview?: WriterDbImportPreview;
      blockingIssues?: WriterDbImportBlockingIssue[];
    }
  | { type: "import-started"; revision: string }
  | { type: "import-success"; result: ExecuteWriterDbImportSuccessResult }
  | {
      type: "import-stale";
      preview: WriterDbImportPreview;
      revision: string;
      message: string;
    }
  | {
      type: "import-blocked";
      error: string;
      reason: WriterDbImportUiBlockedReason;
      preview?: WriterDbImportPreview;
      blockingIssues?: WriterDbImportBlockingIssue[];
    }
  | { type: "import-failed"; result: ExecuteWriterDbImportFailedResult }
  | { type: "reset" };

export type WriterDbImportUiTransitionResult =
  | { accepted: true; state: WriterDbImportUiState }
  | { accepted: false; state: WriterDbImportUiState; reason: string };

function accepted(state: WriterDbImportUiState): WriterDbImportUiTransitionResult {
  return { accepted: true, state };
}

function rejected(
  state: WriterDbImportUiState,
  event: WriterDbImportUiEvent,
  reason = "Udalost nie je v aktualnom stave povolena."
): WriterDbImportUiTransitionResult {
  return {
    accepted: false,
    state,
    reason: `${reason} (${state.status} -> ${event.type})`
  };
}

function previewBlockedState(
  fileName: string,
  event: Extract<WriterDbImportUiEvent, { type: "preflight-blocked" | "import-blocked" }>
): WriterDbImportUiState {
  return {
    status: "preview-blocked",
    fileName,
    error: event.error,
    blockingIssues: event.blockingIssues ?? [],
    reason: event.reason,
    ...(event.preview ? { preview: event.preview } : {})
  };
}

export function canSafelyCloseWriterDbImportFailure(
  result: ExecuteWriterDbImportFailedResult
): boolean {
  if (result.stage !== "persistence" || result.transactionMarkerRemaining !== false) {
    return false;
  }

  if (!result.rollbackAttempted) {
    return true;
  }

  return result.rollbackSucceeded;
}

function transitionPreviewState(
  state: Extract<WriterDbImportUiState, { status: "preview-ready" | "preview-stale" }>,
  event: WriterDbImportUiEvent
): WriterDbImportUiTransitionResult {
  if (event.type === "file-selected") {
    return accepted({ status: "reading-file", fileName: event.fileName });
  }

  if (event.type === "reset") {
    return accepted({ status: "idle" });
  }

  if (event.type === "preflight-ready") {
    const currentPreview = state.preview;
    if (
      event.revision !== state.previewRevision ||
      !areWriterDbImportPreviewsEquivalent(event.preview, currentPreview)
    ) {
      return rejected(state, event, "Preflight nezodpoveda aktualnej revizii nahladu.");
    }

    return accepted({
      status: "import-confirm-ready",
      fileName: state.fileName,
      db: state.db,
      confirmedPreview: event.preview,
      confirmedRevision: event.revision
    });
  }

  if (event.type === "preflight-stale") {
    return accepted({
      status: "preview-stale",
      fileName: state.fileName,
      db: state.db,
      preview: event.refreshedPreview,
      previewRevision: event.revision,
      message: event.message
    });
  }

  if (event.type === "preflight-blocked") {
    return accepted(previewBlockedState(state.fileName, event));
  }

  return rejected(state, event);
}

export function transitionWriterDbImportUiState(
  state: WriterDbImportUiState,
  event: WriterDbImportUiEvent
): WriterDbImportUiTransitionResult {
  switch (state.status) {
    case "idle":
      return event.type === "file-selected"
        ? accepted({ status: "reading-file", fileName: event.fileName })
        : rejected(state, event);

    case "reading-file":
      if (event.type === "preview-ready") {
        return accepted({
          status: "preview-ready",
          fileName: event.fileName,
          db: event.db,
          preview: event.preview,
          previewRevision: event.revision
        });
      }
      if (event.type === "preview-blocked") {
        return accepted({
          status: "preview-blocked",
          fileName: event.fileName,
          error: event.error,
          blockingIssues: event.blockingIssues
        });
      }
      return event.type === "reset" ? accepted({ status: "idle" }) : rejected(state, event);

    case "preview-ready":
    case "preview-stale":
      return transitionPreviewState(state, event);

    case "preview-blocked":
      if (event.type === "file-selected") {
        return accepted({ status: "reading-file", fileName: event.fileName });
      }
      return event.type === "reset" ? accepted({ status: "idle" }) : rejected(state, event);

    case "import-confirm-ready":
      if (event.type === "import-started") {
        if (event.revision !== state.confirmedRevision) {
          return rejected(state, event, "Import pouzil neaktualnu potvrdenu reviziu.");
        }
        return accepted({
          status: "importing",
          fileName: state.fileName,
          db: state.db,
          confirmedPreview: state.confirmedPreview,
          confirmedRevision: state.confirmedRevision
        });
      }
      if (event.type === "file-selected") {
        return accepted({ status: "reading-file", fileName: event.fileName });
      }
      return event.type === "reset" ? accepted({ status: "idle" }) : rejected(state, event);

    case "importing":
      if (event.type === "import-success") {
        return accepted({ status: "success", fileName: state.fileName, result: event.result });
      }
      if (event.type === "import-stale") {
        return accepted({
          status: "preview-stale",
          fileName: state.fileName,
          db: state.db,
          preview: event.preview,
          previewRevision: event.revision,
          message: event.message
        });
      }
      if (event.type === "import-blocked") {
        return accepted(previewBlockedState(state.fileName, event));
      }
      if (event.type === "import-failed") {
        return accepted({
          status: "failed",
          fileName: state.fileName,
          result: event.result,
          canSafelyClose: canSafelyCloseWriterDbImportFailure(event.result)
        });
      }
      return rejected(state, event, "Import prave prebieha.");

    case "success":
      return event.type === "reset" ? accepted({ status: "idle" }) : rejected(state, event);

    case "failed":
      if (event.type !== "reset") {
        return rejected(state, event);
      }
      return state.canSafelyClose && canSafelyCloseWriterDbImportFailure(state.result)
        ? accepted({ status: "idle" })
        : rejected(state, event, "Neuzavrety import vyzaduje kontrolu obnovy.");
  }
}
