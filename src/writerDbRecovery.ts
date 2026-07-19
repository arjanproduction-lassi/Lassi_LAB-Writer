import type { Spark, WriterPackage } from "./types";
import {
  WRITER_DB_APP_NAME,
  WRITER_DB_V2_SCHEMA_VERSION,
  parseWriterDbPayload,
  type WriterDbImportBackup
} from "./writerDb";
import type {
  WriterDbImportTransactionMarker,
  WriterDbKeyValueStorage,
  WriterDbPersistenceKeys
} from "./writerDbPersistence";

export type WriterDbRecoveryWarning =
  | {
      code: "current-sparks-invalid";
      message: string;
    }
  | {
      code: "current-packages-invalid";
      message: string;
    }
  | {
      code: "target-count-mismatch";
      collection: "sparks" | "packages";
      target: number;
      actual: number;
      message: string;
    };

export type WriterDbRecoveryInspection =
  | {
      status: "clean";
      markerPresent: false;
    }
  | {
      status: "recoverable";
      markerPresent: true;
      marker: WriterDbImportTransactionMarker;
      backup: WriterDbImportBackup;
      currentSparksValid: boolean;
      currentPackagesValid: boolean;
      warnings: WriterDbRecoveryWarning[];
    }
  | {
      status: "blocked";
      markerPresent: true;
      error: string;
      warnings: WriterDbRecoveryWarning[];
    };

export type InspectWriterDbRecoveryInput = {
  storage: Pick<WriterDbKeyValueStorage, "getItem">;
  keys: WriterDbPersistenceKeys;
};

type ParsedCollection<T> =
  | { valid: true; records: T[] }
  | { valid: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasUniqueIds(records: readonly { id: string }[]): boolean {
  return new Set(records.map((record) => record.id)).size === records.length;
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function parseMarker(raw: string): WriterDbImportTransactionMarker | undefined {
  let value: unknown;
  try {
    value = parseJson(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (
    value.markerVersion !== 1 ||
    typeof value.transactionId !== "string" ||
    value.transactionId.trim().length === 0 ||
    value.status !== "prepared" ||
    !isValidDateString(value.createdAt) ||
    (value.sourceSchemaVersion !== 1 && value.sourceSchemaVersion !== 2) ||
    !isNonNegativeInteger(value.targetSparkCount) ||
    !isNonNegativeInteger(value.targetPackageCount)
  ) {
    return undefined;
  }

  return {
    markerVersion: 1,
    transactionId: value.transactionId,
    status: "prepared",
    createdAt: value.createdAt,
    sourceSchemaVersion: value.sourceSchemaVersion,
    targetSparkCount: value.targetSparkCount,
    targetPackageCount: value.targetPackageCount
  };
}

function parseBackup(raw: string): WriterDbImportBackup | undefined {
  let value: unknown;
  try {
    value = parseJson(raw);
  } catch {
    return undefined;
  }

  if (
    !isRecord(value) ||
    value.backupVersion !== 1 ||
    value.reason !== "before-import" ||
    !isValidDateString(value.createdAt) ||
    (value.sourceSchemaVersion !== 1 && value.sourceSchemaVersion !== 2) ||
    !Array.isArray(value.sparks) ||
    !Array.isArray(value.packages)
  ) {
    return undefined;
  }

  const parsed = parseWriterDbPayload({
    app: WRITER_DB_APP_NAME,
    schemaVersion: WRITER_DB_V2_SCHEMA_VERSION,
    exportedAt: value.createdAt,
    sparkCount: value.sparks.length,
    packageCount: value.packages.length,
    sparks: value.sparks,
    packages: value.packages
  });

  if (
    !parsed.ok ||
    parsed.db.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION ||
    !hasUniqueIds(parsed.db.sparks) ||
    !hasUniqueIds(parsed.db.packages)
  ) {
    return undefined;
  }

  return {
    backupVersion: 1,
    createdAt: value.createdAt,
    reason: "before-import",
    sourceSchemaVersion: value.sourceSchemaVersion,
    sparks: parsed.db.sparks,
    packages: parsed.db.packages
  };
}

function parseSparks(raw: string | null): ParsedCollection<Spark> {
  if (raw === null) {
    return { valid: false };
  }

  let value: unknown;
  try {
    value = parseJson(raw);
  } catch {
    return { valid: false };
  }

  if (!Array.isArray(value)) {
    return { valid: false };
  }

  const parsed = parseWriterDbPayload({
    app: WRITER_DB_APP_NAME,
    schemaVersion: WRITER_DB_V2_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    sparkCount: value.length,
    packageCount: 0,
    sparks: value,
    packages: []
  });

  if (
    !parsed.ok ||
    parsed.db.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION ||
    !hasUniqueIds(parsed.db.sparks)
  ) {
    return { valid: false };
  }

  return { valid: true, records: parsed.db.sparks };
}

function parsePackages(raw: string | null): ParsedCollection<WriterPackage> {
  if (raw === null) {
    return { valid: false };
  }

  let value: unknown;
  try {
    value = parseJson(raw);
  } catch {
    return { valid: false };
  }

  if (!Array.isArray(value)) {
    return { valid: false };
  }

  const parsed = parseWriterDbPayload({
    app: WRITER_DB_APP_NAME,
    schemaVersion: WRITER_DB_V2_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    sparkCount: 0,
    packageCount: value.length,
    sparks: [],
    packages: value
  });

  if (
    !parsed.ok ||
    parsed.db.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION ||
    !hasUniqueIds(parsed.db.packages)
  ) {
    return { valid: false };
  }

  return { valid: true, records: parsed.db.packages };
}

function blocked(error: string): WriterDbRecoveryInspection {
  return {
    status: "blocked",
    markerPresent: true,
    error,
    warnings: []
  };
}

export function inspectWriterDbRecovery(
  input: InspectWriterDbRecoveryInput
): WriterDbRecoveryInspection {
  let markerRaw: string | null;
  try {
    markerRaw = input.storage.getItem(input.keys.transaction);
  } catch {
    return blocked("Transaction marker sa nepodarilo precitat.");
  }

  if (markerRaw === null) {
    return { status: "clean", markerPresent: false };
  }

  const marker = parseMarker(markerRaw);
  if (!marker) {
    return blocked("Transaction marker je poskodeny alebo ma nepodporovanu verziu.");
  }

  let backupRaw: string | null;
  try {
    backupRaw = input.storage.getItem(input.keys.backup);
  } catch {
    return blocked("Import backup sa nepodarilo precitat.");
  }

  if (backupRaw === null) {
    return blocked("Transaction marker existuje, ale import backup chyba.");
  }

  const backup = parseBackup(backupRaw);
  if (!backup) {
    return blocked("Import backup je poskodeny alebo nepouzitelny.");
  }

  if (backup.sourceSchemaVersion !== marker.sourceSchemaVersion) {
    return blocked("Source schema version backupu nezodpoveda transaction markeru.");
  }

  let currentSparksRaw: string | null = null;
  let currentPackagesRaw: string | null = null;
  try {
    currentSparksRaw = input.storage.getItem(input.keys.sparks);
  } catch {
    // A valid backup still makes recovery diagnosable.
  }
  try {
    currentPackagesRaw = input.storage.getItem(input.keys.packages);
  } catch {
    // A valid backup still makes recovery diagnosable.
  }

  const currentSparks = parseSparks(currentSparksRaw);
  const currentPackages = parsePackages(currentPackagesRaw);
  const warnings: WriterDbRecoveryWarning[] = [];

  if (!currentSparks.valid) {
    warnings.push({
      code: "current-sparks-invalid",
      message: "Aktualna Sparks kolekcia je neplatna alebo necitatelna."
    });
  } else if (currentSparks.records.length !== marker.targetSparkCount) {
    warnings.push({
      code: "target-count-mismatch",
      collection: "sparks",
      target: marker.targetSparkCount,
      actual: currentSparks.records.length,
      message: "Aktualny pocet Sparks nezodpoveda cielu transaction markeru."
    });
  }

  if (!currentPackages.valid) {
    warnings.push({
      code: "current-packages-invalid",
      message: "Aktualna WriterPackages kolekcia je neplatna alebo necitatelna."
    });
  } else if (currentPackages.records.length !== marker.targetPackageCount) {
    warnings.push({
      code: "target-count-mismatch",
      collection: "packages",
      target: marker.targetPackageCount,
      actual: currentPackages.records.length,
      message: "Aktualny pocet WriterPackages nezodpoveda cielu transaction markeru."
    });
  }

  return {
    status: "recoverable",
    markerPresent: true,
    marker,
    backup,
    currentSparksValid: currentSparks.valid,
    currentPackagesValid: currentPackages.valid,
    warnings
  };
}
