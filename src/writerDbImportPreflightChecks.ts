import type { Spark, WriterPackage } from "./types";
import {
  WRITER_DB_APP_NAME,
  previewWriterDbImport,
  type WriterDb,
  type WriterDbImportPreview
} from "./writerDb";
import {
  areWriterDbImportPreviewsEquivalent,
  prepareWriterDbImportPreflight
} from "./writerDbImportPreflight";
import type { WriterDbRecoveryInspection } from "./writerDbRecovery";

type TestCase = { name: string; run: () => void };
const EARLIER = "2026-07-19T10:00:00.000Z";
const NOW = "2026-07-19T12:00:00.000Z";

const spark: Spark = {
  id: "spark-preflight",
  text: "Incoming spark",
  createdAt: EARLIER,
  updatedAt: NOW,
  temperature: "spark",
  tags: ["preflight"],
  schemaVersion: 1
};

const writerPackage: WriterPackage = {
  id: "package-preflight",
  title: "Incoming package",
  sparkText: "Source",
  notes: [],
  workshopText: "",
  finalText: "",
  createdAt: EARLIER,
  updatedAt: NOW,
  packageVersion: 1
};

const dbV2: WriterDb = {
  app: WRITER_DB_APP_NAME,
  schemaVersion: 2,
  exportedAt: NOW,
  sparkCount: 1,
  packageCount: 1,
  sparks: [spark],
  packages: [writerPackage]
};

const dbV1: WriterDb = {
  app: WRITER_DB_APP_NAME,
  schemaVersion: 1,
  exportedAt: NOW,
  sparkCount: 1,
  sparks: [spark]
};

const cleanRecovery: WriterDbRecoveryInspection = {
  status: "clean",
  markerPresent: false
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function preview(
  db: WriterDb = dbV2,
  localSparks: readonly Spark[] = [],
  localPackages: readonly WriterPackage[] = []
) {
  return previewWriterDbImport({ incoming: db, localSparks, localPackages });
}

function preflight(options: {
  db?: WriterDb;
  previousPreview?: WriterDbImportPreview;
  currentLocalSparks?: readonly Spark[];
  currentLocalPackages?: readonly WriterPackage[];
  recoveryInspection?: WriterDbRecoveryInspection;
} = {}) {
  const db = options.db ?? dbV2;
  return prepareWriterDbImportPreflight({
    db,
    previousPreview: options.previousPreview ?? preview(db),
    currentLocalSparks: options.currentLocalSparks ?? [],
    currentLocalPackages: options.currentLocalPackages ?? [],
    recoveryInspection: options.recoveryInspection ?? cleanRecovery
  });
}

function recoverableRecovery(): WriterDbRecoveryInspection {
  return {
    status: "recoverable",
    markerPresent: true,
    marker: {
      markerVersion: 1,
      transactionId: "preflight-transaction",
      status: "prepared",
      createdAt: NOW,
      sourceSchemaVersion: 2,
      targetSparkCount: 1,
      targetPackageCount: 1
    },
    backup: {
      backupVersion: 1,
      createdAt: NOW,
      reason: "before-import",
      sourceSchemaVersion: 2,
      sparks: [],
      packages: []
    },
    currentSparksValid: true,
    currentPackagesValid: true,
    warnings: []
  };
}

const blockedRecovery: WriterDbRecoveryInspection = {
  status: "blocked",
  markerPresent: true,
  error: "blocked recovery fixture",
  warnings: []
};

const tests: TestCase[] = [
  {
    name: "clean recovery and equivalent preview are ready",
    run: () => assert(preflight().status === "ready", "equivalent preview was not ready")
  },
  {
    name: "new matching local Spark makes preview stale",
    run: () => {
      const localSpark = { ...spark, updatedAt: EARLIER };
      assert(preflight({ currentLocalSparks: [localSpark] }).status === "stale", "new local Spark was not stale");
    }
  },
  {
    name: "updated local Spark makes preview stale",
    run: () => {
      const olderLocal = { ...spark, updatedAt: EARLIER };
      const previousPreview = preview(dbV2, [olderLocal], []);
      assert(preflight({ previousPreview, currentLocalSparks: [spark] }).status === "stale", "updated local Spark was not stale");
    }
  },
  {
    name: "new matching WriterPackage makes preview stale",
    run: () => {
      const localPackage = { ...writerPackage, updatedAt: EARLIER };
      assert(preflight({ currentLocalPackages: [localPackage] }).status === "stale", "new package was not stale");
    }
  },
  {
    name: "updated WriterPackage makes preview stale",
    run: () => {
      const olderLocal = { ...writerPackage, updatedAt: EARLIER };
      const previousPreview = preview(dbV2, [], [olderLocal]);
      assert(preflight({ previousPreview, currentLocalPackages: [writerPackage] }).status === "stale", "updated package was not stale");
    }
  },
  {
    name: "recoverable marker blocks with recovery-required",
    run: () => {
      const result = preflight({ recoveryInspection: recoverableRecovery() });
      assert(result.status === "blocked" && result.reason === "recovery-required", "recoverable gate changed");
    }
  },
  {
    name: "blocked marker blocks with recovery-blocked",
    run: () => {
      const result = preflight({ recoveryInspection: blockedRecovery });
      assert(result.status === "blocked" && result.reason === "recovery-blocked", "blocked gate changed");
    }
  },
  {
    name: "blocked refreshed preview returns preview-blocked",
    run: () => {
      const duplicateDb: WriterDb = { ...dbV2, sparkCount: 2, sparks: [spark, { ...spark }] };
      const result = preflight({ db: duplicateDb, previousPreview: preview(dbV2) });
      assert(result.status === "blocked" && result.reason === "preview-blocked", "blocked preview was accepted");
    }
  },
  {
    name: "count mismatch warning change makes preview stale",
    run: () => {
      const mismatchDb: WriterDb = { ...dbV2, sparkCount: 9 };
      const previousPreview = { ...preview(mismatchDb), warnings: [] };
      assert(preflight({ db: mismatchDb, previousPreview }).status === "stale", "warning change was not stale");
    }
  },
  {
    name: "same warning set stays ready",
    run: () => {
      const mismatchDb: WriterDb = { ...dbV2, sparkCount: 9 };
      assert(preflight({ db: mismatchDb, previousPreview: preview(mismatchDb) }).status === "ready", "same warnings were stale");
    }
  },
  {
    name: "blocking issues compare deterministically",
    run: () => {
      const a = { ...preview(dbV2), status: "blocked" as const, blockingIssues: [
        { code: "duplicate-spark-id" as const, count: 1, message: "spark" },
        { code: "duplicate-package-id" as const, count: 1, message: "package" }
      ] };
      const b = clone(a);
      const reversed = { ...clone(a), blockingIssues: [...a.blockingIssues].reverse() };
      assert(areWriterDbImportPreviewsEquivalent(a, b), "equal blocking issues differ");
      assert(!areWriterDbImportPreviewsEquivalent(a, reversed), "blocking issue order was ignored");
    }
  },
  {
    name: "v1 Packages remain untouched",
    run: () => {
      const result = preflight({ db: dbV1, previousPreview: preview(dbV1), currentLocalPackages: [writerPackage] });
      assert(result.status === "ready" && result.preview.packages.mode === "untouched", "v1 packages changed");
    }
  },
  {
    name: "tombstone change makes preview stale",
    run: () => {
      const incomingTombstone = { ...spark, deletedAt: NOW };
      const tombstoneDb: WriterDb = { ...dbV2, sparks: [incomingTombstone] };
      const localActive = { ...spark, updatedAt: EARLIER };
      const localDeleted = { ...incomingTombstone };
      const previousPreview = preview(tombstoneDb, [localActive], []);
      assert(
        preflight({
          db: tombstoneDb,
          previousPreview,
          currentLocalSparks: [localDeleted]
        }).status === "stale",
        "tombstone change was not stale"
      );
    }
  },
  {
    name: "preflight does not mutate inputs",
    run: () => {
      const db = clone(dbV2);
      const previousPreview = preview(db);
      const localSparks = [clone(spark)];
      const localPackages = [clone(writerPackage)];
      const recoveryInspection = clone(cleanRecovery);
      const before = clone({ db, previousPreview, localSparks, localPackages, recoveryInspection });
      prepareWriterDbImportPreflight({ db, previousPreview, currentLocalSparks: localSparks, currentLocalPackages: localPackages, recoveryInspection });
      assert(JSON.stringify({ db, previousPreview, localSparks, localPackages, recoveryInspection }) === JSON.stringify(before), "preflight mutated inputs");
    }
  },
  {
    name: "preflight never touches localStorage",
    run: () => {
      const throwingStorage = {
        getItem() { throw new Error("localStorage touched"); },
        setItem() { throw new Error("localStorage touched"); },
        removeItem() { throw new Error("localStorage touched"); }
      };
      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = { localStorage: throwingStorage };
      assert(preflight().status === "ready", "preflight touched localStorage");
    }
  },
  {
    name: "preflight exposes only pure preview outcomes",
    run: () => {
      const result = preflight();
      assert(result.status === "ready" && !Reflect.has(result, "sparks") && !Reflect.has(result, "backup"), "preflight exposed execution result");
    }
  }
];

export function runWriterDbImportPreflightChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok preflight ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import preflight checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportPreflightChecks();
