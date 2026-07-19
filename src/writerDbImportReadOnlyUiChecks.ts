import type { WriterDb, WriterDbImportPreview } from "./writerDb";
import {
  applyWriterDbFileSelected,
  applyWriterDbPreflightResult,
  applyWriterDbPreparedPreview,
  resetWriterDbImportUi
} from "./writerDbImportUiAdapter";
import { createWriterDbImportPreviewRevision } from "./writerDbImportPreviewRevision";
import type { WriterDbImportUiState } from "./writerDbImportUiState";

type TestCase = { name: string; run: () => void };
declare function require(name: "fs"): { readFileSync(path: string, encoding: "utf8"): string };
const { readFileSync } = require("fs");
const FILE_NAME = "writer-db.json";

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

const appSource = readFileSync("src/App.tsx", "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readingState(): Extract<WriterDbImportUiState, { status: "reading-file" }> {
  return { status: "reading-file", fileName: FILE_NAME };
}

function readyState(): Extract<WriterDbImportUiState, { status: "preview-ready" }> {
  return {
    status: "preview-ready",
    fileName: FILE_NAME,
    db,
    preview,
    previewRevision: createWriterDbImportPreviewRevision(preview)
  };
}

function sourceBetween(start: string, end: string): string {
  const startIndex = appSource.indexOf(start);
  const endIndex = appSource.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex, `App source boundary missing: ${start}`);
  return appSource.slice(startIndex, endIndex);
}

const tests: TestCase[] = [
  {
    name: "A file-selected uses the typed adapter transition",
    run: () => {
      const result = applyWriterDbFileSelected({ status: "idle" }, FILE_NAME);
      assert(result.accepted && result.state.status === "reading-file", "file selection did not enter reading-file");
      assert(appSource.includes("applyWriterDbFileSelected(importPreviewState, file.name)"), "App bypasses file-selected adapter");
    }
  },
  {
    name: "B successful preparation becomes preview-ready",
    run: () => {
      const revision = createWriterDbImportPreviewRevision(preview);
      const result = applyWriterDbPreparedPreview(readingState(), {
        fileName: FILE_NAME,
        result: { ok: true, db, preview },
        revision
      });
      assert(result.accepted && result.state.status === "preview-ready" && result.state.previewRevision === revision, "prepared preview was not ready");
    }
  },
  {
    name: "C blocked preparation becomes preview-blocked",
    run: () => {
      const result = applyWriterDbPreparedPreview(readingState(), {
        fileName: FILE_NAME,
        result: { ok: false, error: "blocked", blockingIssues: [] },
        revision: ""
      });
      assert(result.accepted && result.state.status === "preview-blocked", "blocked preview was accepted");
    }
  },
  {
    name: "D ready preflight becomes import-confirm-ready",
    run: () => {
      const result = applyWriterDbPreflightResult(readyState(), {
        result: { status: "ready", preview },
        revision: createWriterDbImportPreviewRevision(preview)
      });
      assert(result.accepted && result.state.status === "import-confirm-ready", "ready preflight was not confirmed");
    }
  },
  {
    name: "E stale preflight keeps refreshed preview",
    run: () => {
      const revision = createWriterDbImportPreviewRevision(refreshedPreview);
      const result = applyWriterDbPreflightResult(readyState(), {
        result: { status: "stale", previousPreview: preview, refreshedPreview },
        revision
      });
      assert(result.accepted && result.state.status === "preview-stale" && result.state.preview === refreshedPreview && result.state.previewRevision === revision, "stale preview mapping changed");
    }
  },
  {
    name: "F blocked preflight preserves its concrete reason",
    run: () => {
      const result = applyWriterDbPreflightResult(readyState(), {
        result: { status: "blocked", reason: "recovery-blocked", error: "blocked" },
        revision: readyState().previewRevision
      });
      assert(result.accepted && result.state.status === "preview-blocked" && result.state.reason === "recovery-blocked", "blocked reason was lost");
    }
  },
  {
    name: "G reset is delegated to the state machine",
    run: () => {
      const result = resetWriterDbImportUi(readyState());
      assert(result.accepted && result.state.status === "idle", "reset did not return idle");
      assert(appSource.includes("resetWriterDbImportUi(importPreviewState)"), "App bypasses reset adapter");
    }
  },
  {
    name: "H same file can be selected again after reset",
    run: () => {
      const reset = resetWriterDbImportUi(readyState());
      assert(reset.accepted, "reset setup failed");
      const selected = applyWriterDbFileSelected(reset.state, FILE_NAME);
      assert(selected.accepted && selected.state.status === "reading-file" && selected.state.fileName === FILE_NAME, "same file could not be selected again");
      assert(appSource.includes("importPreviewInputRef.current.value = \"\""), "file input is not cleared");
    }
  },
  {
    name: "I preview revision is deterministic and read-only",
    run: () => {
      const input = clone(preview);
      const before = clone(input);
      assert(createWriterDbImportPreviewRevision(input) === createWriterDbImportPreviewRevision(clone(input)), "equal previews have different revisions");
      assert(JSON.stringify(input) === JSON.stringify(before), "revision helper mutated preview");
    }
  },
  {
    name: "J meaningful preview change changes revision",
    run: () => assert(createWriterDbImportPreviewRevision(preview) !== createWriterDbImportPreviewRevision(refreshedPreview), "changed preview kept old revision")
  },
  {
    name: "K rejected transition preserves the current state",
    run: () => {
      const state = readyState();
      const result = applyWriterDbPreparedPreview(state, {
        fileName: FILE_NAME,
        result: { ok: true, db, preview },
        revision: state.previewRevision
      });
      assert(!result.accepted && result.state === state, "rejected transition replaced state");
      assert(appSource.includes("return transition.accepted ? transition.state : currentState"), "App lacks rejected-transition preservation");
    }
  },
  {
    name: "L read-only App path never calls import execution",
    run: () => {
      assert(!appSource.includes("executeWriterDbImport"), "App calls import coordinator");
      assert(!appSource.includes("requestWriterDbImportStart"), "App requests active import");
      assert(!appSource.includes("applyWriterDbCoordinatorResult"), "App maps coordinator results");
    }
  },
  {
    name: "M preview and readiness handlers contain no write path",
    run: () => {
      const readOnlyHandlers = sourceBetween("function handleCheckImportReadiness()", "async function handleImportDb");
      for (const forbidden of ["importWriterDb(", "mergeWriterDbInMemory", "createWriterDbImportBackup", "persistWriterDbImport", "setItem(", "removeItem("]) {
        assert(!readOnlyHandlers.includes(forbidden), `read-only handlers contain ${forbidden}`);
      }
    }
  },
  {
    name: "N legacy import handler remains separate and unchanged in purpose",
    run: () => {
      const legacyHandler = sourceBetween("async function handleImportDb", "async function handleConnectGoogle");
      assert(legacyHandler.includes("const result = importWriterDb(parsed);"), "legacy import call changed");
      assert(legacyHandler.includes("setSparks(listSparks())"), "legacy import refresh changed");
      assert(!legacyHandler.includes("applyWriterDb"), "legacy handler was mixed with preview adapter");
    }
  },
  {
    name: "O runtime recovery adapter exposes getItem only",
    run: () => {
      const readinessHandler = sourceBetween("function handleCheckImportReadiness()", "async function handleImportPreviewFile");
      assert(readinessHandler.includes("getItem: (key) => window.localStorage.getItem(key)"), "recovery getItem injection missing");
      assert(!readinessHandler.includes("setItem") && !readinessHandler.includes("removeItem"), "recovery adapter can write");
    }
  }
];

export function runWriterDbImportReadOnlyUiChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok read-only ui ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import read-only UI checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportReadOnlyUiChecks();
