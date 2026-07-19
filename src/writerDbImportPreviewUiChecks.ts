import type { WriterDb, WriterDbImportPreview } from "./writerDb";
import {
  applyWriterDbImportPreflightResult,
  getWriterDbImportPreviewUiActions,
  resetWriterDbImportPreviewUiState,
  type WriterDbImportPreviewUiState
} from "./writerDbImportPreviewUi";

type TestCase = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const db = {
  app: "LassiLAB Writer",
  schemaVersion: 2,
  exportedAt: "2026-07-19T12:00:00.000Z",
  sparkCount: 0,
  packageCount: 0,
  sparks: [],
  packages: []
} as WriterDb;

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
  warnings: [{ code: "empty-import", message: "empty" }],
  blockingIssues: []
};

function readyState(): Extract<WriterDbImportPreviewUiState, { status: "preview-ready" }> {
  return { status: "preview-ready", fileName: "writer-db.json", db, preview };
}

const tests: TestCase[] = [
  {
    name: "preview-ready and ready preflight become confirmed ready",
    run: () => {
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "ready", preview });
      assert(result.status === "preview-confirmed-ready", "ready result changed");
    }
  },
  {
    name: "changed local data become stale",
    run: () => {
      const refreshedPreview = { ...preview, warnings: [] };
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "stale", previousPreview: preview, refreshedPreview });
      assert(result.status === "preview-stale", "stale result changed");
    }
  },
  {
    name: "stale state displays refreshed preview",
    run: () => {
      const refreshedPreview = { ...preview, warnings: [] };
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "stale", previousPreview: preview, refreshedPreview });
      assert(result.status === "preview-stale" && result.refreshedPreview === refreshedPreview, "refreshed preview missing");
    }
  },
  {
    name: "stale state requires another readiness check",
    run: () => {
      const refreshedPreview = { ...preview, warnings: [] };
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "stale", previousPreview: preview, refreshedPreview });
      assert(getWriterDbImportPreviewUiActions(result).includes("check-readiness"), "stale recheck missing");
    }
  },
  {
    name: "recovery-required becomes preflight blocked",
    run: () => {
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "blocked", reason: "recovery-required", error: "blocked" });
      assert(result.status === "preflight-blocked" && result.reason === "recovery-required", "recovery-required changed");
    }
  },
  {
    name: "recovery-blocked becomes preflight blocked",
    run: () => {
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "blocked", reason: "recovery-blocked", error: "blocked" });
      assert(result.status === "preflight-blocked" && result.reason === "recovery-blocked", "recovery-blocked changed");
    }
  },
  {
    name: "preview-blocked keeps refreshed preview",
    run: () => {
      const blockedPreview = { ...preview, status: "blocked" as const };
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "blocked", reason: "preview-blocked", error: "blocked", preview: blockedPreview });
      assert(result.status === "preflight-blocked" && result.preview === blockedPreview, "blocked preview missing");
    }
  },
  {
    name: "confirmed ready has no import action",
    run: () => {
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "ready", preview });
      assert(!getWriterDbImportPreviewUiActions(result).some((action) => (action as string) === "import"), "ready import action exists");
    }
  },
  {
    name: "blocked state has no import action",
    run: () => {
      const result = applyWriterDbImportPreflightResult(readyState(), { status: "blocked", reason: "recovery-blocked", error: "blocked" });
      assert(!getWriterDbImportPreviewUiActions(result).some((action) => (action as string) === "import"), "blocked import action exists");
    }
  },
  {
    name: "reset returns idle",
    run: () => assert(resetWriterDbImportPreviewUiState().status === "idle", "reset did not return idle")
  }
];

export function runWriterDbImportPreviewUiChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok preview ui ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import preview UI checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportPreviewUiChecks();
