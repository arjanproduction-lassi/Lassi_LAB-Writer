import type { Spark, WriterPackage } from "./types";
import {
  WRITER_DB_APP_NAME,
  WRITER_DB_V2_SCHEMA_VERSION,
  parseWriterDbPayload,
  type ImportCollectionPreview,
  type WriterDb,
  type WriterDbImportPreview
} from "./writerDb";
import { prepareWriterDbImportExecution } from "./writerDbImportExecution";
import {
  persistWriterDbImport,
  type PersistWriterDbImportResult,
  type WriterDbKeyValueStorage,
  type WriterDbPersistenceKeys
} from "./writerDbPersistence";
import type { WriterDbRecoveryInspection } from "./writerDbRecovery";

export type WriterDbImportCollectionSuccessSummary = {
  created: number;
  updated: number;
  unchanged: number;
  ignoredOlder: number;
  tombstones: number;
};

export type WriterDbImportSuccessSummary = {
  sparks: WriterDbImportCollectionSuccessSummary;
  packages: WriterDbImportCollectionSuccessSummary;
  sourceSchemaVersion: 1 | 2;
  packagesUntouched: boolean;
  backupCreated: true;
};

export type ExecuteWriterDbImportInput = {
  storage: WriterDbKeyValueStorage;
  keys: WriterDbPersistenceKeys;
  db: WriterDb;
  previousPreview: WriterDbImportPreview;
  currentLocalSparks: readonly Spark[];
  currentLocalPackages: readonly WriterPackage[];
  recoveryInspection: WriterDbRecoveryInspection;
  backupCreatedAt: string;
  transactionId: string;
  transactionCreatedAt: string;
};

export type ExecuteWriterDbImportResult =
  | {
      status: "success";
      preview: WriterDbImportPreview;
      sourceSchemaVersion: 1 | 2;
      persistedSparks: Spark[];
      persistedPackages: WriterPackage[];
      summary: WriterDbImportSuccessSummary;
      backupCreated: true;
    }
  | {
      status: "stale";
      previousPreview: WriterDbImportPreview;
      refreshedPreview: WriterDbImportPreview;
    }
  | {
      status: "blocked";
      reason:
        | "recovery-required"
        | "recovery-blocked"
        | "preview-blocked"
        | "merge-failed"
        | "backup-failed";
      error: string;
      preview?: WriterDbImportPreview;
    }
  | {
      status: "failed";
      stage: "persistence" | "verification";
      error: string;
      persistenceStage?: Extract<PersistWriterDbImportResult, { ok: false }>["stage"];
      rollbackAttempted: boolean;
      rollbackSucceeded: boolean;
      transactionMarkerRemaining: boolean | null;
    };

type VerifiedCollections =
  | { ok: true; sparks: Spark[]; packages: WriterPackage[] }
  | { ok: false; error: string };

function collectionsEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function readAndVerifyCollections(
  storage: Pick<WriterDbKeyValueStorage, "getItem">,
  keys: WriterDbPersistenceKeys,
  expectedSparks: readonly Spark[],
  expectedPackages: readonly WriterPackage[],
  validationAt: string
): VerifiedCollections {
  let sparksValue: unknown;
  let packagesValue: unknown;

  try {
    const sparksRaw = storage.getItem(keys.sparks);
    const packagesRaw = storage.getItem(keys.packages);
    if (sparksRaw === null || packagesRaw === null) {
      return { ok: false, error: "Ulozene Writer DB kolekcie chybaju." };
    }
    sparksValue = JSON.parse(sparksRaw) as unknown;
    packagesValue = JSON.parse(packagesRaw) as unknown;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error
        ? `Ulozene Writer DB kolekcie sa nepodarilo nacitat: ${error.message}`
        : "Ulozene Writer DB kolekcie sa nepodarilo nacitat."
    };
  }

  const parsed = parseWriterDbPayload({
    app: WRITER_DB_APP_NAME,
    schemaVersion: WRITER_DB_V2_SCHEMA_VERSION,
    exportedAt: validationAt,
    sparkCount: Array.isArray(sparksValue) ? sparksValue.length : 0,
    packageCount: Array.isArray(packagesValue) ? packagesValue.length : 0,
    sparks: sparksValue,
    packages: packagesValue
  });

  if (!parsed.ok || parsed.db.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION) {
    return {
      ok: false,
      error: parsed.ok ? "Ulozeny Writer DB ma neplatnu verziu." : parsed.error
    };
  }

  if (!collectionsEqual(parsed.db.sparks, expectedSparks)) {
    return { ok: false, error: "Ulozene Sparks nezodpovedaju pripravenemu merge vysledku." };
  }

  if (!collectionsEqual(parsed.db.packages, expectedPackages)) {
    return {
      ok: false,
      error: "Ulozene WriterPackages nezodpovedaju pripravenemu merge vysledku."
    };
  }

  return { ok: true, sparks: parsed.db.sparks, packages: parsed.db.packages };
}

function inspectMarkerRemaining(
  storage: Pick<WriterDbKeyValueStorage, "getItem">,
  transactionKey: string
): boolean | null {
  try {
    return storage.getItem(transactionKey) !== null;
  } catch {
    return null;
  }
}

function summarizeCollection(
  preview: ImportCollectionPreview
): WriterDbImportCollectionSuccessSummary {
  return {
    created: preview.create,
    updated: preview.update,
    unchanged: preview.unchanged,
    ignoredOlder: preview.ignoredOlder,
    tombstones: preview.tombstones
  };
}

function createSuccessSummary(
  preview: WriterDbImportPreview
): WriterDbImportSuccessSummary {
  return {
    sparks: summarizeCollection(preview.sparks),
    packages: summarizeCollection(preview.packages),
    sourceSchemaVersion: preview.schemaVersion,
    packagesUntouched: preview.schemaVersion === 1,
    backupCreated: true
  };
}

export function executeWriterDbImport(
  input: ExecuteWriterDbImportInput
): ExecuteWriterDbImportResult {
  const execution = prepareWriterDbImportExecution({
    db: input.db,
    previousPreview: input.previousPreview,
    currentLocalSparks: input.currentLocalSparks,
    currentLocalPackages: input.currentLocalPackages,
    recoveryInspection: input.recoveryInspection,
    backupCreatedAt: input.backupCreatedAt
  });

  if (execution.status === "stale" || execution.status === "blocked") {
    return execution;
  }

  const persistence = persistWriterDbImport({
    storage: input.storage,
    keys: input.keys,
    backup: execution.backup,
    sparks: execution.mergedSparks,
    packages: execution.mergedPackages,
    transactionId: input.transactionId,
    now: input.transactionCreatedAt
  });

  if (!persistence.ok) {
    return {
      status: "failed",
      stage: "persistence",
      persistenceStage: persistence.stage,
      error: persistence.error,
      rollbackAttempted: persistence.rollbackAttempted,
      rollbackSucceeded: persistence.rollbackSucceeded,
      transactionMarkerRemaining: inspectMarkerRemaining(input.storage, input.keys.transaction)
    };
  }

  const verified = readAndVerifyCollections(
    input.storage,
    input.keys,
    execution.mergedSparks,
    execution.mergedPackages,
    input.transactionCreatedAt
  );

  if (!verified.ok) {
    return {
      status: "failed",
      stage: "verification",
      error: verified.error,
      rollbackAttempted: false,
      rollbackSucceeded: false,
      transactionMarkerRemaining: inspectMarkerRemaining(input.storage, input.keys.transaction)
    };
  }

  return {
    status: "success",
    preview: execution.preview,
    sourceSchemaVersion: execution.sourceSchemaVersion,
    persistedSparks: verified.sparks,
    persistedPackages: verified.packages,
    summary: createSuccessSummary(execution.preview),
    backupCreated: true
  };
}
