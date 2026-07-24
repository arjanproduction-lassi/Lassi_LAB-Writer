import type { WriterPackage } from "./types";
import {
  buildWriterLibraryReadOnlySnapshot,
  type WriterLibraryReadOnlySnapshot
} from "./writerLibraryReadOnlySnapshot";

export type WriterPackageCatalogLoader = () => readonly WriterPackage[];

export type WriterLibraryReadOnlyResult =
  | Readonly<{
      status: "ready";
      snapshot: WriterLibraryReadOnlySnapshot;
    }>
  | Readonly<{
      status: "failed";
      reason: "catalog-load-failed";
    }>;

export function loadWriterLibraryReadOnly(
  loader: WriterPackageCatalogLoader
): WriterLibraryReadOnlyResult {
  try {
    const catalog = loader();
    return Object.freeze({
      status: "ready",
      snapshot: buildWriterLibraryReadOnlySnapshot(catalog)
    });
  } catch {
    return Object.freeze({
      status: "failed",
      reason: "catalog-load-failed"
    });
  }
}
