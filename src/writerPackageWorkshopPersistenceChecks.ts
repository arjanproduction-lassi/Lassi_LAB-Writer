import type { WriterPackage, WriterPackageNote } from "./types";
import { serializeWriterPackageCollection } from "./writerPackageCollectionCodec";
import {
  persistWriterPackageWorkshopEdit,
  type PersistWriterPackageWorkshopEditInput,
  type WriterPackageWorkshopPersistenceFailure,
  type WriterPackageWorkshopPersistenceResult,
  type WriterPackageWorkshopStorage
} from "./writerPackageWorkshopPersistence";

const KEY = "artificial-package-key";
const CREATED_AT = "2026-01-01T08:00:00.000Z";
const UPDATED_AT = "2026-01-02T08:00:00.000Z";
const NEXT_AT = "2026-01-03T09:10:11.123Z";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function note(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return {
    id: "artificial-note",
    text: "Artificial note text.",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "artificial-package",
    title: "Artificial title",
    sparkText: "Artificial spark text.",
    notes: [note()],
    workshopText: "Artificial workshop text.",
    finalText: "Artificial final text.",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    packageVersion: 1,
    ...overrides
  };
}

function raw(packages: readonly Readonly<WriterPackage>[]): string {
  const serialized = serializeWriterPackageCollection(packages);
  if (!serialized.ok) {
    throw new Error(`Artificial fixture serialization failed: ${serialized.reason}.`);
  }
  return serialized.raw;
}

type GetHandler = (
  storage: ArtificialStorage,
  key: string,
  call: number
) => string | null;
type SetHandler = (
  storage: ArtificialStorage,
  key: string,
  value: string,
  call: number
) => void;

class ArtificialStorage implements WriterPackageWorkshopStorage {
  currentRaw: string | null;
  readonly operations: string[] = [];
  readonly keys = new Set<string>();
  private getCalls = 0;
  private setCalls = 0;

  constructor(
    initialRaw: string | null,
    private readonly onGet?: GetHandler,
    private readonly onSet?: SetHandler
  ) {
    this.currentRaw = initialRaw;
  }

  getItem(key: string): string | null {
    this.getCalls += 1;
    this.operations.push("get");
    this.keys.add(key);
    if (this.onGet) {
      return this.onGet(this, key, this.getCalls);
    }
    return this.currentRaw;
  }

  setItem(key: string, value: string): void {
    this.setCalls += 1;
    this.operations.push("set");
    this.keys.add(key);
    if (this.onSet) {
      this.onSet(this, key, value, this.setCalls);
      return;
    }
    this.currentRaw = value;
  }
}

function persist(
  storage: WriterPackageWorkshopStorage,
  overrides: Partial<PersistWriterPackageWorkshopEditInput> = {}
): WriterPackageWorkshopPersistenceResult {
  return persistWriterPackageWorkshopEdit({
    storage,
    key: KEY,
    packageId: "artificial-package",
    expectedUpdatedAt: UPDATED_AT,
    workshopText: "Changed artificial workshop text.",
    now: NEXT_AT,
    ...overrides
  });
}

function isFailed(
  result: WriterPackageWorkshopPersistenceResult,
  stage: WriterPackageWorkshopPersistenceFailure["stage"]
): result is WriterPackageWorkshopPersistenceFailure {
  return result.status === "failed" && result.stage === stage;
}

const baseRaw = raw([writerPackage()]);

const invalidKeyStorage = new ArtificialStorage(baseRaw);
const invalidKey = persist(invalidKeyStorage, { key: "   " });
check(
  invalidKey.status === "blocked" &&
    invalidKey.reason === "invalid-storage-key" &&
    invalidKeyStorage.operations.length === 0,
  "A an invalid key must block before any storage access."
);

const readThrowStorage = new ArtificialStorage(baseRaw, () => {
  throw new Error("Artificial private read failure.");
});
const readThrow = persist(readThrowStorage);
check(
  isFailed(readThrow, "current-read") &&
    !readThrow.writeAttempted &&
    !readThrow.rollbackAttempted &&
    readThrow.storageState === "not-written" &&
    readThrowStorage.operations.join(",") === "get",
  "B an initial read throw must return a text-free pre-write failure."
);

const missingStorage = new ArtificialStorage(null);
const missing = persist(missingStorage);
check(
  missing.status === "blocked" &&
    missing.reason === "package-storage-missing" &&
    missingStorage.operations.join(",") === "get",
  "C a missing Package collection must block without creating it."
);

for (const [damagedRaw, reason] of [
  ["{", "malformed-json"],
  ["{}", "package-storage-not-array"],
  [JSON.stringify([{ ...writerPackage(), extra: true }]), "unsupported-package-shape"],
  [JSON.stringify([writerPackage({ packageVersion: 2 as 1 })]), "unsupported-package-version"],
  [JSON.stringify([writerPackage({ updatedAt: "invalid-date" })]), "invalid-package"],
  [
    JSON.stringify([
      writerPackage({ id: "duplicate-artificial-package" }),
      writerPackage({ id: "duplicate-artificial-package" })
    ]),
    "duplicate-package-id"
  ]
] as const) {
  const storage = new ArtificialStorage(damagedRaw);
  const result = persist(storage);
  check(
    result.status === "blocked" &&
      result.reason === reason &&
      storage.operations.join(",") === "get",
    `D damaged collection reason ${reason} must block with zero writes.`
  );
}

const conflictStorage = new ArtificialStorage(
  raw([writerPackage({ updatedAt: "2026-01-02T08:00:00.001Z" })])
);
const conflict = persist(conflictStorage);
check(
  conflict.status === "conflict" &&
    conflict.expectedUpdatedAt === UPDATED_AT &&
    conflict.currentUpdatedAt === "2026-01-02T08:00:00.001Z" &&
    conflictStorage.operations.join(",") === "get",
  "J a stale revision must return conflict with zero writes."
);

const notFoundStorage = new ArtificialStorage(baseRaw);
const notFound = persist(notFoundStorage, { packageId: "missing-artificial-package" });
check(
  notFound.status === "blocked" &&
    notFound.reason === "package-not-found" &&
    notFoundStorage.operations.join(",") === "get",
  "K a missing selected Package must block with zero writes."
);

const deletedStorage = new ArtificialStorage(
  raw([writerPackage({ deletedAt: NEXT_AT })])
);
const deleted = persist(deletedStorage);
check(
  deleted.status === "blocked" &&
    deleted.reason === "package-deleted" &&
    deletedStorage.operations.join(",") === "get",
  "L a tombstoned Package must block with zero writes."
);

const invalidNowStorage = new ArtificialStorage(baseRaw);
const invalidNow = persist(invalidNowStorage, { now: "invalid-date" });
check(
  invalidNow.status === "blocked" &&
    invalidNow.reason === "invalid-now" &&
    invalidNowStorage.operations.join(",") === "get",
  "M invalid injected time must block with zero writes."
);

const unchangedStorage = new ArtificialStorage(baseRaw);
const unchanged = persist(unchangedStorage, {
  workshopText: "Artificial workshop text.",
  now: "not-needed"
});
check(
  unchanged.status === "unchanged" &&
    unchanged.package.updatedAt === UPDATED_AT &&
    unchangedStorage.operations.join(",") === "get" &&
    Object.isFrozen(unchanged) &&
    Object.isFrozen(unchanged.package),
  "N unchanged text must return a detached frozen Package with zero writes."
);

const preservedPackage = writerPackage({
  id: "preserved-artificial-package",
  notes: [note({ id: "preserved-artificial-note", deletedAt: NEXT_AT })],
  deletedAt: NEXT_AT,
  legacy: { source: "spark", stage: "notes" }
});
const successStorage = new ArtificialStorage(raw([preservedPackage, writerPackage()]));
const success = persist(successStorage);
check(
  success.status === "saved" &&
    success.previousUpdatedAt === UPDATED_AT &&
    success.nextUpdatedAt === NEXT_AT &&
    success.package.workshopText === "Changed artificial workshop text." &&
    success.package.updatedAt === NEXT_AT &&
    successStorage.operations.join(",") === "get,set,get" &&
    successStorage.keys.size === 1 &&
    successStorage.keys.has(KEY),
  "O success must use current read, one write, read-back, and only the injected key."
);
check(
  success.status === "saved" &&
    Object.isFrozen(success) &&
    Object.isFrozen(success.package) &&
    successStorage.currentRaw !== null &&
    successStorage.currentRaw.includes("Changed artificial workshop text."),
  "P saved is returned only with a detached frozen verified Package."
);
check(
  successStorage.currentRaw !== null &&
    raw([(JSON.parse(successStorage.currentRaw) as WriterPackage[])[0]]) ===
      raw([preservedPackage]),
  "Q unrelated Packages, notes, tombstones, and legacy metadata must remain exact."
);

const changedWhitespaceStorage = new ArtificialStorage(
  baseRaw,
  (storage, _key, call) => {
    if (call === 2 && storage.currentRaw !== null) {
      return ` ${storage.currentRaw}`;
    }
    return storage.currentRaw;
  }
);
const changedWhitespace = persist(changedWhitespaceStorage);
check(
  isFailed(changedWhitespace, "verify") &&
    changedWhitespace.writeAttempted &&
    changedWhitespace.rollbackAttempted &&
    changedWhitespace.rollbackSucceeded &&
    changedWhitespace.storageState === "previous-verified" &&
    changedWhitespaceStorage.currentRaw === baseRaw,
  "R byte-different read-back must fail and restore exact previous raw only after ownership inspection."
);

const throwBeforeWriteStorage = new ArtificialStorage(
  baseRaw,
  undefined,
  () => {
    throw new Error("Artificial private write failure.");
  }
);
const throwBeforeWrite = persist(throwBeforeWriteStorage);
check(
  isFailed(throwBeforeWrite, "write") &&
    throwBeforeWrite.writeAttempted &&
    !throwBeforeWrite.rollbackAttempted &&
    throwBeforeWrite.storageState === "previous-verified" &&
    throwBeforeWriteStorage.operations.join(",") === "get,set,get",
  "S a thrown write with unchanged storage must verify previous raw without rollback."
);

const throwAfterWriteStorage = new ArtificialStorage(
  baseRaw,
  undefined,
  (storage, _key, value, call) => {
    storage.currentRaw = value;
    if (call === 1) {
      throw new Error("Artificial post-write throw.");
    }
  }
);
const throwAfterWrite = persist(throwAfterWriteStorage);
check(
  isFailed(throwAfterWrite, "write") &&
    throwAfterWrite.rollbackAttempted &&
    throwAfterWrite.rollbackSucceeded &&
    throwAfterWrite.storageState === "previous-verified" &&
    throwAfterWriteStorage.currentRaw === baseRaw &&
    throwAfterWriteStorage.operations.join(",") === "get,set,get,set,get",
  "T planned raw observed after a thrown write must be restored and verified exactly."
);

const readBackThrowStorage = new ArtificialStorage(
  baseRaw,
  (storage, _key, call) => {
    if (call === 2) {
      throw new Error("Artificial read-back failure.");
    }
    return storage.currentRaw;
  }
);
const readBackThrow = persist(readBackThrowStorage);
check(
  isFailed(readBackThrow, "read-back") &&
    readBackThrow.rollbackAttempted &&
    readBackThrow.rollbackSucceeded &&
    readBackThrow.storageState === "previous-verified" &&
    readBackThrowStorage.currentRaw === baseRaw &&
    readBackThrowStorage.operations.join(",") === "get,set,get,get,set,get",
  "T2 a read-back throw must inspect ownership before an exact verified rollback."
);

const thirdRaw = raw([writerPackage({ id: "third-writer-artificial-package" })]);
const thirdWriterStorage = new ArtificialStorage(
  baseRaw,
  undefined,
  (storage) => {
    storage.currentRaw = thirdRaw;
    throw new Error("Artificial concurrent write.");
  }
);
const thirdWriter = persist(thirdWriterStorage);
check(
  isFailed(thirdWriter, "write") &&
    !thirdWriter.rollbackAttempted &&
    thirdWriter.storageState === "unknown" &&
    thirdWriterStorage.currentRaw === thirdRaw &&
    thirdWriterStorage.operations.join(",") === "get,set,get",
  "U an unexpected third raw value must never be overwritten."
);

const inspectThrowStorage = new ArtificialStorage(
  baseRaw,
  (storage, _key, call) => {
    if (call > 1) {
      throw new Error("Artificial inspect failure.");
    }
    return storage.currentRaw;
  },
  () => {
    throw new Error("Artificial write failure.");
  }
);
const inspectThrow = persist(inspectThrowStorage);
check(
  isFailed(inspectThrow, "write") &&
    !inspectThrow.rollbackAttempted &&
    inspectThrow.rollbackStage === "inspect" &&
    inspectThrow.storageState === "unknown" &&
    inspectThrowStorage.operations.join(",") === "get,set,get",
  "V failed inspection must never trigger a blind rollback."
);

const rollbackThrowAppliedStorage = new ArtificialStorage(
  baseRaw,
  (storage, _key, call) => {
    if (call === 2 && storage.currentRaw !== null) {
      return ` ${storage.currentRaw}`;
    }
    return storage.currentRaw;
  },
  (storage, _key, value, call) => {
    storage.currentRaw = value;
    if (call === 2) {
      throw new Error("Artificial rollback write throw after apply.");
    }
  }
);
const rollbackThrowApplied = persist(rollbackThrowAppliedStorage);
check(
  isFailed(rollbackThrowApplied, "verify") &&
    rollbackThrowApplied.rollbackAttempted &&
    rollbackThrowApplied.rollbackSucceeded &&
    rollbackThrowApplied.storageState === "previous-verified" &&
    rollbackThrowAppliedStorage.currentRaw === baseRaw,
  "W a thrown rollback write must still succeed when final exact verification sees previous raw."
);

const rollbackThrowUnappliedStorage = new ArtificialStorage(
  baseRaw,
  (storage, _key, call) => {
    if (call === 2 && storage.currentRaw !== null) {
      return ` ${storage.currentRaw}`;
    }
    return storage.currentRaw;
  },
  (storage, _key, value, call) => {
    if (call === 2) {
      throw new Error("Artificial rollback write throw before apply.");
    }
    storage.currentRaw = value;
  }
);
const rollbackThrowUnapplied = persist(rollbackThrowUnappliedStorage);
check(
  isFailed(rollbackThrowUnapplied, "verify") &&
    rollbackThrowUnapplied.rollbackAttempted &&
    !rollbackThrowUnapplied.rollbackSucceeded &&
    rollbackThrowUnapplied.rollbackStage === "write" &&
    rollbackThrowUnapplied.storageState === "unknown" &&
    rollbackThrowUnappliedStorage.operations.join(",") ===
      "get,set,get,get,set,get",
  "X an unverified thrown rollback must report unknown storage state."
);

const rollbackVerifyMismatchStorage = new ArtificialStorage(
  baseRaw,
  (storage, _key, call) => {
    if (call === 2 && storage.currentRaw !== null) {
      return ` ${storage.currentRaw}`;
    }
    if (call === 4) {
      return thirdRaw;
    }
    return storage.currentRaw;
  },
  (storage, _key, value) => {
    storage.currentRaw = value;
  }
);
const rollbackVerifyMismatch = persist(rollbackVerifyMismatchStorage);
check(
  isFailed(rollbackVerifyMismatch, "verify") &&
    rollbackVerifyMismatch.rollbackAttempted &&
    !rollbackVerifyMismatch.rollbackSucceeded &&
    rollbackVerifyMismatch.rollbackStage === "verify" &&
    rollbackVerifyMismatch.storageState === "unknown",
  "Y a rollback verification mismatch must never report saved or recovered."
);

const formattedPreviousRaw = `[\n  ${JSON.stringify(writerPackage())}\n]`;
const exactRestoreStorage = new ArtificialStorage(
  formattedPreviousRaw,
  undefined,
  (storage, _key, value, call) => {
    storage.currentRaw = value;
    if (call === 1) {
      throw new Error("Artificial write throw after apply.");
    }
  }
);
const exactRestore = persist(exactRestoreStorage);
check(
  isFailed(exactRestore, "write") &&
    exactRestore.rollbackSucceeded &&
    exactRestoreStorage.currentRaw === formattedPreviousRaw,
  "Z rollback must restore exact previous whitespace and property order bytes."
);

for (const result of [readThrow, throwBeforeWrite, thirdWriter, inspectThrow]) {
  const publicMetadata = JSON.stringify(result);
  check(
    !publicMetadata.includes("Artificial title") &&
      !publicMetadata.includes("Artificial workshop text") &&
      !publicMetadata.includes("artificial-package") &&
      !publicMetadata.includes(baseRaw),
    "AA failed metadata must not expose raw JSON, IDs, titles, or author text."
  );
}

console.log(
  `WriterPackage workshop persistence checks: ${passed}/${passed} passed.`
);
