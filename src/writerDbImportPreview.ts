import type { Spark, WriterPackage } from "./types";
import {
  parseWriterDbJson,
  previewWriterDbImport,
  type WriterDb,
  type WriterDbImportBlockingIssue,
  type WriterDbImportPreview
} from "./writerDb";

export type PrepareWriterDbImportPreviewInput = {
  jsonText: string;
  localSparks: readonly Spark[];
  localPackages: readonly WriterPackage[];
};

export type PrepareWriterDbImportPreviewResult =
  | {
      ok: true;
      db: WriterDb;
      preview: WriterDbImportPreview;
    }
  | {
      ok: false;
      error: string;
      blockingIssues: WriterDbImportBlockingIssue[];
    };

export function prepareWriterDbImportPreview(
  input: PrepareWriterDbImportPreviewInput
): PrepareWriterDbImportPreviewResult {
  const parsed = parseWriterDbJson(input.jsonText);

  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      blockingIssues: []
    };
  }

  const preview = previewWriterDbImport({
    incoming: parsed.db,
    localSparks: input.localSparks,
    localPackages: input.localPackages
  });

  if (preview.status === "blocked") {
    return {
      ok: false,
      error: "Writer DB obsahuje nejednoznacne duplicitne id.",
      blockingIssues: preview.blockingIssues
    };
  }

  return {
    ok: true,
    db: parsed.db,
    preview
  };
}
