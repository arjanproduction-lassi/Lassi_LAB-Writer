import type { Spark, WriterPackage } from "./types";
import {
  WRITER_DB_APP_NAME,
  previewWriterDbImport,
  type WriterDb,
  type WriterDbImportPreview
} from "./writerDb";
import {
  prepareWriterDbImportExecution,
  type PrepareWriterDbImportExecutionInput
} from "./writerDbImportExecution";
import type { WriterDbRecoveryInspection } from "./writerDbRecovery";

type TestCase = { name: string; run: () => void };
const OLD = "2026-07-19T08:00:00.000Z";
const SAME = "2026-07-19T10:00:00.000Z";
const NEW = "2026-07-19T12:00:00.000Z";
const BACKUP_AT = "2026-07-19T13:00:00.000Z";

function spark(id: string, updatedAt = SAME, text = id, deletedAt?: string): Spark {
  return {
    id,
    text,
    createdAt: OLD,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
    temperature: "spark",
    tags: [id],
    schemaVersion: 1
  };
}

function writerPackage(
  id: string,
  updatedAt = SAME,
  title = id,
  deletedAt?: string
): WriterPackage {
  return {
    id,
    title,
    sparkText: id,
    notes: [{ id: `${id}-note`, text: id, createdAt: OLD, updatedAt }],
    workshopText: "",
    finalText: "",
    createdAt: OLD,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
    packageVersion: 1,
    legacy: { source: "spark", stage: "notes" }
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

const cleanRecovery: WriterDbRecoveryInspection = { status: "clean", markerPresent: false };

function recoverableRecovery(): WriterDbRecoveryInspection {
  return {
    status: "recoverable",
    markerPresent: true,
    marker: {
      markerVersion: 1,
      transactionId: "execution-check",
      status: "prepared",
      createdAt: NEW,
      sourceSchemaVersion: 2,
      targetSparkCount: 0,
      targetPackageCount: 0
    },
    backup: {
      backupVersion: 1,
      createdAt: NEW,
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
  error: "blocked fixture",
  warnings: []
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function preview(
  db: WriterDb,
  localSparks: readonly Spark[] = [],
  localPackages: readonly WriterPackage[] = []
): WriterDbImportPreview {
  return previewWriterDbImport({ incoming: db, localSparks, localPackages });
}

function execute(options: Partial<PrepareWriterDbImportExecutionInput> = {}) {
  const db = options.db ?? dbV2([spark("incoming")], [writerPackage("incoming-package")]);
  const currentLocalSparks = options.currentLocalSparks ?? [];
  const currentLocalPackages = options.currentLocalPackages ?? [];
  return prepareWriterDbImportExecution({
    db,
    previousPreview: options.previousPreview ?? preview(db, currentLocalSparks, currentLocalPackages),
    currentLocalSparks,
    currentLocalPackages,
    recoveryInspection: options.recoveryInspection ?? cleanRecovery,
    backupCreatedAt: options.backupCreatedAt ?? BACKUP_AT
  });
}

const tests: TestCase[] = [
  { name: "clean equivalent v1 preview is ready", run: () => assert(execute({ db: dbV1([spark("v1")]) }).status === "ready", "v1 not ready") },
  { name: "v1 merges Sparks", run: () => { const result = execute({ db: dbV1([spark("shared", NEW, "incoming")]), currentLocalSparks: [spark("shared", OLD, "local")] }); assert(result.status === "ready" && result.mergedSparks[0].text === "incoming", "v1 Spark not merged"); } },
  { name: "v1 leaves Packages content unchanged", run: () => { const local = writerPackage("local-package"); const result = execute({ db: dbV1([spark("v1")]), currentLocalPackages: [local] }); assert(result.status === "ready" && JSON.stringify(result.mergedPackages) === JSON.stringify([local]), "v1 Packages changed"); } },
  { name: "v1 backup includes original Sparks and Packages", run: () => { const localSpark = spark("local"); const localPackage = writerPackage("local-package"); const result = execute({ db: dbV1([spark("incoming")]), currentLocalSparks: [localSpark], currentLocalPackages: [localPackage] }); assert(result.status === "ready" && result.backup.sparks[0].id === "local" && result.backup.packages[0].id === "local-package", "v1 backup incomplete"); } },
  { name: "clean equivalent v2 preview is ready", run: () => assert(execute().status === "ready", "v2 not ready") },
  { name: "v2 merges both collections", run: () => { const result = execute({ db: dbV2([spark("new-spark")], [writerPackage("new-package")]), currentLocalSparks: [spark("local-spark")], currentLocalPackages: [writerPackage("local-package")] }); assert(result.status === "ready" && result.mergedSparks.length === 2 && result.mergedPackages.length === 2, "both collections not merged"); } },
  { name: "newer incoming record wins", run: () => { const result = execute({ db: dbV2([spark("shared", NEW, "incoming")], []), currentLocalSparks: [spark("shared", OLD, "local")] }); assert(result.status === "ready" && result.mergedSparks[0].text === "incoming", "newer incoming lost"); } },
  { name: "older incoming record is ignored", run: () => { const result = execute({ db: dbV2([spark("shared", OLD, "incoming")], []), currentLocalSparks: [spark("shared", NEW, "local")] }); assert(result.status === "ready" && result.mergedSparks[0].text === "local", "older incoming won"); } },
  { name: "equal updatedAt keeps local record", run: () => { const result = execute({ db: dbV2([], [writerPackage("shared", SAME, "incoming")]), currentLocalPackages: [writerPackage("shared", SAME, "local")] }); assert(result.status === "ready" && result.mergedPackages[0].title === "local", "equal incoming replaced local"); } },
  { name: "newer tombstone is applied", run: () => { const result = execute({ db: dbV2([spark("shared", NEW, "deleted", NEW)], []), currentLocalSparks: [spark("shared", OLD, "local")] }); assert(result.status === "ready" && result.mergedSparks[0].deletedAt === NEW, "new tombstone ignored"); } },
  { name: "older tombstone is ignored", run: () => { const result = execute({ db: dbV2([], [writerPackage("shared", OLD, "deleted", OLD)]), currentLocalPackages: [writerPackage("shared", NEW, "local")] }); assert(result.status === "ready" && result.mergedPackages[0].deletedAt === undefined, "old tombstone applied"); } },
  { name: "missing incoming record never deletes local", run: () => { const result = execute({ db: dbV2([], []), currentLocalSparks: [spark("local")], currentLocalPackages: [writerPackage("local-package")] }); assert(result.status === "ready" && result.mergedSparks.length === 1 && result.mergedPackages.length === 1, "missing incoming deleted local"); } },
  { name: "stale returns before merge and backup", run: () => { const db = dbV2([spark("incoming", NEW)], []); const result = execute({ db, previousPreview: preview(db), currentLocalSparks: [spark("incoming", OLD)] , backupCreatedAt: "invalid" }); assert(result.status === "stale", "stale gate continued"); } },
  { name: "recovery-required returns before merge and backup", run: () => { const invalid = { ...spark("bad"), schemaVersion: 9 as 1 }; const result = execute({ currentLocalSparks: [invalid], recoveryInspection: recoverableRecovery(), backupCreatedAt: "invalid" }); assert(result.status === "blocked" && result.reason === "recovery-required", "recovery-required gate continued"); } },
  { name: "recovery-blocked returns before merge and backup", run: () => { const invalid = { ...spark("bad"), schemaVersion: 9 as 1 }; const result = execute({ currentLocalSparks: [invalid], recoveryInspection: blockedRecovery, backupCreatedAt: "invalid" }); assert(result.status === "blocked" && result.reason === "recovery-blocked", "recovery-blocked gate continued"); } },
  { name: "preview-blocked returns before merge and backup", run: () => { const duplicate = spark("duplicate"); const db = dbV2([duplicate, clone(duplicate)], []); const result = execute({ db, previousPreview: preview(db), backupCreatedAt: "invalid" }); assert(result.status === "blocked" && result.reason === "preview-blocked", "preview-blocked gate continued"); } },
  { name: "backup captures state before merge", run: () => { const local = spark("shared", OLD, "before"); const result = execute({ db: dbV2([spark("shared", NEW, "after")], []), currentLocalSparks: [local] }); assert(result.status === "ready" && result.backup.sparks[0].text === "before" && result.mergedSparks[0].text === "after", "backup contains merged state"); } },
  { name: "backupCreatedAt is deterministic", run: () => { const result = execute(); assert(result.status === "ready" && result.backup.createdAt === BACKUP_AT, "injected backup time changed"); } },
  { name: "sourceSchemaVersion matches imported DB", run: () => { const v1 = execute({ db: dbV1([]) }); const v2 = execute({ db: dbV2([], []) }); assert(v1.status === "ready" && v1.sourceSchemaVersion === 1 && v1.backup.sourceSchemaVersion === 1 && v2.status === "ready" && v2.sourceSchemaVersion === 2 && v2.backup.sourceSchemaVersion === 2, "source schema mismatch"); } },
  { name: "execution does not mutate inputs", run: () => { const input: PrepareWriterDbImportExecutionInput = { db: dbV2([spark("incoming")], [writerPackage("incoming-package")]), previousPreview: preview(dbV2([spark("incoming")], [writerPackage("incoming-package")]), [spark("local")], [writerPackage("local-package")]), currentLocalSparks: [spark("local")], currentLocalPackages: [writerPackage("local-package")], recoveryInspection: cleanRecovery, backupCreatedAt: BACKUP_AT }; const before = clone(input); prepareWriterDbImportExecution(input); assert(JSON.stringify(input) === JSON.stringify(before), "input mutated"); } },
  { name: "ready result is a deep copy", run: () => { const localSpark = spark("local"); const localPackage = writerPackage("local-package"); const result = execute({ currentLocalSparks: [localSpark], currentLocalPackages: [localPackage] }); assert(result.status === "ready", "result not ready"); result.mergedSparks[0].tags.push("changed"); result.backup.packages[0].notes[0].text = "changed"; assert(localSpark.tags.length === 1 && localPackage.notes[0].text === "local-package", "ready result shares nested input state"); } },
  { name: "execution never touches window or localStorage", run: () => { const throwingStorage = { getItem() { throw new Error("storage touched"); }, setItem() { throw new Error("storage touched"); }, removeItem() { throw new Error("storage touched"); } }; (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = { localStorage: throwingStorage }; assert(execute().status === "ready", "global storage affected execution"); } },
  { name: "execution does not expose or call persistence", run: () => { const result = execute(); assert(result.status === "ready" && !Reflect.has(result, "transactionId") && !Reflect.has(result, "successSummary"), "persistence output leaked"); } },
  { name: "same inputs produce equivalent output", run: () => { const db = dbV2([spark("incoming")], [writerPackage("incoming-package")]); const options = { db, currentLocalSparks: [spark("local")], currentLocalPackages: [writerPackage("local-package")] }; assert(JSON.stringify(execute(options)) === JSON.stringify(execute(options)), "execution is nondeterministic"); } },
  { name: "real merge validation failure is blocked", run: () => { const invalid = { ...spark("invalid"), schemaVersion: 9 as 1 }; const db = dbV2([], []); const result = execute({ db, previousPreview: preview(db, [invalid], []), currentLocalSparks: [invalid] }); assert(result.status === "blocked" && result.reason === "merge-failed", "merge failure not exposed"); } },
  { name: "real backup validation failure is blocked", run: () => { const result = execute({ backupCreatedAt: "not-a-date" }); assert(result.status === "blocked" && result.reason === "backup-failed", "backup failure not exposed"); } }
];

export function runWriterDbImportExecutionChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok execution ${passed} - ${test.name}`);
  }
  console.log(`Writer DB import execution checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportExecutionChecks();
