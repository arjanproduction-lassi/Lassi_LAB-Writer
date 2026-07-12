import type {
  GoogleSyncPreferences,
  NewSparkDraft,
  Spark,
  SparkInput,
  WriterDbExport,
  WriterDbImportResult,
  WriterDbMergeResult
} from "./types";

const APP_NAME = "LassiLAB Writer";
const STORAGE_KEY = "lassilab-writer:v0.1:sparks";
const IMPORT_BACKUP_STORAGE_KEY = "lassilab-writer:v0.1:sparks:backup-before-import";
const SYNC_BACKUP_STORAGE_KEY = "lassilab-writer:v0.1:sparks:backup-before-sync";
const SYNC_PREFERENCES_STORAGE_KEY = "lassilab-writer:v0.1:google-sync-preferences";
const NEW_SPARK_DRAFT_STORAGE_KEY = "lassilab-writer:v0.1:draft:new-spark";
const SCHEMA_VERSION = 1;

const DEFAULT_SYNC_PREFERENCES: GoogleSyncPreferences = {
  googleSyncEnabled: false,
  pendingLocalChanges: false
};

function readRawSparks(): Spark[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSpark) : [];
  } catch {
    return [];
  }
}

function writeRawSparks(sparks: Spark[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sparks));
}

function isSpark(value: unknown): value is Spark {
  if (!value || typeof value !== "object") {
    return false;
  }

  const spark = value as Partial<Spark>;
  return (
    typeof spark.id === "string" &&
    (spark.title === undefined || typeof spark.title === "string") &&
    typeof spark.text === "string" &&
    isValidDateString(spark.createdAt) &&
    isValidDateString(spark.updatedAt) &&
    (spark.deletedAt === undefined || isValidDateString(spark.deletedAt)) &&
    spark.temperature === "spark" &&
    Array.isArray(spark.tags) &&
    spark.tags.every((tag) => typeof tag === "string") &&
    spark.schemaVersion === SCHEMA_VERSION
  );
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isWriterDbExport(value: unknown): value is WriterDbExport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const exportData = value as Partial<WriterDbExport>;
  return (
    exportData.app === APP_NAME &&
    exportData.schemaVersion === SCHEMA_VERSION &&
    isValidDateString(exportData.exportedAt) &&
    Number.isInteger(exportData.sparkCount) &&
    typeof exportData.sparkCount === "number" &&
    exportData.sparkCount >= 0 &&
    Array.isArray(exportData.sparks)
  );
}

function isGoogleSyncPreferences(value: unknown): value is GoogleSyncPreferences {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preferences = value as Partial<GoogleSyncPreferences>;
  return (
    typeof preferences.googleSyncEnabled === "boolean" &&
    (preferences.lastSyncAt === undefined || isValidDateString(preferences.lastSyncAt)) &&
    (preferences.lastSyncResult === undefined ||
      typeof preferences.lastSyncResult === "string") &&
    (preferences.lastSyncError === undefined ||
      typeof preferences.lastSyncError === "string") &&
    (preferences.pendingLocalChanges === undefined ||
      typeof preferences.pendingLocalChanges === "boolean")
  );
}

function isNewSparkDraft(value: unknown): value is NewSparkDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Partial<NewSparkDraft>;
  return (
    typeof draft.text === "string" &&
    isValidDateString(draft.updatedAt) &&
    draft.schemaVersion === SCHEMA_VERSION
  );
}

function formatDatePart(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function backupSparks(sparks: Spark[], storageKey: string) {
  const backedUpAt = new Date().toISOString();
  const backup = {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    backedUpAt,
    storageKey: STORAGE_KEY,
    sparkCount: sparks.length,
    sparks
  };

  window.localStorage.setItem(storageKey, JSON.stringify(backup));
  return backedUpAt;
}

function compareUpdatedAt(a: Spark, b: Spark) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function isVisibleSpark(spark: Spark) {
  return !spark.deletedAt;
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function listSparks(): Spark[] {
  return readRawSparks().filter(isVisibleSpark).sort(compareUpdatedAt);
}

export function getSpark(id: string): Spark | undefined {
  return readRawSparks().find((spark) => spark.id === id && isVisibleSpark(spark));
}

export function readGoogleSyncPreferences(): GoogleSyncPreferences {
  const raw = window.localStorage.getItem(SYNC_PREFERENCES_STORAGE_KEY);

  if (!raw) {
    return DEFAULT_SYNC_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw);
    return isGoogleSyncPreferences(parsed)
      ? { ...DEFAULT_SYNC_PREFERENCES, ...parsed }
      : DEFAULT_SYNC_PREFERENCES;
  } catch {
    return DEFAULT_SYNC_PREFERENCES;
  }
}

export function writeGoogleSyncPreferences(
  preferences: GoogleSyncPreferences
): GoogleSyncPreferences {
  const next: GoogleSyncPreferences = {
    googleSyncEnabled: preferences.googleSyncEnabled,
    ...(preferences.lastSyncAt ? { lastSyncAt: preferences.lastSyncAt } : {}),
    ...(preferences.lastSyncResult ? { lastSyncResult: preferences.lastSyncResult } : {}),
    ...(preferences.lastSyncError ? { lastSyncError: preferences.lastSyncError } : {}),
    ...(preferences.pendingLocalChanges !== undefined
      ? { pendingLocalChanges: preferences.pendingLocalChanges }
      : {})
  };

  window.localStorage.setItem(SYNC_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function updateGoogleSyncPreferences(
  patch: Partial<GoogleSyncPreferences>
): GoogleSyncPreferences {
  return writeGoogleSyncPreferences({
    ...readGoogleSyncPreferences(),
    ...patch
  });
}

export function readNewSparkDraft(): NewSparkDraft | undefined {
  const raw = window.localStorage.getItem(NEW_SPARK_DRAFT_STORAGE_KEY);

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    return isNewSparkDraft(parsed) && parsed.text.trim() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveNewSparkDraft(text: string): NewSparkDraft | undefined {
  if (!text.trim()) {
    clearNewSparkDraft();
    return undefined;
  }

  const draft: NewSparkDraft = {
    text,
    updatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION
  };

  window.localStorage.setItem(NEW_SPARK_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  return draft;
}

export function clearNewSparkDraft() {
  window.localStorage.removeItem(NEW_SPARK_DRAFT_STORAGE_KEY);
}

export function saveSpark(input: SparkInput): Spark {
  const now = new Date().toISOString();
  const sparks = readRawSparks();
  const existing = input.id ? sparks.find((spark) => spark.id === input.id) : undefined;

  const saved: Spark = {
    id: existing?.id ?? createId(),
    title: input.title?.trim() || undefined,
    text: input.text.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    temperature: "spark",
    tags: existing?.tags ?? [],
    schemaVersion: SCHEMA_VERSION
  };

  const next = existing
    ? sparks.map((spark) => (spark.id === saved.id ? saved : spark))
    : [saved, ...sparks];

  writeRawSparks(next);
  return saved;
}

export function deleteSpark(id: string): Spark | undefined {
  const now = new Date().toISOString();
  const sparks = readRawSparks();
  const existing = sparks.find((spark) => spark.id === id);

  if (!existing) {
    return undefined;
  }

  if (existing.deletedAt) {
    return existing;
  }

  const deleted: Spark = {
    ...existing,
    updatedAt: now,
    deletedAt: now
  };

  writeRawSparks(sparks.map((spark) => (spark.id === id ? deleted : spark)));
  return deleted;
}

export function createWriterDbExport(): WriterDbExport {
  const sparks = readRawSparks().sort(compareUpdatedAt);

  return {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sparkCount: sparks.length,
    sparks
  };
}

export function getWriterDbExportFileName(date = new Date()) {
  return `LassiLAB_Writer_DBv001_${formatDatePart(date)}.json`;
}

export function importWriterDb(value: unknown): WriterDbImportResult {
  const result = mergeWriterDbExportIntoStorage(value, IMPORT_BACKUP_STORAGE_KEY);

  return {
    added: result.added,
    updated: result.updated,
    skipped: result.kept,
    invalid: result.invalid,
    backupKey: result.backupKey,
    backedUpAt: result.backedUpAt
  };
}

export function mergeWriterDbExportIntoStorage(
  value: unknown,
  backupKey = SYNC_BACKUP_STORAGE_KEY
): WriterDbMergeResult {
  if (!isWriterDbExport(value)) {
    throw new Error("Invalid Writer DB export.");
  }

  const current = readRawSparks();
  const backedUpAt = backupSparks(current, backupKey);
  const byId = new Map(current.map((spark) => [spark.id, spark]));
  const remoteById = new Map<string, Spark>();
  let added = 0;
  let updated = 0;
  let kept = 0;
  let invalid = 0;

  for (const candidate of value.sparks) {
    if (!isSpark(candidate)) {
      invalid += 1;
      continue;
    }

    remoteById.set(candidate.id, candidate);
    const existing = byId.get(candidate.id);

    if (!existing) {
      byId.set(candidate.id, candidate);
      added += 1;
      continue;
    }

    if (Date.parse(candidate.updatedAt) > Date.parse(existing.updatedAt)) {
      byId.set(candidate.id, candidate);
      updated += 1;
    } else {
      kept += 1;
    }
  }

  let pushed = 0;
  for (const spark of current) {
    const remoteSpark = remoteById.get(spark.id);

    if (!remoteSpark || Date.parse(spark.updatedAt) > Date.parse(remoteSpark.updatedAt)) {
      pushed += 1;
    }
  }

  const merged = [...byId.values()].sort(compareUpdatedAt);
  writeRawSparks(merged);

  return {
    added,
    updated,
    kept,
    invalid,
    pushed,
    pulled: added + updated,
    total: merged.length,
    backupKey,
    backedUpAt
  };
}
