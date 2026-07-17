import type { Spark, WriterPackage } from "./types";
import {
  createWriterDbV2Payload,
  parseWriterDbPayload,
  type WriterDbImportBackup
} from "./writerDb";

export type WriterDbKeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type WriterDbPersistenceKeys = {
  sparks: string;
  packages: string;
  backup: string;
  transaction: string;
};

export type WriterDbImportTransactionMarker = {
  markerVersion: 1;
  transactionId: string;
  status: "prepared";
  createdAt: string;
  sourceSchemaVersion: 1 | 2;
  targetSparkCount: number;
  targetPackageCount: number;
};

export type PersistWriterDbImportInput = {
  storage: WriterDbKeyValueStorage;
  keys: WriterDbPersistenceKeys;
  backup: WriterDbImportBackup;
  sparks: readonly Spark[];
  packages: readonly WriterPackage[];
  transactionId?: string;
  now?: string;
};

export type PersistWriterDbImportResult =
  | {
      ok: true;
      transactionId: string;
    }
  | {
      ok: false;
      stage:
        | "validation"
        | "backup-write"
        | "backup-verify"
        | "marker-write"
        | "marker-verify"
        | "sparks-write"
        | "sparks-verify"
        | "packages-write"
        | "packages-verify"
        | "rollback";
      error: string;
      rollbackAttempted: boolean;
      rollbackSucceeded: boolean;
    };

type PreparedPersistence = {
  backupJson: string;
  markerJson: string;
  sparksJson: string;
  packagesJson: string;
  backupSparksJson: string;
  backupPackagesJson: string;
  marker: WriterDbImportTransactionMarker;
  transactionId: string;
};

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isSchemaVersion(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2;
}

function hasUniqueIds<T extends { id: string }>(records: readonly T[]): boolean {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      return false;
    }
    ids.add(record.id);
  }
  return true;
}

function validateCollections(
  sparks: readonly Spark[],
  packages: readonly WriterPackage[],
  exportedAt: string
): string | undefined {
  if (!isValidDateString(exportedAt)) {
    return "Neplatny cas pri validacii kolekcii.";
  }

  if (!hasUniqueIds(sparks)) {
    return "Sparks obsahuju duplicitne id.";
  }

  if (!hasUniqueIds(packages)) {
    return "WriterPackages obsahuju duplicitne id.";
  }

  const parsed = parseWriterDbPayload(
    createWriterDbV2Payload({
      sparks: [...sparks],
      packages: [...packages],
      exportedAt
    })
  );

  return parsed.ok ? undefined : parsed.error;
}

function validateBackup(backup: WriterDbImportBackup): string | undefined {
  if (backup.backupVersion !== 1) {
    return "Neplatna verzia import backupu.";
  }

  if (!isValidDateString(backup.createdAt)) {
    return "Import backup ma neplatny createdAt.";
  }

  if (backup.reason !== "before-import") {
    return "Import backup ma neplatny reason.";
  }

  if (!isSchemaVersion(backup.sourceSchemaVersion)) {
    return "Import backup ma neplatnu sourceSchemaVersion.";
  }

  return validateCollections(backup.sparks, backup.packages, backup.createdAt);
}

function createTransactionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `writer-db-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function serialize(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Hodnotu Writer DB sa nepodarilo serializovat.");
  }
  return serialized;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function verifyExactJson(raw: string | null, expectedJson: string): boolean {
  if (raw === null) {
    return false;
  }

  try {
    return serialize(parseJson(raw)) === expectedJson;
  } catch {
    return false;
  }
}

function preparePersistence(input: PersistWriterDbImportInput):
  | { ok: true; prepared: PreparedPersistence }
  | { ok: false; error: string } {
  if (!input.keys.sparks || !input.keys.packages || !input.keys.backup || !input.keys.transaction) {
    return { ok: false, error: "Writer DB persistence potrebuje vsetky storage kluce." };
  }

  const backupError = validateBackup(input.backup);
  if (backupError) {
    return { ok: false, error: backupError };
  }

  const now = input.now ?? new Date().toISOString();
  if (!isValidDateString(now)) {
    return { ok: false, error: "Writer DB persistence ma neplatny now." };
  }

  const transactionId = input.transactionId ?? createTransactionId();
  if (typeof transactionId !== "string" || transactionId.trim().length === 0) {
    return { ok: false, error: "Writer DB persistence ma neplatny transactionId." };
  }

  const collectionsError = validateCollections(input.sparks, input.packages, now);
  if (collectionsError) {
    return { ok: false, error: collectionsError };
  }

  const marker: WriterDbImportTransactionMarker = {
    markerVersion: 1,
    transactionId,
    status: "prepared",
    createdAt: new Date(Date.parse(now)).toISOString(),
    sourceSchemaVersion: input.backup.sourceSchemaVersion,
    targetSparkCount: input.sparks.length,
    targetPackageCount: input.packages.length
  };

  try {
    return {
      ok: true,
      prepared: {
        backupJson: serialize(input.backup),
        markerJson: serialize(marker),
        sparksJson: serialize([...input.sparks]),
        packagesJson: serialize([...input.packages]),
        backupSparksJson: serialize(input.backup.sparks),
        backupPackagesJson: serialize(input.backup.packages),
        marker,
        transactionId
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Writer DB persistence sa nepodarilo pripravit."
    };
  }
}

function failure(
  stage: Extract<PersistWriterDbImportResult, { ok: false }>["stage"],
  error: string,
  rollbackAttempted = false,
  rollbackSucceeded = false
): PersistWriterDbImportResult {
  return { ok: false, stage, error, rollbackAttempted, rollbackSucceeded };
}

function rollback(
  input: PersistWriterDbImportInput,
  prepared: PreparedPersistence
): { succeeded: boolean; error?: string } {
  let sparksRestored = false;
  let packagesRestored = false;
  let firstError: string | undefined;

  try {
    input.storage.setItem(input.keys.sparks, prepared.backupSparksJson);
    sparksRestored = verifyExactJson(
      input.storage.getItem(input.keys.sparks),
      prepared.backupSparksJson
    );
    if (!sparksRestored) {
      firstError = "Rollback Sparks read-back zlyhal.";
    }
  } catch (error) {
    firstError = error instanceof Error ? error.message : "Rollback Sparks zlyhal.";
  }

  try {
    input.storage.setItem(input.keys.packages, prepared.backupPackagesJson);
    packagesRestored = verifyExactJson(
      input.storage.getItem(input.keys.packages),
      prepared.backupPackagesJson
    );
    if (!packagesRestored && !firstError) {
      firstError = "Rollback Packages read-back zlyhal.";
    }
  } catch (error) {
    if (!firstError) {
      firstError = error instanceof Error ? error.message : "Rollback Packages zlyhal.";
    }
  }

  if (!sparksRestored || !packagesRestored) {
    return { succeeded: false, error: firstError ?? "Rollback zlyhal." };
  }

  try {
    input.storage.removeItem(input.keys.transaction);
    return { succeeded: true };
  } catch (error) {
    return {
      succeeded: false,
      error: error instanceof Error ? error.message : "Rollback markera zlyhal."
    };
  }
}

export function persistWriterDbImport(
  input: PersistWriterDbImportInput
): PersistWriterDbImportResult {
  const preparedResult = preparePersistence(input);
  if (!preparedResult.ok) {
    return failure("validation", preparedResult.error);
  }

  const { prepared } = preparedResult;

  try {
    input.storage.setItem(input.keys.backup, prepared.backupJson);
  } catch (error) {
    return failure(
      "backup-write",
      error instanceof Error ? error.message : "Zapis backupu zlyhal."
    );
  }

  if (!verifyExactJson(input.storage.getItem(input.keys.backup), prepared.backupJson)) {
    return failure("backup-verify", "Overenie backupu po zapise zlyhalo.");
  }

  try {
    input.storage.setItem(input.keys.transaction, prepared.markerJson);
  } catch (error) {
    const rollbackResult = rollback(input, prepared);
    return failure(
      "marker-write",
      error instanceof Error ? error.message : "Zapis transaction markeru zlyhal.",
      true,
      rollbackResult.succeeded
    );
  }

  if (!verifyExactJson(input.storage.getItem(input.keys.transaction), prepared.markerJson)) {
    const rollbackResult = rollback(input, prepared);
    return failure(
      "marker-verify",
      "Overenie transaction markeru po zapise zlyhalo.",
      true,
      rollbackResult.succeeded
    );
  }

  try {
    input.storage.setItem(input.keys.sparks, prepared.sparksJson);
  } catch (error) {
    const rollbackResult = rollback(input, prepared);
    return failure(
      "sparks-write",
      error instanceof Error ? error.message : "Zapis Sparks zlyhal.",
      true,
      rollbackResult.succeeded
    );
  }

  if (!verifyExactJson(input.storage.getItem(input.keys.sparks), prepared.sparksJson)) {
    const rollbackResult = rollback(input, prepared);
    return failure(
      "sparks-verify",
      "Overenie Sparks po zapise zlyhalo.",
      true,
      rollbackResult.succeeded
    );
  }

  try {
    input.storage.setItem(input.keys.packages, prepared.packagesJson);
  } catch (error) {
    const rollbackResult = rollback(input, prepared);
    return failure(
      "packages-write",
      error instanceof Error ? error.message : "Zapis Packages zlyhal.",
      true,
      rollbackResult.succeeded
    );
  }

  if (!verifyExactJson(input.storage.getItem(input.keys.packages), prepared.packagesJson)) {
    const rollbackResult = rollback(input, prepared);
    return failure(
      "packages-verify",
      "Overenie Packages po zapise zlyhalo.",
      true,
      rollbackResult.succeeded
    );
  }

  try {
    input.storage.removeItem(input.keys.transaction);
  } catch (error) {
    return failure(
      "rollback",
      error instanceof Error ? error.message : "Odstranenie transaction markeru zlyhalo.",
      false,
      false
    );
  }

  return { ok: true, transactionId: prepared.marker.transactionId };
}
