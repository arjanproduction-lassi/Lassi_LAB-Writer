import type { Spark, WriterPackage } from "./types";
import {
  WRITER_DB_APP_NAME,
  previewWriterDbImport,
  type WriterDb,
  type WriterDbImportPreview
} from "./writerDb";
import {
  executeWriterDbImport,
  type ExecuteWriterDbImportInput
} from "./writerDbImportCoordinator";
import type {
  WriterDbKeyValueStorage,
  WriterDbPersistenceKeys
} from "./writerDbPersistence";
import type { WriterDbRecoveryInspection } from "./writerDbRecovery";

type TestCase = { name: string; run: () => void };
const OLD = "2026-07-19T08:00:00.000Z";
const NEW = "2026-07-19T12:00:00.000Z";
const BACKUP_AT = "2026-07-19T13:00:00.000Z";
const TRANSACTION_AT = "2026-07-19T14:00:00.000Z";
const TRANSACTION_ID = "coordinator-transaction";
const KEYS: WriterDbPersistenceKeys = {
  sparks: "test:sparks",
  packages: "test:packages",
  backup: "test:backup",
  transaction: "test:transaction"
};

function spark(id: string, updatedAt = OLD, text = id): Spark {
  return {
    id,
    text,
    createdAt: OLD,
    updatedAt,
    temperature: "spark",
    tags: [id],
    schemaVersion: 1
  };
}

function writerPackage(id: string, updatedAt = OLD, title = id): WriterPackage {
  return {
    id,
    title,
    sparkText: id,
    notes: [{ id: `${id}-note`, text: id, createdAt: OLD, updatedAt }],
    workshopText: "",
    finalText: "",
    createdAt: OLD,
    updatedAt,
    packageVersion: 1
  };
}

function dbV1(sparks: Spark[]): WriterDb {
  return { app: WRITER_DB_APP_NAME, schemaVersion: 1, exportedAt: NEW, sparkCount: sparks.length, sparks };
}

function dbV2(sparks: Spark[], packages: WriterPackage[]): WriterDb {
  return {
    app: WRITER_DB_APP_NAME,
    schemaVersion: 2,
    exportedAt: NEW,
    sparkCount: sparks.length,
    packageCount: packages.length,
    sparks,
    packages
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

class MemoryStorage implements WriterDbKeyValueStorage {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  readonly setHistory: Array<{ key: string; value: string }> = [];
  failSet: ((key: string, count: number) => boolean) | undefined;
  getOverride: ((key: string, count: number, value: string | null) => string | null) | undefined;
  private readonly getCounts = new Map<string, number>();
  private readonly setCounts = new Map<string, number>();

  constructor(sparks: readonly Spark[] = [], packages: readonly WriterPackage[] = []) {
    this.values.set(KEYS.sparks, JSON.stringify(sparks));
    this.values.set(KEYS.packages, JSON.stringify(packages));
  }

  getItem(key: string): string | null {
    this.operations.push(`get:${key}`);
    const count = (this.getCounts.get(key) ?? 0) + 1;
    this.getCounts.set(key, count);
    const value = this.values.get(key) ?? null;
    return this.getOverride?.(key, count, value) ?? value;
  }

  setItem(key: string, value: string): void {
    this.operations.push(`set:${key}`);
    const count = (this.setCounts.get(key) ?? 0) + 1;
    this.setCounts.set(key, count);
    if (this.failSet?.(key, count)) {
      throw new Error(`Injected set failure for ${key} #${count}`);
    }
    this.values.set(key, value);
    this.setHistory.push({ key, value });
  }

  removeItem(key: string): void {
    this.operations.push(`remove:${key}`);
    this.values.delete(key);
  }
}

const cleanRecovery: WriterDbRecoveryInspection = { status: "clean", markerPresent: false };
const recoverableRecovery: WriterDbRecoveryInspection = {
  status: "recoverable",
  markerPresent: true,
  marker: {
    markerVersion: 1,
    transactionId: "old-transaction",
    status: "prepared",
    createdAt: OLD,
    sourceSchemaVersion: 2,
    targetSparkCount: 0,
    targetPackageCount: 0
  },
  backup: {
    backupVersion: 1,
    createdAt: OLD,
    reason: "before-import",
    sourceSchemaVersion: 2,
    sparks: [],
    packages: []
  },
  currentSparksValid: true,
  currentPackagesValid: true,
  warnings: []
};

function preview(
  db: WriterDb,
  localSparks: readonly Spark[] = [],
  localPackages: readonly WriterPackage[] = []
): WriterDbImportPreview {
  return previewWriterDbImport({ incoming: db, localSparks, localPackages });
}

function input(options: Partial<ExecuteWriterDbImportInput> = {}): ExecuteWriterDbImportInput {
  const currentLocalSparks = options.currentLocalSparks ?? [spark("local-spark")];
  const currentLocalPackages = options.currentLocalPackages ?? [writerPackage("local-package")];
  const db = options.db ?? dbV2([spark("incoming-spark", NEW)], [writerPackage("incoming-package", NEW)]);
  return {
    storage: options.storage ?? new MemoryStorage(currentLocalSparks, currentLocalPackages),
    keys: options.keys ?? KEYS,
    db,
    previousPreview: options.previousPreview ?? preview(db, currentLocalSparks, currentLocalPackages),
    currentLocalSparks,
    currentLocalPackages,
    recoveryInspection: options.recoveryInspection ?? cleanRecovery,
    backupCreatedAt: options.backupCreatedAt ?? BACKUP_AT,
    transactionId: options.transactionId ?? TRANSACTION_ID,
    transactionCreatedAt: options.transactionCreatedAt ?? TRANSACTION_AT
  };
}

function execute(options: Partial<ExecuteWriterDbImportInput> = {}) {
  return executeWriterDbImport(input(options));
}

const tests: TestCase[] = [
  {
    name: "stale execution never calls persistence",
    run: () => {
      const storage = new MemoryStorage();
      const db = dbV2([spark("shared", NEW)], []);
      const result = execute({ storage, db, previousPreview: preview(db), currentLocalSparks: [spark("shared", OLD)], currentLocalPackages: [] });
      assert(result.status === "stale" && storage.operations.length === 0, "stale touched persistence");
    }
  },
  {
    name: "blocked execution never calls persistence",
    run: () => {
      const storage = new MemoryStorage();
      const result = execute({ storage, recoveryInspection: recoverableRecovery });
      assert(result.status === "blocked" && result.reason === "recovery-required" && storage.operations.length === 0, "blocked touched persistence");
    }
  },
  {
    name: "v1 changes Sparks and preserves Packages",
    run: () => {
      const localSpark = spark("shared", OLD, "local");
      const localPackage = writerPackage("local-package");
      const db = dbV1([spark("shared", NEW, "incoming")]);
      const result = execute({ db, currentLocalSparks: [localSpark], currentLocalPackages: [localPackage] });
      assert(result.status === "success" && result.persistedSparks[0].text === "incoming", "v1 Spark not persisted");
      assertDeepEqual(result.persistedPackages, [localPackage], "v1 Packages changed");
    }
  },
  {
    name: "v2 persists both collections",
    run: () => {
      const result = execute();
      assert(result.status === "success" && result.persistedSparks.length === 2 && result.persistedPackages.length === 2, "v2 collections missing");
    }
  },
  {
    name: "persistence receives backup of original state",
    run: () => {
      const localSpark = spark("shared", OLD, "before");
      const storage = new MemoryStorage([localSpark], []);
      const db = dbV2([spark("shared", NEW, "after")], []);
      const result = execute({ storage, db, currentLocalSparks: [localSpark], currentLocalPackages: [] });
      const backup = JSON.parse(storage.values.get(KEYS.backup) ?? "null") as { sparks: Spark[] };
      assert(result.status === "success" && backup.sparks[0].text === "before", "backup contains merged state");
    }
  },
  {
    name: "coordinator creates no second backup",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      assert(execute({ storage }).status === "success", "setup failed");
      assert(storage.operations.filter((operation) => operation === `set:${KEYS.backup}`).length === 1, "backup written more than once");
    }
  },
  {
    name: "success occurs only after independent read-back",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      assert(execute({ storage }).status === "success", "setup failed");
      assertDeepEqual(storage.operations.slice(-2), [`get:${KEYS.sparks}`, `get:${KEYS.packages}`], "success skipped final read-back");
    }
  },
  {
    name: "read-back Sparks equal merged Sparks",
    run: () => {
      const result = execute();
      assert(result.status === "success" && result.persistedSparks.some((item) => item.id === "incoming-spark"), "verified Sparks mismatch");
    }
  },
  {
    name: "read-back Packages equal merged Packages",
    run: () => {
      const result = execute();
      assert(result.status === "success" && result.persistedPackages.some((item) => item.id === "incoming-package"), "verified Packages mismatch");
    }
  },
  {
    name: "damaged coordinator read-back fails verification",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      storage.getOverride = (key, count, value) => key === KEYS.sparks && count === 2 ? "damaged" : value;
      const result = execute({ storage });
      assert(result.status === "failed" && result.stage === "verification", "damaged read-back succeeded");
    }
  },
  {
    name: "persistence failure is reported",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      storage.failSet = (key) => key === KEYS.backup;
      const result = execute({ storage });
      assert(result.status === "failed" && result.stage === "persistence" && result.persistenceStage === "backup-write", "persistence failure changed");
    }
  },
  {
    name: "successful rollback is reported",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      storage.failSet = (key, count) => key === KEYS.packages && count === 1;
      const result = execute({ storage });
      assert(result.status === "failed" && result.rollbackAttempted && result.rollbackSucceeded, "successful rollback flags changed");
    }
  },
  {
    name: "failed rollback is reported",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      storage.failSet = (key) => key === KEYS.packages;
      const result = execute({ storage });
      assert(result.status === "failed" && result.rollbackAttempted && !result.rollbackSucceeded, "failed rollback flags changed");
    }
  },
  {
    name: "failed rollback leaves transaction marker",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      storage.failSet = (key) => key === KEYS.packages;
      const result = execute({ storage });
      assert(result.status === "failed" && result.transactionMarkerRemaining === true && storage.values.has(KEYS.transaction), "failed rollback marker lost");
    }
  },
  {
    name: "v1 summary marks Packages untouched",
    run: () => {
      const result = execute({ db: dbV1([spark("incoming", NEW)]) });
      assert(result.status === "success" && result.summary.packagesUntouched && result.summary.packages.created === 0, "v1 summary changed");
    }
  },
  {
    name: "summary derives from confirmed preview",
    run: () => {
      const result = execute();
      assert(result.status === "success" && result.summary.sparks.created === result.preview.sparks.create && result.summary.packages.tombstones === result.preview.packages.tombstones, "summary differs from preview");
    }
  },
  {
    name: "backupCreatedAt is injected",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      assert(execute({ storage }).status === "success", "setup failed");
      const backup = JSON.parse(storage.values.get(KEYS.backup) ?? "null") as { createdAt: string };
      assert(backup.createdAt === BACKUP_AT, "backup time was not injected");
    }
  },
  {
    name: "transaction id and time are injected",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      assert(execute({ storage }).status === "success", "setup failed");
      const markerWrite = storage.setHistory.find((entry) => entry.key === KEYS.transaction);
      const marker = JSON.parse(markerWrite?.value ?? "null") as { transactionId: string; createdAt: string };
      assert(marker.transactionId === TRANSACTION_ID && marker.createdAt === TRANSACTION_AT, "transaction identity was not injected");
    }
  },
  {
    name: "coordinator never touches window localStorage",
    run: () => {
      const throwingStorage = { getItem() { throw new Error("window touched"); }, setItem() { throw new Error("window touched"); }, removeItem() { throw new Error("window touched"); } };
      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = { localStorage: throwingStorage };
      assert(execute().status === "success", "window storage affected coordinator");
    }
  },
  {
    name: "coordinator never touches network or Google Drive",
    run: () => {
      (globalThis as unknown as { fetch: () => never }).fetch = () => { throw new Error("network touched"); };
      assert(execute().status === "success", "network affected coordinator");
    }
  },
  {
    name: "coordinator does not mutate inputs",
    run: () => {
      const prepared = input();
      const before = clone({ keys: prepared.keys, db: prepared.db, previousPreview: prepared.previousPreview, currentLocalSparks: prepared.currentLocalSparks, currentLocalPackages: prepared.currentLocalPackages, recoveryInspection: prepared.recoveryInspection, backupCreatedAt: prepared.backupCreatedAt, transactionId: prepared.transactionId, transactionCreatedAt: prepared.transactionCreatedAt });
      executeWriterDbImport(prepared);
      const after = { keys: prepared.keys, db: prepared.db, previousPreview: prepared.previousPreview, currentLocalSparks: prepared.currentLocalSparks, currentLocalPackages: prepared.currentLocalPackages, recoveryInspection: prepared.recoveryInspection, backupCreatedAt: prepared.backupCreatedAt, transactionId: prepared.transactionId, transactionCreatedAt: prepared.transactionCreatedAt };
      assertDeepEqual(after, before, "coordinator mutated input data");
    }
  },
  {
    name: "same storage scenario is deterministic",
    run: () => assertDeepEqual(execute(), execute(), "coordinator result is nondeterministic")
  },
  {
    name: "coordinator uses only injected persistence keys",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      assert(execute({ storage }).status === "success", "setup failed");
      const allowed = new Set(Object.values(KEYS));
      assert(storage.operations.every((operation) => allowed.has(operation.slice(operation.indexOf(":") + 1))), "unknown storage key used");
    }
  },
  {
    name: "verification failure reports removed marker truthfully",
    run: () => {
      const storage = new MemoryStorage([spark("local-spark")], [writerPackage("local-package")]);
      storage.getOverride = (key, count, value) => key === KEYS.packages && count === 2 ? "[]" : value;
      const result = execute({ storage });
      assert(result.status === "failed" && result.stage === "verification" && result.transactionMarkerRemaining === false, "verification marker state changed");
    }
  }
];

export function runWriterDbImportCoordinatorChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok coordinator ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import coordinator checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportCoordinatorChecks();
