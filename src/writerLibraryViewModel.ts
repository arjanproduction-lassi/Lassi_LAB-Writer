import type { WriterPackage } from "./types";

export type WriterLibraryOrigin = "writer-package" | "legacy-spark";

export type WriterLibraryProgress =
  | "empty"
  | "spark"
  | "notes"
  | "workshop"
  | "final";

export type WriterLibraryItem = Readonly<{
  id: string;
  title: string;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
  origin: WriterLibraryOrigin;
  progress: WriterLibraryProgress;
  noteCount: number;
  hasNotes: boolean;
  hasWorkshopText: boolean;
  hasFinalText: boolean;
  deleted: boolean;
}>;

const UNTITLED_LIBRARY_ITEM = "Bez názvu";
const EMPTY_LIBRARY_EXCERPT = "Zatiaľ bez textu.";
const LIBRARY_EXCERPT_LENGTH = 118;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createExcerpt(writerPackage: Readonly<WriterPackage>): string {
  const source = [
    writerPackage.finalText,
    writerPackage.workshopText,
    writerPackage.sparkText
  ]
    .map(normalizeWhitespace)
    .find(Boolean);

  if (!source) {
    return EMPTY_LIBRARY_EXCERPT;
  }

  return source.length > LIBRARY_EXCERPT_LENGTH
    ? `${source.slice(0, LIBRARY_EXCERPT_LENGTH).trimEnd()}…`
    : source;
}

function compareLibraryItems(a: WriterLibraryItem, b: WriterLibraryItem): number {
  const aUpdatedAt = Date.parse(a.updatedAt);
  const bUpdatedAt = Date.parse(b.updatedAt);
  const aHasValidDate = !Number.isNaN(aUpdatedAt);
  const bHasValidDate = !Number.isNaN(bUpdatedAt);

  if (aHasValidDate && bHasValidDate && aUpdatedAt !== bUpdatedAt) {
    return bUpdatedAt - aUpdatedAt;
  }

  if (aHasValidDate !== bHasValidDate) {
    return aHasValidDate ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

export function toWriterLibraryItem(
  writerPackage: Readonly<WriterPackage>
): WriterLibraryItem {
  const liveNotes = writerPackage.notes.filter((note) => !note.deletedAt);
  const noteCount = liveNotes.length;
  const hasNotes = noteCount > 0;
  const hasLiveNoteText = liveNotes.some(
    (note) => normalizeWhitespace(note.text).length > 0
  );
  const hasWorkshopText = normalizeWhitespace(writerPackage.workshopText).length > 0;
  const hasFinalText = normalizeWhitespace(writerPackage.finalText).length > 0;
  const hasSparkText = normalizeWhitespace(writerPackage.sparkText).length > 0;
  const progress: WriterLibraryProgress = hasFinalText
    ? "final"
    : hasWorkshopText
      ? "workshop"
      : hasLiveNoteText
        ? "notes"
        : hasSparkText
          ? "spark"
          : "empty";

  return Object.freeze({
    id: writerPackage.id,
    title: normalizeWhitespace(writerPackage.title) || UNTITLED_LIBRARY_ITEM,
    excerpt: createExcerpt(writerPackage),
    createdAt: writerPackage.createdAt,
    updatedAt: writerPackage.updatedAt,
    origin: writerPackage.legacy?.source === "spark" ? "legacy-spark" : "writer-package",
    progress,
    noteCount,
    hasNotes,
    hasWorkshopText,
    hasFinalText,
    deleted: Boolean(writerPackage.deletedAt)
  });
}

export function buildWriterLibraryItems(
  catalog: readonly Readonly<WriterPackage>[]
): readonly WriterLibraryItem[] {
  const items = catalog
    .map(toWriterLibraryItem)
    .filter((item) => !item.deleted)
    .sort(compareLibraryItems);

  return Object.freeze(items);
}
