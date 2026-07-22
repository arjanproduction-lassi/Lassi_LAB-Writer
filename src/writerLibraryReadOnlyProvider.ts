import type { WriterPackage } from "./types";
import {
  buildWriterLibraryItems,
  type WriterLibraryItem
} from "./writerLibraryViewModel";

export type WriterPackageCatalogLoader = () => readonly WriterPackage[];

export type WriterLibraryReadOnlyResult =
  | Readonly<{
      status: "ready";
      items: readonly WriterLibraryItem[];
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
      items: buildWriterLibraryItems(catalog)
    });
  } catch {
    return Object.freeze({
      status: "failed",
      reason: "catalog-load-failed"
    });
  }
}
