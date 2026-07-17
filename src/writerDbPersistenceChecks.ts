import type { Spark, WriterPackage } from "./types";
import { createWriterDbImportBackup, type WriterDbImportBackup } from "./writerDb";
import {
  persistWriterDbImport,
  type WriterDbKeyValueStorage,
  type WriterDbPersistenceKeys
} from "./writerDbPersistence";

type TestCase = { name: string; run: () => void };

const NOW = "2026-07-17T10:00:00.000Z";
const KEYS: WriterDbPersistenceKeys = {
  sparks: "sparks",
  packages: "packages",
  backup: "backup",
  transaction: "transaction"
};

const localSpark: Spark = {
  id: "local-spark",
  text: "Local spark",
  createdAt: "2026-07-17T09:00:00.000Z",
  updatedAt: "2026-07-17T09:01:00.000Z",
  deletedAt: "2026-07-17T09:01:00.000Z",
  stage: "notes",
  temperature: "spark",
  tags: ["local"],
  schemaVersion: 1
};

const localPackage: WriterPackage = {
  id: "local-package",
  title: "Local package",
  sparkText: "Original spark",
  notes: [
    {
      id: "local-note",
      text: "A note",
      createdAt: "2026-07-17T09:00:00.000Z",
      updatedAt: "2026-07-17T09:02:00.000Z",
      deletedAt: "2026-07-17T09:02:00.000Z"
    }
  ],
  workshopText: "Workshop",
  finalText: "Final",
  createdAt: "2026-07-17T09:00:00.000Z",
  updatedAt: "2026-07-17T09:02:00.000Z",
  deletedAt: "2026-07-17T09:02:00.000Z",
  packageVersion: 1,
  legacy: { source: "spark", stage: "workshop" }
};

const targetSpark: Spark = {
  ...localSpark,
  text: "Target spark",
  updatedAt: "2026-07-17T10:01:00.000Z",
  deletedAt: undefined,
  tags: ["target"]
};

const targetPackage: WriterPackage = {
  ...localPackage,
  title: "Target package",
  updatedAt: "2026-07-17T10:02:00.000Z",
  deletedAt: undefined,
  notes: []
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

class MemoryStorage implements WriterDbKeyValueStorage {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  failWhen: ((kind: "get" | "set" | "remove", key: string, count: number) => boolean) | undefined;
  corruptReads = new Map<string, number>();
  private readonly matchCounts = new Map<string, number>();

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.values.set(key, value);
    }
  }

  getItem(key: string): string | null {
    this.record("get", key);
    this.maybeFail("get", key);
    const corruptions = this.corruptReads.get(key) ?? 0;
    if (corruptions > 0) {
      this.corruptReads.set(key, corruptions - 1);
      return "corrupted-read-back";
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.record("set", key);
    this.maybeFail("set", key);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.record("remove", key);
    this.maybeFail("remove", key);
    this.values.delete(key);
  }

  private record(kind: "get" | "set" | "remove", key: string) {
    this.operations.push(`${kind}:${key}`);
  }

  private maybeFail(kind: "get" | "set" | "remove", key: string) {
    const match = `${kind}:${key}`;
    const count = (this.matchCounts.get(match) ?? 0) + 1;
    this.matchCounts.set(match, count);
    if (this.failWhen?.(kind, key, count)) {
      throw new Error(`Injected ${match} failure #${count}`);
    }
  }
}

function createBackup(sparks: readonly Spark[] = [localSpark], packages: readonly WriterPackage[] = [localPackage]): WriterDbImportBackup {
  const result = createWriterDbImportBackup({
    sourceSchemaVersion: 2,
    localSparks: sparks,
    localPackages: packages,
    now: NOW
  });
  if (!result.ok) {
    throw new Error(`backup setup failed: ${result.error}`);
  }
  return result.backup;
}

function createStorage() {
  return new MemoryStorage({
    [KEYS.sparks]: JSON.stringify([localSpark]),
    [KEYS.packages]: JSON.stringify([localPackage])
  });
}

function persist(
  storage: MemoryStorage,
  sparks: readonly Spark[] = [targetSpark],
  packages: readonly WriterPackage[] = [targetPackage]
) {
  return persistWriterDbImport({
    storage,
    keys: KEYS,
    backup: createBackup(),
    sparks,
    packages,
    transactionId: "test-transaction",
    now: NOW
  });
}

const tests: TestCase[] = [
  {
    name: "successful empty import",
    run: () => {
      const storage = createStorage();
      const result = persist(storage, [], []);
      assert(result.ok, "empty import should succeed");
      assert(!storage.values.has(KEYS.transaction), "marker should be removed");
      assertDeepEqual(JSON.parse(storage.values.get(KEYS.sparks) ?? ""), [], "Sparks are not empty");
      assertDeepEqual(JSON.parse(storage.values.get(KEYS.packages) ?? ""), [], "Packages are not empty");
    }
  },
  {
    name: "successful Sparks and Packages write",
    run: () => {
      const storage = createStorage();
      const result = persist(storage);
      assert(result.ok, "full import should succeed");
      assertDeepEqual(JSON.parse(storage.values.get(KEYS.sparks) ?? ""), [targetSpark], "Sparks changed incorrectly");
      assertDeepEqual(JSON.parse(storage.values.get(KEYS.packages) ?? ""), [targetPackage], "Packages changed incorrectly");
    }
  },
  {
    name: "backup precedes marker and collections",
    run: () => {
      const storage = createStorage();
      const result = persist(storage);
      assert(result.ok, "ordered import should succeed");
      assertDeepEqual(
        storage.operations,
        ["set:backup", "get:backup", "set:transaction", "get:transaction", "set:sparks", "get:sparks", "set:packages", "get:packages", "remove:transaction"],
        "critical write order changed"
      );
    }
  },
  {
    name: "marker is prepared before collections and removed after success",
    run: () => {
      const storage = createStorage();
      const result = persist(storage);
      assert(result.ok, "marker import should succeed");
      const marker = storage.values.get(KEYS.transaction);
      assert(marker === undefined, "successful import left marker");
      assert(storage.operations.indexOf("set:transaction") < storage.operations.indexOf("set:sparks"), "marker is late");
    }
  },
  {
    name: "backup read-back validation",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.backup, 1);
      const result = persist(storage);
      assert(!result.ok && result.stage === "backup-verify", "backup corruption was not rejected");
      assert(result.rollbackAttempted === false, "backup failure triggered rollback");
      assertDeepEqual(storage.values.get(KEYS.sparks), JSON.stringify([localSpark]), "Sparks changed on backup failure");
    }
  },
  {
    name: "marker read-back validation",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.transaction, 1);
      const result = persist(storage);
      assert(!result.ok && result.stage === "marker-verify", "marker corruption was not rejected");
      assert(result.rollbackAttempted, "marker failure did not attempt rollback");
    }
  },
  {
    name: "Sparks read-back validation",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.sparks, 1);
      const result = persist(storage);
      assert(!result.ok && result.stage === "sparks-verify", "Spark corruption was not rejected");
      assert(result.rollbackSucceeded, "Spark failure did not rollback");
    }
  },
  {
    name: "Packages read-back validation",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.packages, 1);
      const result = persist(storage);
      assert(!result.ok && result.stage === "packages-verify", "Package corruption was not rejected");
      assert(result.rollbackSucceeded, "Package failure did not rollback");
    }
  },
  {
    name: "backup write failure leaves collections unchanged",
    run: () => {
      const storage = createStorage();
      storage.failWhen = (kind, key) => kind === "set" && key === KEYS.backup;
      const result = persist(storage);
      assert(!result.ok && result.stage === "backup-write", "backup write failure was not reported");
      assert(!result.rollbackAttempted, "backup write failure attempted rollback");
      assertDeepEqual(storage.values.get(KEYS.sparks), JSON.stringify([localSpark]), "Sparks changed");
    }
  },
  {
    name: "marker write failure leaves collections unchanged",
    run: () => {
      const storage = createStorage();
      storage.failWhen = (kind, key) => kind === "set" && key === KEYS.transaction;
      const result = persist(storage);
      assert(!result.ok && result.stage === "marker-write", "marker write failure was not reported");
      assert(result.rollbackAttempted, "marker write failure did not rollback");
      assertDeepEqual(storage.values.get(KEYS.sparks), JSON.stringify([localSpark]), "Sparks changed");
    }
  },
  {
    name: "Sparks write failure rolls back",
    run: () => {
      const storage = createStorage();
      storage.failWhen = (kind, key, count) => kind === "set" && key === KEYS.sparks && count === 1;
      const result = persist(storage);
      assert(!result.ok && result.stage === "sparks-write", "Spark write failure was not reported");
      assert(result.rollbackSucceeded, "Spark write failure did not rollback");
    }
  },
  {
    name: "Packages write failure rolls back",
    run: () => {
      const storage = createStorage();
      storage.failWhen = (kind, key, count) => kind === "set" && key === KEYS.packages && count === 1;
      const result = persist(storage);
      assert(!result.ok && result.stage === "packages-write", "Package write failure was not reported");
      assert(result.rollbackSucceeded, "Package write failure did not rollback");
    }
  },
  {
    name: "successful rollback removes marker",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.packages, 1);
      const result = persist(storage);
      assert(!result.ok && result.rollbackSucceeded, "rollback did not succeed");
      assert(!storage.values.has(KEYS.transaction), "successful rollback left marker");
    }
  },
  {
    name: "failed rollback leaves marker",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.packages, 1);
      storage.failWhen = (kind, key, count) => kind === "set" && key === KEYS.packages && count === 2;
      const result = persist(storage);
      assert(!result.ok && !result.rollbackSucceeded, "failed rollback was reported as successful");
      assert(storage.values.has(KEYS.transaction), "failed rollback removed marker");
    }
  },
  {
    name: "rollback restores tombstones, tags, notes, and legacy metadata",
    run: () => {
      const storage = createStorage();
      storage.corruptReads.set(KEYS.packages, 1);
      const result = persist(storage);
      assert(!result.ok && result.rollbackSucceeded, "rollback setup failed");
      assertDeepEqual(JSON.parse(storage.values.get(KEYS.sparks) ?? ""), [localSpark], "Spark metadata was not restored");
      assertDeepEqual(JSON.parse(storage.values.get(KEYS.packages) ?? ""), [localPackage], "Package metadata was not restored");
    }
  },
  {
    name: "invalid backup is rejected before writes",
    run: () => {
      const storage = createStorage();
      const invalid = { ...createBackup(), sparks: [{ id: "broken" }] } as unknown as WriterDbImportBackup;
      const result = persistWriterDbImport({ storage, keys: KEYS, backup: invalid, sparks: [targetSpark], packages: [targetPackage], now: NOW });
      assert(!result.ok && result.stage === "validation", "invalid backup was accepted");
      assert(storage.operations.length === 0, "invalid backup touched storage");
    }
  },
  {
    name: "invalid target Sparks are rejected before writes",
    run: () => {
      const storage = createStorage();
      const result = persist(storage, [{ ...targetSpark, updatedAt: "broken" } as Spark]);
      assert(!result.ok && result.stage === "validation", "invalid Sparks were accepted");
      assert(storage.operations.length === 0, "invalid Sparks touched storage");
    }
  },
  {
    name: "invalid target Packages are rejected before writes",
    run: () => {
      const storage = createStorage();
      const result = persist(
        storage,
        [targetSpark],
        [{ ...targetPackage, packageVersion: 2 } as unknown as WriterPackage]
      );
      assert(!result.ok && result.stage === "validation", "invalid Packages were accepted");
      assert(storage.operations.length === 0, "invalid Packages touched storage");
    }
  },
  {
    name: "duplicate ids are rejected before writes",
    run: () => {
      const storage = createStorage();
      const result = persist(storage, [targetSpark, targetSpark]);
      assert(!result.ok && result.stage === "validation", "duplicate ids were accepted");
      assert(storage.operations.length === 0, "duplicate ids touched storage");
    }
  },
  {
    name: "input immutability",
    run: () => {
      const storage = createStorage();
      const backup = createBackup();
      const backupBefore = clone(backup);
      const sparks = [clone(targetSpark)];
      const packages = [clone(targetPackage)];
      const sparksBefore = clone(sparks);
      const packagesBefore = clone(packages);
      const result = persistWriterDbImport({ storage, keys: KEYS, backup, sparks, packages, now: NOW });
      assert(result.ok, "immutability setup failed");
      assertDeepEqual(backup, backupBefore, "backup was mutated");
      assertDeepEqual(sparks, sparksBefore, "Sparks were mutated");
      assertDeepEqual(packages, packagesBefore, "Packages were mutated");
    }
  },
  {
    name: "coordinator never touches real localStorage",
    run: () => {
      const storage = createStorage();
      const realLocalStorage = {
        getItem() { throw new Error("real localStorage touched"); },
        setItem() { throw new Error("real localStorage touched"); },
        removeItem() { throw new Error("real localStorage touched"); }
      };
      (globalThis as unknown as { window: { localStorage: typeof realLocalStorage } }).window = {
        localStorage: realLocalStorage
      };
      const result = persist(storage);
      assert(result.ok, "injected storage persistence failed");
    }
  }
];

export function runWriterDbPersistenceChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok persistence ${passed} - ${test.name}`);
  }
  console.log(`Writer DB persistence checks passed: ${passed}/${tests.length}`);
}

runWriterDbPersistenceChecks();
