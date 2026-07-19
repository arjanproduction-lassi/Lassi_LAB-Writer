import type { WriterDbImportPreview } from "./writerDb";

function semanticWriterDbImportPreview(preview: WriterDbImportPreview) {
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

export function createWriterDbImportPreviewRevision(
  preview: WriterDbImportPreview
): string {
  return `writer-db-preview:v1:${JSON.stringify(semanticWriterDbImportPreview(preview))}`;
}
