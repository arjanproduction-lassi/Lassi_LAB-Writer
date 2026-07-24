import type { WriterPackage } from "./types";
import {
  toWriterLibraryItem,
  type WriterLibraryOrigin
} from "./writerLibraryViewModel";

export type WriterLibraryDetailNote = Readonly<{
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}>;

export type WriterLibraryDetail = Readonly<{
  id: string;
  title: string;
  origin: WriterLibraryOrigin;
  createdAt: string;
  updatedAt: string;
  sparkText: string;
  notes: readonly WriterLibraryDetailNote[];
  workshopText: string;
  finalText: string;
}>;

export function toWriterLibraryDetail(
  writerPackage: Readonly<WriterPackage>
): WriterLibraryDetail {
  const libraryItem = toWriterLibraryItem(writerPackage);
  const notes = writerPackage.notes
    .filter((note) => !note.deletedAt)
    .map((note) =>
      Object.freeze({
        id: note.id,
        text: note.text,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      })
    );

  return Object.freeze({
    id: writerPackage.id,
    title: libraryItem.title,
    origin: libraryItem.origin,
    createdAt: writerPackage.createdAt,
    updatedAt: writerPackage.updatedAt,
    sparkText: writerPackage.sparkText,
    notes: Object.freeze(notes),
    workshopText: writerPackage.workshopText,
    finalText: writerPackage.finalText
  });
}

export function buildWriterLibraryDetails(
  catalog: readonly Readonly<WriterPackage>[]
): readonly WriterLibraryDetail[] {
  const details = catalog
    .filter((writerPackage) => !writerPackage.deletedAt)
    .map(toWriterLibraryDetail);

  return Object.freeze(details);
}
