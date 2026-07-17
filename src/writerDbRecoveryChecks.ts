import type { Spark, WriterPackage } from "./types";
import { createWriterDbImportBackup, type WriterDbImportBackup } from "./writerDb";
import type {
  WriterDbImportTransactionMarker,
  WriterDbKeyValueStorage,
  WriterDbPersistenceKeys
} from "./writerDbPersistence";
import {
  inspectWriterDbRecovery,
  type WriterDbRecoveryInspection,
  type WriterDbRecoveryWarning
} from "./writerDbRecovery";

type TestCase = { name: string; run: () => void };
const NOW = "2026-07-17T12:00:00.000Z";
const KEYS: WriterDbPersistenceKeys = {
  sparks: "sparks",
  packages: "packages",
  backup: "backup",
  transaction: "transaction"
};

const spark: Spark = {
  id: "spark-recovery",
  text: "Recovery spark",
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:10:00.000Z",
  deletedAt: "2026-07-17T10:10:00.000Z",
  stage: "notes",
  temperature: "spark",
  tags: ["recovery"],
  schemaVersion: 1
};

const writerPackage: WriterPackage = {
  id: "package-recovery",
  title: "Recovery package",
  sparkText: "Original spark",
  notes: [{
    id: "note-recovery",
    text: "Recovery note",
    createdAt: "2026-07-17T10:20:00.000Z",
    updatedAt: "2026-07-17T10:30:00.000Z",
    deletedAt: "2026-07-17T10:30:00.000Z"
  }],
  workshopText: "Workshop",
  finalText: "Final",
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:30:00.000Z",
  deletedAt: "2026-07-17T10:30:00.000Z",
  packageVersion: 1,
  legacy: { source: "spark", stage: "workshop" }
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class ReadOnlyMemoryStorage implements WriterDbKeyValueStorage {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  failGetWhen: ((key: string) => boolean) | undefined;

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) this.values.set(key, value);
  }

  getItem(key: string): string | null {
    this.operations.push(`get:${key}`);
    if (this.failGetWhen?.(key)) {
      throw new Error(`Injected get:${key} failure`);
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, _value: string): void {
    this.operations.push(`set:${key}`);
    throw new Error("Recovery inspection must not call setItem");
  }

  removeItem(key: string): void {
    this.operations.push(`remove:${key}`);
    throw new Error("Recovery inspection must not call removeItem");
  }
}

function createBackup(sourceSchemaVersion: 1 | 2 = 2): WriterDbImportBackup {
  const result = createWriterDbImportBackup({
    sourceSchemaVersion,
    localSparks: [spark],
    localPackages: [writerPackage],
    now: NOW
  });
  if (!result.ok) throw new Error(`Recovery backup setup failed: ${result.error}`);
  return result.backup;
}

function createMarker(
  overrides: Partial<WriterDbImportTransactionMarker> = {}
): WriterDbImportTransactionMarker {
  return {
    markerVersion: 1,
    transactionId: "recovery-transaction",
    status: "prepared",
    createdAt: NOW,
    sourceSchemaVersion: 2,
    targetSparkCount: 1,
    targetPackageCount: 1,
    ...overrides
  };
}

type StorageOptions = {
  marker?: unknown;
  includeMarker?: boolean;
  backup?: unknown;
  includeBackup?: boolean;
  currentSparks?: unknown;
  currentPackages?: unknown;
};

function createStorage(options: StorageOptions = {}) {
  const values: Record<string, string> = {
    [KEYS.sparks]: JSON.stringify(options.currentSparks ?? [spark]),
    [KEYS.packages]: JSON.stringify(options.currentPackages ?? [writerPackage])
  };
  if (options.includeMarker !== false) {
    values[KEYS.transaction] = typeof options.marker === "string"
      ? options.marker
      : JSON.stringify(options.marker ?? createMarker());
  }
  if (options.includeBackup !== false) {
    values[KEYS.backup] = typeof options.backup === "string"
      ? options.backup
      : JSON.stringify(options.backup ?? createBackup());
  }
  return new ReadOnlyMemoryStorage(values);
}

function inspect(storage: ReadOnlyMemoryStorage): WriterDbRecoveryInspection {
  return inspectWriterDbRecovery({ storage, keys: KEYS });
}

function warningCodes(warnings: WriterDbRecoveryWarning[]) {
  return warnings.map((warning) => warning.code);
}

const tests: TestCase[] = [
  {
    name: "no marker is clean",
    run: () => {
      const result = inspect(createStorage({ includeMarker: false }));
      assert(result.status === "clean" && !result.markerPresent, "missing marker is not clean");
    }
  },
  {
    name: "valid marker and backup are recoverable",
    run: () => {
      const result = inspect(createStorage());
      assert(result.status === "recoverable", "valid recovery state is not recoverable");
      assert(result.marker.transactionId === "recovery-transaction", "marker changed");
      assert(result.backup.backupVersion === 1, "backup changed");
    }
  },
  {
    name: "matching v1 marker and backup are recoverable",
    run: () => {
      const marker = createMarker({ sourceSchemaVersion: 1 });
      const result = inspect(createStorage({ marker, backup: createBackup(1) }));
      assert(result.status === "recoverable", "matching v1 marker and backup were blocked");
      assert(result.marker.sourceSchemaVersion === 1, "v1 marker schema changed");
      assert(result.backup.sourceSchemaVersion === 1, "v1 backup schema changed");
    }
  },
  {
    name: "damaged marker is blocked",
    run: () => {
      const result = inspect(createStorage({ marker: "not-json" }));
      assert(result.status === "blocked", "damaged marker was accepted");
    }
  },
  {
    name: "unknown markerVersion is blocked",
    run: () => {
      const result = inspect(createStorage({ marker: { ...createMarker(), markerVersion: 2 } }));
      assert(result.status === "blocked", "unknown markerVersion was accepted");
    }
  },
  {
    name: "missing backup is blocked",
    run: () => {
      const result = inspect(createStorage({ includeBackup: false }));
      assert(result.status === "blocked", "missing backup was accepted");
    }
  },
  {
    name: "damaged backup is blocked",
    run: () => {
      const result = inspect(createStorage({ backup: "not-json" }));
      assert(result.status === "blocked", "damaged backup was accepted");
    }
  },
  {
    name: "unknown backupVersion is blocked",
    run: () => {
      const result = inspect(createStorage({ backup: { ...createBackup(), backupVersion: 2 } }));
      assert(result.status === "blocked", "unknown backupVersion was accepted");
    }
  },
  {
    name: "duplicate backup ids are blocked",
    run: () => {
      const backup = createBackup();
      const duplicateBackup: WriterDbImportBackup = {
        ...backup,
        sparks: [backup.sparks[0], { ...backup.sparks[0] }]
      };
      const result = inspect(createStorage({ backup: duplicateBackup }));
      assert(result.status === "blocked", "duplicate backup ids were accepted");
    }
  },
  {
    name: "marker and backup source schema mismatch is blocked",
    run: () => {
      const result = inspect(createStorage({ backup: createBackup(1) }));
      assert(result.status === "blocked", "source schema mismatch was accepted");
    }
  },
  {
    name: "damaged current Sparks stay recoverable with warning",
    run: () => {
      const result = inspect(createStorage({ currentSparks: [{ id: "broken" }] }));
      assert(result.status === "recoverable", "damaged current Sparks blocked recovery");
      assert(!result.currentSparksValid, "damaged current Sparks were marked valid");
      assert(warningCodes(result.warnings).includes("current-sparks-invalid"), "Spark warning missing");
    }
  },
  {
    name: "damaged current Packages stay recoverable with warning",
    run: () => {
      const result = inspect(createStorage({ currentPackages: [{ id: "broken" }] }));
      assert(result.status === "recoverable", "damaged current Packages blocked recovery");
      assert(!result.currentPackagesValid, "damaged current Packages were marked valid");
      assert(warningCodes(result.warnings).includes("current-packages-invalid"), "Package warning missing");
    }
  },
  {
    name: "current collection read failures stay recoverable with warnings",
    run: () => {
      const storage = createStorage();
      storage.failGetWhen = (key) => key === KEYS.sparks || key === KEYS.packages;
      const result = inspect(storage);
      assert(result.status === "recoverable", "current read failures blocked recovery");
      assertDeepEqual(
        warningCodes(result.warnings),
        ["current-sparks-invalid", "current-packages-invalid"],
        "current read failure warnings changed"
      );
    }
  },
  {
    name: "target count mismatch is warning only",
    run: () => {
      const marker = createMarker({ targetSparkCount: 2, targetPackageCount: 3 });
      const result = inspect(createStorage({ marker }));
      assert(result.status === "recoverable", "count mismatch blocked recovery");
      assert(
        warningCodes(result.warnings).filter((code) => code === "target-count-mismatch").length === 2,
        "count mismatch warnings are incomplete"
      );
    }
  },
  {
    name: "valid current collections have no warnings",
    run: () => {
      const result = inspect(createStorage());
      assert(result.status === "recoverable", "valid current state is not recoverable");
      assert(result.currentSparksValid && result.currentPackagesValid, "valid collections rejected");
      assertDeepEqual(result.warnings, [], "valid current state has warnings");
    }
  },
  {
    name: "backup preserves record and note tombstones",
    run: () => {
      const result = inspect(createStorage());
      assert(result.status === "recoverable", "tombstone backup is not recoverable");
      assert(result.backup.sparks[0].deletedAt === spark.deletedAt, "Spark tombstone changed");
      assert(result.backup.packages[0].deletedAt === writerPackage.deletedAt, "Package tombstone changed");
      assert(result.backup.packages[0].notes[0].deletedAt === writerPackage.notes[0].deletedAt, "note tombstone changed");
    }
  },
  {
    name: "backup preserves tags notes and legacy metadata",
    run: () => {
      const result = inspect(createStorage());
      assert(result.status === "recoverable", "metadata backup is not recoverable");
      assertDeepEqual(result.backup.sparks[0].tags, spark.tags, "tags changed");
      assertDeepEqual(result.backup.packages[0].notes, writerPackage.notes, "notes changed");
      assertDeepEqual(result.backup.packages[0].legacy, writerPackage.legacy, "legacy metadata changed");
    }
  },
  {
    name: "inspection never calls setItem or removeItem",
    run: () => {
      const storage = createStorage();
      const result = inspect(storage);
      assert(result.status === "recoverable", "read-only inspection failed");
      assert(storage.operations.every((operation) => operation.startsWith("get:")), "inspection wrote to storage");
    }
  },
  {
    name: "inspection does not mutate storage or keys",
    run: () => {
      const storage = createStorage();
      const valuesBefore = clone(Object.fromEntries(storage.values));
      const keys = clone(KEYS);
      const keysBefore = clone(keys);
      const result = inspectWriterDbRecovery({ storage, keys });
      assert(result.status === "recoverable", "immutability inspection failed");
      assertDeepEqual(Object.fromEntries(storage.values), valuesBefore, "storage values changed");
      assertDeepEqual(keys, keysBefore, "storage keys changed");
    }
  },
  {
    name: "inspection never uses window.localStorage",
    run: () => {
      const realLocalStorage = {
        getItem() { throw new Error("real localStorage touched"); },
        setItem() { throw new Error("real localStorage touched"); },
        removeItem() { throw new Error("real localStorage touched"); }
      };
      (globalThis as unknown as { window: { localStorage: typeof realLocalStorage } }).window = {
        localStorage: realLocalStorage
      };
      const result = inspect(createStorage());
      assert(result.status === "recoverable", "injected recovery inspection failed");
    }
  }
];

export function runWriterDbRecoveryChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok recovery ${passed} - ${test.name}`);
  }
  console.log(`Writer DB recovery checks passed: ${passed}/${tests.length}`);
}

runWriterDbRecoveryChecks();
