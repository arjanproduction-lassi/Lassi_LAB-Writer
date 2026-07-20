import type { Spark, WriterPackage } from "./types";
import type { WriterDbImportPreview } from "./writerDb";
import {
  executeWriterDbImport,
  type ExecuteWriterDbImportInput,
  type ExecuteWriterDbImportResult
} from "./writerDbImportCoordinator";
import { createWriterDbImportPreviewRevision } from "./writerDbImportPreviewRevision";
import {
  applyWriterDbCoordinatorResult,
  requestWriterDbImportStart
} from "./writerDbImportUiAdapter";
import type {
  WriterDbImportUiState,
  WriterDbImportUiTransitionResult
} from "./writerDbImportUiState";
import type {
  WriterDbKeyValueStorage,
  WriterDbPersistenceKeys
} from "./writerDbPersistence";
import {
  inspectWriterDbRecovery,
  type WriterDbRecoveryInspection
} from "./writerDbRecovery";

export const WRITER_DB_IMPORT_KEYS: WriterDbPersistenceKeys = {
  sparks: "lassilab-writer:v0.1:sparks",
  packages: "lassilab-writer:v0.1:packages",
  backup: "lassilab-writer:v0.1:writer-db:backup-before-import",
  transaction: "lassilab-writer:v0.1:writer-db:import-transaction"
};

export type WriterDbImportRecoveryGate =
  | { status: "checking" }
  | { status: "clean"; inspection: Extract<WriterDbRecoveryInspection, { status: "clean" }> }
  | {
      status: "recoverable";
      inspection: Extract<WriterDbRecoveryInspection, { status: "recoverable" }>;
    }
  | { status: "blocked"; inspection: Extract<WriterDbRecoveryInspection, { status: "blocked" }> };

export function createWriterDbImportStorage(
  storage: WriterDbKeyValueStorage
): WriterDbKeyValueStorage {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key)
  };
}

export function inspectWriterDbImportRecoveryGate(
  storage: Pick<WriterDbKeyValueStorage, "getItem">,
  keys: WriterDbPersistenceKeys = WRITER_DB_IMPORT_KEYS
): Exclude<WriterDbImportRecoveryGate, { status: "checking" }> {
  const inspection = inspectWriterDbRecovery({ storage, keys });
  return { status: inspection.status, inspection } as Exclude<
    WriterDbImportRecoveryGate,
    { status: "checking" }
  >;
}

export function createWriterDbImportRuntimeValues(input: {
  now: () => string;
  createTransactionId: () => string;
}) {
  const backupCreatedAt = input.now();
  const transactionCreatedAt = input.now();
  const transactionId = input.createTransactionId();

  if (
    Number.isNaN(Date.parse(backupCreatedAt)) ||
    Number.isNaN(Date.parse(transactionCreatedAt)) ||
    !transactionId.trim()
  ) {
    throw new Error("Writer DB import runtime vytvoril neplatný čas alebo transaction ID.");
  }

  return { backupCreatedAt, transactionCreatedAt, transactionId };
}

type ImportingState = Extract<WriterDbImportUiState, { status: "importing" }>;

export type RunWriterDbImportRuntimeResult = {
  startTransition: WriterDbImportUiTransitionResult;
  finalTransition?: WriterDbImportUiTransitionResult;
  recoveryGate?: Exclude<WriterDbImportRecoveryGate, { status: "checking" }>;
  coordinatorResult?: ExecuteWriterDbImportResult;
};

export function runWriterDbImportRuntime(input: {
  state: WriterDbImportUiState;
  confirmedRevision: string;
  storage: WriterDbKeyValueStorage;
  keys?: WriterDbPersistenceKeys;
  loadCurrentLocalSparks: () => readonly Spark[];
  loadCurrentLocalPackages: () => readonly WriterPackage[];
  now: () => string;
  createTransactionId: () => string;
  onImporting: (state: ImportingState) => void;
  inspectRecovery?: typeof inspectWriterDbImportRecoveryGate;
  execute?: (input: ExecuteWriterDbImportInput) => ExecuteWriterDbImportResult;
  createRevision?: (preview: WriterDbImportPreview) => string;
}): RunWriterDbImportRuntimeResult {
  const startTransition = requestWriterDbImportStart(input.state, input.confirmedRevision);
  if (!startTransition.accepted || startTransition.state.status !== "importing") {
    return { startTransition };
  }

  const importingState = startTransition.state;
  input.onImporting(importingState);

  const keys = input.keys ?? WRITER_DB_IMPORT_KEYS;
  const inspectRecovery = input.inspectRecovery ?? inspectWriterDbImportRecoveryGate;
  const recoveryGate = inspectRecovery(input.storage, keys);

  if (recoveryGate.status !== "clean") {
    const coordinatorResult: ExecuteWriterDbImportResult = {
      status: "blocked",
      reason: recoveryGate.status === "recoverable" ? "recovery-required" : "recovery-blocked",
      error: recoveryGate.status === "recoverable"
        ? "Predchádzajúca databázová operácia zostala nedokončená."
        : recoveryGate.inspection.error
    };
    return {
      startTransition,
      recoveryGate,
      coordinatorResult,
      finalTransition: applyWriterDbCoordinatorResult(importingState, { result: coordinatorResult })
    };
  }

  const runtime = createWriterDbImportRuntimeValues(input);
  const execute = input.execute ?? executeWriterDbImport;
  const coordinatorResult = execute({
    storage: input.storage,
    keys,
    db: importingState.db,
    previousPreview: importingState.confirmedPreview,
    currentLocalSparks: input.loadCurrentLocalSparks(),
    currentLocalPackages: input.loadCurrentLocalPackages(),
    recoveryInspection: recoveryGate.inspection,
    ...runtime
  });
  const finalTransition = coordinatorResult.status === "stale"
    ? applyWriterDbCoordinatorResult(importingState, {
        result: coordinatorResult,
        refreshedRevision: (input.createRevision ?? createWriterDbImportPreviewRevision)(
          coordinatorResult.refreshedPreview
        )
      })
    : applyWriterDbCoordinatorResult(importingState, { result: coordinatorResult });

  return { startTransition, finalTransition, recoveryGate, coordinatorResult };
}
