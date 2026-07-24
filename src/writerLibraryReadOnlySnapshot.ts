import type { WriterPackage } from "./types";
import {
  buildWriterLibraryDetails,
  type WriterLibraryDetail
} from "./writerLibraryDetailViewModel";
import {
  buildWriterLibraryItems,
  type WriterLibraryItem
} from "./writerLibraryViewModel";

export type WriterLibraryReadOnlySnapshot = Readonly<{
  items: readonly WriterLibraryItem[];
  detailsById: Readonly<Record<string, WriterLibraryDetail>>;
}>;

function hasOwnDetail(
  detailsById: Readonly<Record<string, WriterLibraryDetail>>,
  id: string
): boolean {
  return Object.prototype.hasOwnProperty.call(detailsById, id);
}

export function buildWriterLibraryReadOnlySnapshot(
  catalog: readonly Readonly<WriterPackage>[]
): WriterLibraryReadOnlySnapshot {
  const items = buildWriterLibraryItems(catalog);
  const details = buildWriterLibraryDetails(catalog);
  const detailsById = Object.create(null) as Record<string, WriterLibraryDetail>;

  for (const detail of details) {
    if (hasOwnDetail(detailsById, detail.id)) {
      throw new Error("Writer Library snapshot requires unique detail ids.");
    }

    Object.defineProperty(detailsById, detail.id, {
      value: detail,
      enumerable: true,
      writable: false,
      configurable: false
    });
  }

  if (
    items.length !== details.length ||
    items.some((item) => !hasOwnDetail(detailsById, item.id))
  ) {
    throw new Error("Writer Library snapshot item/detail invariant failed.");
  }

  return Object.freeze({
    items,
    detailsById: Object.freeze(detailsById)
  });
}
