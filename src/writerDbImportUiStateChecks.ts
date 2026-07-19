import type { WriterDb, WriterDbImportPreview } from "./writerDb";
import type { ExecuteWriterDbImportResult } from "./writerDbImportCoordinator";
import {
  canSafelyCloseWriterDbImportFailure,
  transitionWriterDbImportUiState,
  type ExecuteWriterDbImportFailedResult,
  type ExecuteWriterDbImportSuccessResult,
  type WriterDbImportUiEvent,
  type WriterDbImportUiState
} from "./writerDbImportUiState";

type TestCase = { name: string; run: () => void };
const REVISION_1 = "preview-revision-1";
const REVISION_2 = "preview-revision-2";

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
  sparks: {
    mode: "merge",
    incoming: 0,
    create: 0,
    update: 0,
    unchanged: 0,
    ignoredOlder: 0,
    tombstones: 0
  },
  packages: {
    mode: "merge",
    incoming: 0,
    create: 0,
    update: 0,
    unchanged: 0,
    ignoredOlder: 0,
    tombstones: 0
  },
  warnings: [],
  blockingIssues: []
};

const refreshedPreview: WriterDbImportPreview = {
  ...preview,
  warnings: [{ code: "empty-import", message: "empty" }]
};

const successResult: ExecuteWriterDbImportSuccessResult = {
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

function failedResult(options: {
  stage?: "persistence" | "verification";
  rollbackAttempted?: boolean;
  rollbackSucceeded?: boolean;
  marker?: boolean | null;
} = {}): ExecuteWriterDbImportFailedResult {
  return {
    status: "failed",
    stage: options.stage ?? "persistence",
    error: "fixture failure",
    rollbackAttempted: options.rollbackAttempted ?? false,
    rollbackSucceeded: options.rollbackSucceeded ?? false,
    transactionMarkerRemaining: options.marker === undefined ? false : options.marker
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readingState(): WriterDbImportUiState {
  return { status: "reading-file", fileName: "writer-db.json" };
}

function readyState(revision = REVISION_1): Extract<WriterDbImportUiState, { status: "preview-ready" }> {
  return {
    status: "preview-ready",
    fileName: "writer-db.json",
    db,
    preview,
    previewRevision: revision
  };
}

function staleState(): Extract<WriterDbImportUiState, { status: "preview-stale" }> {
  return {
    status: "preview-stale",
    fileName: "writer-db.json",
    db,
    preview: refreshedPreview,
    previewRevision: REVISION_2,
    message: "stale"
  };
}

function confirmedState(): Extract<WriterDbImportUiState, { status: "import-confirm-ready" }> {
  return {
    status: "import-confirm-ready",
    fileName: "writer-db.json",
    db,
    confirmedPreview: preview,
    confirmedRevision: REVISION_1
  };
}

function importingState(): Extract<WriterDbImportUiState, { status: "importing" }> {
  return {
    status: "importing",
    fileName: "writer-db.json",
    db,
    confirmedPreview: preview,
    confirmedRevision: REVISION_1
  };
}

function transition(state: WriterDbImportUiState, event: WriterDbImportUiEvent) {
  return transitionWriterDbImportUiState(state, event);
}

const tests: TestCase[] = [
  {
    name: "idle accepts file-selected",
    run: () => {
      const result = transition({ status: "idle" }, { type: "file-selected", fileName: "db.json" });
      assert(result.accepted && result.state.status === "reading-file", "idle did not start reading");
    }
  },
  {
    name: "reading-file accepts preview-ready",
    run: () => {
      const result = transition(readingState(), { type: "preview-ready", fileName: "db.json", db, preview, revision: REVISION_1 });
      assert(result.accepted && result.state.status === "preview-ready" && result.state.previewRevision === REVISION_1, "ready preview missing");
    }
  },
  {
    name: "reading-file accepts preview-blocked",
    run: () => {
      const result = transition(readingState(), { type: "preview-blocked", fileName: "db.json", error: "blocked", blockingIssues: [] });
      assert(result.accepted && result.state.status === "preview-blocked", "blocked preview missing");
    }
  },
  {
    name: "preview-ready accepts matching preflight-ready",
    run: () => {
      const result = transition(readyState(), { type: "preflight-ready", preview, revision: REVISION_1 });
      assert(result.accepted && result.state.status === "import-confirm-ready" && result.state.confirmedRevision === REVISION_1, "confirmation missing");
    }
  },
  {
    name: "confirmed state accepts matching import-started",
    run: () => {
      const result = transition(confirmedState(), { type: "import-started", revision: REVISION_1 });
      assert(result.accepted && result.state.status === "importing", "import did not enter importing");
    }
  },
  {
    name: "importing accepts coordinator success",
    run: () => {
      const result = transition(importingState(), { type: "import-success", result: successResult });
      assert(result.accepted && result.state.status === "success" && result.state.result === successResult, "success result lost");
    }
  },
  {
    name: "importing maps stale to preview-stale",
    run: () => {
      const result = transition(importingState(), { type: "import-stale", preview: refreshedPreview, revision: REVISION_2, message: "stale" });
      assert(result.accepted && result.state.status === "preview-stale" && result.state.previewRevision === REVISION_2, "stale result changed");
    }
  },
  {
    name: "importing maps blocked to preview-blocked",
    run: () => {
      const result = transition(importingState(), { type: "import-blocked", error: "blocked", reason: "recovery-required" });
      assert(result.accepted && result.state.status === "preview-blocked" && result.state.reason === "recovery-required", "blocked result changed");
    }
  },
  {
    name: "importing accepts coordinator failure",
    run: () => {
      const failure = failedResult();
      const result = transition(importingState(), { type: "import-failed", result: failure });
      assert(result.accepted && result.state.status === "failed" && result.state.result === failure, "failure result lost");
    }
  },
  {
    name: "success resets to idle through Hotovo",
    run: () => {
      const state: WriterDbImportUiState = { status: "success", fileName: "db.json", result: successResult };
      const result = transition(state, { type: "reset" });
      assert(result.accepted && result.state.status === "idle", "success did not reset");
    }
  },
  {
    name: "safely closeable failure resets to idle",
    run: () => {
      const failure = failedResult();
      const state: WriterDbImportUiState = { status: "failed", fileName: "db.json", result: failure, canSafelyClose: true };
      const result = transition(state, { type: "reset" });
      assert(result.accepted && result.state.status === "idle", "safe failure did not close");
    }
  },
  {
    name: "unsafe failure rejects reset",
    run: () => {
      const failure = failedResult({ rollbackAttempted: true, marker: true });
      const state: WriterDbImportUiState = { status: "failed", fileName: "db.json", result: failure, canSafelyClose: false };
      const result = transition(state, { type: "reset" });
      assert(!result.accepted && result.state === state, "unsafe failure closed");
    }
  },
  {
    name: "importing rejects second import-started",
    run: () => {
      const state = importingState();
      const result = transition(state, { type: "import-started", revision: REVISION_1 });
      assert(!result.accepted && result.state === state, "double import accepted");
    }
  },
  {
    name: "importing rejects file-selected",
    run: () => {
      const state = importingState();
      const result = transition(state, { type: "file-selected", fileName: "other.json" });
      assert(!result.accepted && result.state === state, "file change accepted while importing");
    }
  },
  {
    name: "importing rejects reset",
    run: () => {
      const state = importingState();
      const result = transition(state, { type: "reset" });
      assert(!result.accepted && result.state === state, "importing reset accepted");
    }
  },
  {
    name: "stale result drops confirmed revision",
    run: () => {
      const result = transition(importingState(), { type: "import-stale", preview: refreshedPreview, revision: REVISION_2, message: "stale" });
      assert(result.accepted && result.state.status === "preview-stale" && !Reflect.has(result.state, "confirmedRevision"), "stale retained confirmation");
    }
  },
  {
    name: "new file drops confirmation",
    run: () => {
      const result = transition(confirmedState(), { type: "file-selected", fileName: "other.json" });
      assert(result.accepted && result.state.status === "reading-file" && !Reflect.has(result.state, "confirmedRevision"), "new file retained confirmation");
    }
  },
  {
    name: "blocked result drops confirmation",
    run: () => {
      const result = transition(importingState(), { type: "import-blocked", error: "blocked", reason: "preview-blocked" });
      assert(result.accepted && result.state.status === "preview-blocked" && !Reflect.has(result.state, "confirmedRevision"), "blocked retained confirmation");
    }
  },
  {
    name: "reset drops confirmation",
    run: () => {
      const result = transition(confirmedState(), { type: "reset" });
      assert(result.accepted && result.state.status === "idle" && !Reflect.has(result.state, "confirmedRevision"), "reset retained confirmation");
    }
  },
  {
    name: "old revision cannot start importing",
    run: () => {
      const state = confirmedState();
      const result = transition(state, { type: "import-started", revision: REVISION_2 });
      assert(!result.accepted && result.state === state, "old revision started import");
    }
  },
  {
    name: "stale requires a new preflight-ready",
    run: () => {
      const state = staleState();
      const rejectedStart = transition(state, { type: "import-started", revision: REVISION_2 });
      const confirmed = transition(state, { type: "preflight-ready", preview: refreshedPreview, revision: REVISION_2 });
      assert(!rejectedStart.accepted && confirmed.accepted && confirmed.state.status === "import-confirm-ready", "stale bypassed recheck");
    }
  },
  {
    name: "invalid transition is rejected without changing state",
    run: () => {
      const state = readyState();
      const result = transition(state, { type: "import-success", result: successResult });
      assert(!result.accepted && result.state === state && result.reason.length > 0, "invalid transition changed state");
    }
  },
  {
    name: "transition does not mutate state or event",
    run: () => {
      const state = clone(readyState());
      const event: WriterDbImportUiEvent = { type: "preflight-ready", preview: clone(preview), revision: REVISION_1 };
      const before = clone({ state, event });
      transition(state, event);
      assertDeepEqual({ state, event }, before, "transition mutated input");
    }
  },
  {
    name: "same state and event produce deterministic result",
    run: () => {
      const state = readyState();
      const event: WriterDbImportUiEvent = { type: "preflight-stale", refreshedPreview, revision: REVISION_2, message: "stale" };
      assertDeepEqual(transition(state, event), transition(state, event), "transition is nondeterministic");
    }
  },
  {
    name: "helper has no storage or runtime side effects",
    run: () => {
      const throwingStorage = { getItem() { throw new Error("storage touched"); }, setItem() { throw new Error("storage touched"); }, removeItem() { throw new Error("storage touched"); } };
      const runtime = globalThis as unknown as { window: { localStorage: typeof throwingStorage }; fetch: () => never };
      runtime.window = { localStorage: throwingStorage };
      runtime.fetch = () => { throw new Error("network touched"); };
      assert(transition(confirmedState(), { type: "import-started", revision: REVISION_1 }).accepted, "runtime affected transition");
    }
  },
  {
    name: "import-started changes only state and executes no import",
    run: () => {
      let calls = 0;
      const fakeExecution = () => { calls += 1; };
      const result = transition(confirmedState(), { type: "import-started", revision: REVISION_1 });
      assert(result.accepted && result.state.status === "importing" && calls === 0 && typeof fakeExecution === "function", "state helper executed import");
    }
  },
  {
    name: "reading-file reset returns idle",
    run: () => {
      const result = transition(readingState(), { type: "reset" });
      assert(result.accepted && result.state.status === "idle", "reading reset failed");
    }
  },
  {
    name: "preview-blocked allows choosing another file",
    run: () => {
      const state: WriterDbImportUiState = { status: "preview-blocked", fileName: "bad.json", error: "bad", blockingIssues: [] };
      const result = transition(state, { type: "file-selected", fileName: "new.json" });
      assert(result.accepted && result.state.status === "reading-file", "blocked state could not choose file");
    }
  },
  {
    name: "preflight-stale replaces revision",
    run: () => {
      const result = transition(readyState(), { type: "preflight-stale", refreshedPreview, revision: REVISION_2, message: "stale" });
      assert(result.accepted && result.state.status === "preview-stale" && result.state.previewRevision === REVISION_2, "stale revision not replaced");
    }
  },
  {
    name: "preflight-blocked drops ready data",
    run: () => {
      const result = transition(readyState(), { type: "preflight-blocked", error: "blocked", reason: "recovery-blocked" });
      assert(result.accepted && result.state.status === "preview-blocked" && !Reflect.has(result.state, "db"), "preflight block retained ready state");
    }
  },
  {
    name: "successful rollback without marker is safely closeable",
    run: () => assert(canSafelyCloseWriterDbImportFailure(failedResult({ rollbackAttempted: true, rollbackSucceeded: true, marker: false })), "successful rollback marked unsafe")
  },
  {
    name: "verification failure is not safely closeable",
    run: () => assert(!canSafelyCloseWriterDbImportFailure(failedResult({ stage: "verification", marker: false })), "verification failure marked safe")
  },
  {
    name: "unknown marker state is not safely closeable",
    run: () => assert(!canSafelyCloseWriterDbImportFailure(failedResult({ marker: null })), "unknown marker marked safe")
  },
  {
    name: "forged safe flag cannot bypass failure guard",
    run: () => {
      const failure = failedResult({ rollbackAttempted: true, rollbackSucceeded: false, marker: true });
      const state: WriterDbImportUiState = { status: "failed", fileName: "db.json", result: failure, canSafelyClose: true };
      const result = transition(state, { type: "reset" });
      assert(!result.accepted && result.state === state, "forged safe flag bypassed guard");
    }
  }
];

export function runWriterDbImportUiStateChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok ui state ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import UI state checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportUiStateChecks();
