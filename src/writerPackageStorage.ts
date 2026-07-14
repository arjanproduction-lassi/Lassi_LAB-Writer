import { listSparks } from "./storage";
import type { SparkStage, WriterPackage, WriterPackageNote } from "./types";
import { adaptSparkToWriterPackage } from "./writerPackage";

export const WRITER_PACKAGE_STORAGE_KEY = "lassilab-writer:v0.1:packages";

const WRITER_PACKAGE_VERSION = 1;
const SPARK_STAGES = new Set<SparkStage>(["spark", "notes", "workshop", "final"]);

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isSparkStage(value: unknown): value is SparkStage {
  return typeof value === "string" && SPARK_STAGES.has(value as SparkStage);
}

export function isWriterPackageNote(value: unknown): value is WriterPackageNote {
  if (!value || typeof value !== "object") {
    return false;
  }

  const note = value as Partial<WriterPackageNote>;
  return (
    typeof note.id === "string" &&
    note.id.trim().length > 0 &&
    typeof note.text === "string" &&
    isValidDateString(note.createdAt) &&
    isValidDateString(note.updatedAt) &&
    (note.deletedAt === undefined || isValidDateString(note.deletedAt))
  );
}

export function isWriterPackage(value: unknown): value is WriterPackage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const writerPackage = value as Partial<WriterPackage>;
  return (
    typeof writerPackage.id === "string" &&
    writerPackage.id.trim().length > 0 &&
    typeof writerPackage.title === "string" &&
    typeof writerPackage.sparkText === "string" &&
    Array.isArray(writerPackage.notes) &&
    writerPackage.notes.every(isWriterPackageNote) &&
    typeof writerPackage.workshopText === "string" &&
    typeof writerPackage.finalText === "string" &&
    isValidDateString(writerPackage.createdAt) &&
    isValidDateString(writerPackage.updatedAt) &&
    (writerPackage.deletedAt === undefined || isValidDateString(writerPackage.deletedAt)) &&
    writerPackage.packageVersion === WRITER_PACKAGE_VERSION &&
    (writerPackage.legacy === undefined ||
      (writerPackage.legacy.source === "spark" &&
        (writerPackage.legacy.stage === undefined || isSparkStage(writerPackage.legacy.stage))))
  );
}

function compareUpdatedAt(a: WriterPackage, b: WriterPackage) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function isVisibleWriterPackage(writerPackage: WriterPackage) {
  return !writerPackage.deletedAt;
}

export function loadWriterPackages(): WriterPackage[] {
  const raw = window.localStorage.getItem(WRITER_PACKAGE_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWriterPackage) : [];
  } catch {
    return [];
  }
}

export function saveWriterPackages(packages: WriterPackage[]) {
  window.localStorage.setItem(WRITER_PACKAGE_STORAGE_KEY, JSON.stringify(packages));
}

export function upsertWriterPackage(writerPackage: WriterPackage): WriterPackage[] {
  if (!isWriterPackage(writerPackage)) {
    return loadWriterPackages();
  }

  const packages = loadWriterPackages();
  const exists = packages.some((candidate) => candidate.id === writerPackage.id);
  const next = exists
    ? packages.map((candidate) =>
        candidate.id === writerPackage.id ? writerPackage : candidate
      )
    : [writerPackage, ...packages];

  saveWriterPackages(next);
  return next;
}

export function getWriterPackageById(id: string): WriterPackage | undefined {
  return loadWriterPackages().find((writerPackage) => writerPackage.id === id);
}

export function loadWriterPackageCatalog(): WriterPackage[] {
  const byId = new Map<string, WriterPackage>();

  for (const writerPackage of loadWriterPackages().filter(isVisibleWriterPackage)) {
    byId.set(writerPackage.id, writerPackage);
  }

  for (const spark of listSparks()) {
    if (!byId.has(spark.id)) {
      byId.set(spark.id, adaptSparkToWriterPackage(spark));
    }
  }

  return [...byId.values()].sort(compareUpdatedAt);
}
