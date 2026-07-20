import type { WriterDb, WriterDbImportPreview } from "./writerDb";
import type { ExecuteWriterDbImportResult } from "./writerDbImportCoordinator";
import {
  createWriterDbImportRuntimeValues,
  createWriterDbImportStorage,
  inspectWriterDbImportRecoveryGate,
  runWriterDbImportRuntime,
  WRITER_DB_IMPORT_KEYS
} from "./writerDbImportRuntime";
import type { WriterDbImportUiState } from "./writerDbImportUiState";

type TestCase = { name: string; run: () => void };

const db: WriterDb = {
  app: "LassiLAB Writer",
  schemaVersion: 2,
  exportedAt: "2026-07-20T10:00:00.000Z",
  sparkCount: 0,
  packageCount: 0,
  sparks: [],
  packages: []
};
const preview: WriterDbImportPreview = {
  schemaVersion: 2,
  status: "ready",
  source: { declaredSparkCount: 0, actualSparkCount: 0, declaredPackageCount: 0, actualPackageCount: 0 },
  sparks: { mode: "merge", incoming: 0, create: 0, update: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 },
  packages: { mode: "merge", incoming: 0, create: 0, update: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 },
  warnings: [],
  blockingIssues: []
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function confirmedState(): Extract<WriterDbImportUiState, { status: "import-confirm-ready" }> {
  return { status: "import-confirm-ready", fileName: "writer-db.json", db, confirmedPreview: preview, confirmedRevision: "rev-1" };
}

function successResult(): Extract<ExecuteWriterDbImportResult, { status: "success" }> {
  const empty = { created: 0, updated: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 };
  return {
    status: "success",
    preview,
    sourceSchemaVersion: 2,
    persistedSparks: [],
    persistedPackages: [],
    summary: { sparks: empty, packages: empty, sourceSchemaVersion: 2, packagesUntouched: false, backupCreated: true },
    backupCreated: true
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    writes,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes.push(`set:${key}`); values.set(key, value); },
    removeItem: (key: string) => { writes.push(`remove:${key}`); values.delete(key); }
  };
}

function runWith(options: {
  state?: WriterDbImportUiState;
  recovery?: "clean" | "recoverable" | "blocked";
  executeResult?: ExecuteWriterDbImportResult;
}) {
  let executeCalls = 0;
  let importingCalls = 0;
  const storage = fakeStorage();
  const recovery = options.recovery ?? "clean";
  const result = runWriterDbImportRuntime({
    state: options.state ?? confirmedState(),
    confirmedRevision: "rev-1",
    storage,
    loadCurrentLocalSparks: () => [],
    loadCurrentLocalPackages: () => [],
    now: () => "2026-07-20T10:00:00.000Z",
    createTransactionId: () => "opaque-transaction-id",
    onImporting: () => { importingCalls += 1; },
    inspectRecovery: () => recovery === "clean"
      ? { status: "clean", inspection: { status: "clean", markerPresent: false } }
      : recovery === "recoverable"
        ? { status: "recoverable", inspection: {
            status: "recoverable", markerPresent: true,
            marker: { markerVersion: 1, transactionId: "old", status: "prepared", createdAt: "2026-07-20T09:00:00.000Z", sourceSchemaVersion: 2, targetSparkCount: 0, targetPackageCount: 0 },
            backup: { backupVersion: 1, createdAt: "2026-07-20T09:00:00.000Z", reason: "before-import", sourceSchemaVersion: 2, sparks: [], packages: [] },
            currentSparksValid: true, currentPackagesValid: true, warnings: []
          } }
        : { status: "blocked", inspection: { status: "blocked", markerPresent: true, error: "blocked", warnings: [] } },
    execute: () => { executeCalls += 1; return options.executeResult ?? successResult(); }
  });
  return { result, executeCalls, importingCalls, storage };
}

const tests: TestCase[] = [
  { name: "rejected import start performs no coordinator call", run: () => {
    const run = runWith({ state: { status: "idle" } });
    assert(!run.result.startTransition.accepted && run.executeCalls === 0 && run.importingCalls === 0, "rejected start performed work");
  } },
  { name: "accepted import start calls coordinator exactly once", run: () => {
    const run = runWith({});
    assert(run.result.startTransition.accepted && run.importingCalls === 1 && run.executeCalls === 1, "accepted start call count changed");
  } },
  { name: "second start from importing cannot call coordinator", run: () => {
    const first = runWith({});
    assert(first.result.startTransition.accepted && first.result.startTransition.state.status === "importing", "first start failed");
    const second = runWith({ state: first.result.startTransition.state });
    assert(second.executeCalls === 0 && !second.result.startTransition.accepted, "double click reached coordinator");
  } },
  { name: "fresh clean recovery permits coordinator", run: () => assert(runWith({ recovery: "clean" }).executeCalls === 1, "clean recovery blocked import") },
  { name: "recoverable marker blocks coordinator", run: () => {
    const run = runWith({ recovery: "recoverable" });
    assert(run.executeCalls === 0 && run.result.coordinatorResult?.status === "blocked" && run.result.coordinatorResult.reason === "recovery-required", "recoverable marker was not typed blocked");
  } },
  { name: "blocked recovery blocks coordinator", run: () => {
    const run = runWith({ recovery: "blocked" });
    assert(run.executeCalls === 0 && run.result.coordinatorResult?.status === "blocked" && run.result.coordinatorResult.reason === "recovery-blocked", "blocked recovery reached coordinator");
  } },
  { name: "success maps only from coordinator success", run: () => assert(runWith({}).result.finalTransition?.state.status === "success", "success mapping failed") },
  { name: "stale remains preview-stale with refreshed revision", run: () => {
    const stale: ExecuteWriterDbImportResult = { status: "stale", previousPreview: preview, refreshedPreview: { ...preview, warnings: [{ code: "empty-import", message: "changed" }] } };
    const run = runWith({ executeResult: stale });
    assert(run.result.finalTransition?.state.status === "preview-stale", "stale became a generic failure");
  } },
  { name: "coordinator blocked remains typed blocked", run: () => {
    const run = runWith({ executeResult: { status: "blocked", reason: "backup-failed", error: "backup" } });
    assert(run.result.finalTransition?.state.status === "preview-blocked" && run.result.finalTransition.state.reason === "backup-failed", "blocked reason was lost");
  } },
  { name: "failed result preserves rollback and marker fields", run: () => {
    const failed: ExecuteWriterDbImportResult = { status: "failed", stage: "persistence", error: "write", rollbackAttempted: true, rollbackSucceeded: false, transactionMarkerRemaining: true };
    const run = runWith({ executeResult: failed });
    assert(run.result.finalTransition?.state.status === "failed" && run.result.finalTransition.state.result.transactionMarkerRemaining === true && !run.result.finalTransition.state.canSafelyClose, "unsafe failure details changed");
  } },
  { name: "runtime values use only injected clock and id", run: () => {
    const times = ["2026-07-20T10:00:00.000Z", "2026-07-20T10:00:01.000Z"];
    const values = createWriterDbImportRuntimeValues({ now: () => times.shift() as string, createTransactionId: () => "opaque-id" });
    assert(values.backupCreatedAt.endsWith("00.000Z") && values.transactionCreatedAt.endsWith("01.000Z") && values.transactionId === "opaque-id", "runtime injection changed");
  } },
  { name: "empty transaction id is rejected before persistence", run: () => {
    let rejected = false;
    try { createWriterDbImportRuntimeValues({ now: () => "2026-07-20T10:00:00.000Z", createTransactionId: () => "" }); } catch { rejected = true; }
    assert(rejected, "empty transaction id was accepted");
  } },
  { name: "storage adapter delegates without adding keys", run: () => {
    const storage = fakeStorage();
    const adapter = createWriterDbImportStorage(storage);
    adapter.setItem("known", "value"); adapter.getItem("known"); adapter.removeItem("known");
    assert(storage.writes.join(",") === "set:known,remove:known", "storage adapter added behavior");
  } },
  { name: "runtime uses exactly the four existing storage keys", run: () => {
    assert(Object.keys(WRITER_DB_IMPORT_KEYS).length === 4 && WRITER_DB_IMPORT_KEYS.transaction === "lassilab-writer:v0.1:writer-db:import-transaction", "storage key contract changed");
  } },
  { name: "recovery gate inspection is read-only", run: () => {
    const storage = fakeStorage();
    const gate = inspectWriterDbImportRecoveryGate(storage);
    assert(gate.status === "clean" && storage.writes.length === 0, "recovery gate wrote storage");
  } }
];

let passed = 0;
for (const test of tests) {
  test.run(); passed += 1; console.log(`ok import runtime ${passed} - ${test.name}`);
}
console.log(`Writer DB import runtime checks passed: ${passed}/${tests.length}`);
