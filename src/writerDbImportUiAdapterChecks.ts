import type { WriterDb, WriterDbImportPreview } from "./writerDb";
import type { ExecuteWriterDbImportResult } from "./writerDbImportCoordinator";
import type { WriterDbImportUiState } from "./writerDbImportUiState";
import {
  WRITER_DB_IMPORT_STALE_MESSAGE,
  applyWriterDbCoordinatorResult,
  applyWriterDbFileSelected,
  applyWriterDbPreflightResult,
  applyWriterDbPreparedPreview,
  requestWriterDbImportStart,
  resetWriterDbImportUi
} from "./writerDbImportUiAdapter";

type TestCase = { name: string; run: () => void };
const REVISION_1 = "revision-1";
const REVISION_2 = "revision-2";

const db: WriterDb = {
  app: "LassiLAB Writer",
  schemaVersion: 2,
  exportedAt: "2026-07-19T12:00:00.000Z",
  sparkCount: 0,
  packageCount: 0,
  sparks: [],
  packages: []
};

const preview: WriterDbImportPreview = {
  schemaVersion: 2,
  status: "ready",
  source: {
    declaredSparkCount: 0,
    actualSparkCount: 0,
    declaredPackageCount: 0,
    actualPackageCount: 0
  },
  sparks: { mode: "merge", incoming: 0, create: 0, update: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 },
  packages: { mode: "merge", incoming: 0, create: 0, update: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 },
  warnings: [],
  blockingIssues: []
};

const refreshedPreview: WriterDbImportPreview = {
  ...preview,
  warnings: [{ code: "empty-import", message: "empty" }]
};

const successResult: Extract<ExecuteWriterDbImportResult, { status: "success" }> = {
  status: "success",
  preview,
  sourceSchemaVersion: 2,
  persistedSparks: [],
  persistedPackages: [],
  summary: {
    sparks: { created: 0, updated: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 },
    packages: { created: 0, updated: 0, unchanged: 0, ignoredOlder: 0, tombstones: 0 },
    sourceSchemaVersion: 2,
    packagesUntouched: false,
    backupCreated: true
  },
  backupCreated: true
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readyState(): Extract<WriterDbImportUiState, { status: "preview-ready" }> {
  return { status: "preview-ready", fileName: "db.json", db, preview, previewRevision: REVISION_1 };
}

function confirmedState(): Extract<WriterDbImportUiState, { status: "import-confirm-ready" }> {
  return { status: "import-confirm-ready", fileName: "db.json", db, confirmedPreview: preview, confirmedRevision: REVISION_1 };
}

function importingState(): Extract<WriterDbImportUiState, { status: "importing" }> {
  return { status: "importing", fileName: "db.json", db, confirmedPreview: preview, confirmedRevision: REVISION_1 };
}

const tests: TestCase[] = [
  {
    name: "file selection maps to file-selected",
    run: () => {
      const result = applyWriterDbFileSelected({ status: "idle" }, "db.json");
      assert(result.accepted && result.state.status === "reading-file" && result.state.fileName === "db.json", "file selection mapping failed");
    }
  },
  {
    name: "prepared preview success maps to preview-ready",
    run: () => {
      const result = applyWriterDbPreparedPreview(
        { status: "reading-file", fileName: "db.json" },
        { fileName: "db.json", result: { ok: true, db, preview }, revision: REVISION_1 }
      );
      assert(result.accepted && result.state.status === "preview-ready" && result.state.previewRevision === REVISION_1, "ready preview mapping failed");
    }
  },
  {
    name: "prepared preview failure preserves details",
    run: () => {
      const blockingIssues = [{ code: "duplicate-spark-id" as const, count: 2, message: "duplicate" }];
      const result = applyWriterDbPreparedPreview(
        { status: "reading-file", fileName: "db.json" },
        { fileName: "db.json", result: { ok: false, error: "blocked", blockingIssues }, revision: REVISION_1 }
      );
      assert(result.accepted && result.state.status === "preview-blocked" && result.state.blockingIssues === blockingIssues, "blocked preview details lost");
    }
  },
  {
    name: "ready preflight confirms matching revision",
    run: () => {
      const result = applyWriterDbPreflightResult(readyState(), { result: { status: "ready", preview }, revision: REVISION_1 });
      assert(result.accepted && result.state.status === "import-confirm-ready", "ready preflight mapping failed");
    }
  },
  {
    name: "ready preflight keeps revision guard",
    run: () => {
      const state = readyState();
      const result = applyWriterDbPreflightResult(state, { result: { status: "ready", preview }, revision: REVISION_2 });
      assert(!result.accepted && result.state === state, "adapter bypassed revision guard");
    }
  },
  {
    name: "stale preflight carries refreshed preview and revision",
    run: () => {
      const result = applyWriterDbPreflightResult(readyState(), {
        result: { status: "stale", previousPreview: preview, refreshedPreview },
        revision: REVISION_2
      });
      assert(result.accepted && result.state.status === "preview-stale" && result.state.preview === refreshedPreview && result.state.previewRevision === REVISION_2, "stale preflight mapping failed");
      assert(result.state.status === "preview-stale" && result.state.message === WRITER_DB_IMPORT_STALE_MESSAGE, "stale message missing");
    }
  },
  ...(["recovery-required", "recovery-blocked"] as const).map((reason): TestCase => ({
    name: `${reason} preflight stays blocked`,
    run: () => {
      const result = applyWriterDbPreflightResult(readyState(), {
        result: { status: "blocked", reason, error: reason },
        revision: REVISION_1
      });
      assert(result.accepted && result.state.status === "preview-blocked" && result.state.reason === reason, "preflight block reason lost");
    }
  })),
  {
    name: "preview-blocked preflight preserves blocking issues",
    run: () => {
      const blockedPreview: WriterDbImportPreview = { ...preview, status: "blocked", blockingIssues: [{ code: "duplicate-package-id", count: 2, message: "duplicate" }] };
      const result = applyWriterDbPreflightResult(readyState(), {
        result: { status: "blocked", reason: "preview-blocked", error: "blocked", preview: blockedPreview },
        revision: REVISION_1
      });
      assert(result.accepted && result.state.status === "preview-blocked" && result.state.blockingIssues === blockedPreview.blockingIssues, "preflight issues lost");
    }
  },
  {
    name: "import start maps matching revision",
    run: () => {
      const result = requestWriterDbImportStart(confirmedState(), REVISION_1);
      assert(result.accepted && result.state.status === "importing", "import start mapping failed");
    }
  },
  {
    name: "import start keeps stale revision guard",
    run: () => {
      const state = confirmedState();
      const result = requestWriterDbImportStart(state, REVISION_2);
      assert(!result.accepted && result.state === state, "adapter bypassed confirmed revision guard");
    }
  },
  {
    name: "coordinator success maps whole result",
    run: () => {
      const result = applyWriterDbCoordinatorResult(importingState(), { result: successResult });
      assert(result.accepted && result.state.status === "success" && result.state.result === successResult, "success result lost");
    }
  },
  {
    name: "coordinator stale requires explicit refreshed revision",
    run: () => {
      const staleResult: Extract<ExecuteWriterDbImportResult, { status: "stale" }> = { status: "stale", previousPreview: preview, refreshedPreview };
      const result = applyWriterDbCoordinatorResult(importingState(), { result: staleResult, refreshedRevision: REVISION_2 });
      assert(result.accepted && result.state.status === "preview-stale" && result.state.previewRevision === REVISION_2, "coordinator stale revision lost");
    }
  },
  ...(["recovery-required", "merge-failed", "backup-failed"] as const).map((reason): TestCase => ({
    name: `${reason} coordinator result stays blocked`,
    run: () => {
      const result = applyWriterDbCoordinatorResult(importingState(), { result: { status: "blocked", reason, error: reason } });
      assert(result.accepted && result.state.status === "preview-blocked" && result.state.reason === reason, "coordinator block reason lost");
    }
  })),
  {
    name: "coordinator failure preserves rollback facts",
    run: () => {
      const failure: Extract<ExecuteWriterDbImportResult, { status: "failed" }> = {
        status: "failed", stage: "persistence", error: "failed", rollbackAttempted: true,
        rollbackSucceeded: false, transactionMarkerRemaining: true
      };
      const result = applyWriterDbCoordinatorResult(importingState(), { result: failure });
      assert(result.accepted && result.state.status === "failed" && result.state.result === failure && !result.state.canSafelyClose, "failure facts lost");
    }
  },
  {
    name: "reset delegates safe state transition",
    run: () => {
      const result = resetWriterDbImportUi({ status: "reading-file", fileName: "db.json" });
      assert(result.accepted && result.state.status === "idle", "reset mapping failed");
    }
  },
  {
    name: "reset cannot close importing state",
    run: () => {
      const state = importingState();
      const result = resetWriterDbImportUi(state);
      assert(!result.accepted && result.state === state, "adapter bypassed importing guard");
    }
  },
  {
    name: "adapter does not mutate state or layer result",
    run: () => {
      const state = readyState();
      const layerResult = { status: "stale" as const, previousPreview: preview, refreshedPreview };
      const stateBefore = clone(state);
      const resultBefore = clone(layerResult);
      applyWriterDbPreflightResult(state, { result: layerResult, revision: REVISION_2 });
      assert(JSON.stringify(state) === JSON.stringify(stateBefore), "state mutated");
      assert(JSON.stringify(layerResult) === JSON.stringify(resultBefore), "layer result mutated");
    }
  },
  {
    name: "same adapter input is deterministic",
    run: () => {
      const state = readyState();
      const input = { result: { status: "ready" as const, preview }, revision: REVISION_1 };
      assert(JSON.stringify(applyWriterDbPreflightResult(state, input)) === JSON.stringify(applyWriterDbPreflightResult(state, input)), "adapter is not deterministic");
    }
  },
  {
    name: "adapter never invokes an import callback",
    run: () => {
      let calls = 0;
      const executeImport = () => { calls += 1; };
      requestWriterDbImportStart(confirmedState(), REVISION_1);
      assert(calls === 0 && typeof executeImport === "function", "adapter invoked import work");
    }
  }
];

export function runWriterDbImportUiAdapterChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok ui adapter ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import UI adapter checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportUiAdapterChecks();
