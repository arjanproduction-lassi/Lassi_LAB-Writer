import type { WriterPackage } from "./types";
import {
  parseWriterPackageCollectionJsonStrict,
  serializeWriterPackageCollection
} from "./writerPackageCollectionCodec";
import { createWriterPackageWorkshopEditingSession } from "./writerPackageWorkshopEditingSession";
import {
  applyWriterPackageWorkshopAutosaveEvent,
  createWriterPackageWorkshopAutosaveState
} from "./writerPackageWorkshopAutosaveState";
import {
  WRITER_PACKAGE_WORKSHOP_EDIT_MODE,
  WRITER_PACKAGE_WORKSHOP_WRITE_LOCK_NAME,
  acquireWriterPackageWorkshopBrowserWriteOwnership,
  createWriterPackageWorkshopBeforeUnloadGuard,
  createWriterPackageWorkshopBrowserNow,
  createWriterPackageWorkshopBrowserSessionDependencies,
  createWriterPackageWorkshopBrowserStorage,
  createWriterPackageWorkshopDebounceScheduler,
  inspectWriterPackageWorkshopBrowserEditablePackage,
  resolveWriterPackageWorkshopEditMode,
  writerPackageWorkshopAutosaveShouldWarnBeforeUnload,
  type WriterPackageWorkshopBeforeUnloadEvent,
  type WriterPackageWorkshopBeforeUnloadHandler,
  type WriterPackageWorkshopBrowserLock,
  type WriterPackageWorkshopBrowserLockManager,
  type WriterPackageWorkshopTimerTarget,
  type WriterPackageWorkshopWriteOwnership
} from "./writerPackageWorkshopBrowserAdapters";
import { WRITER_PACKAGE_STORAGE_KEY } from "./writerPackageStorage";

const BASE = "2026-01-02T08:00:00.000Z";
const NEXT = "2026-01-03T09:10:11.123Z";
const PACKAGE_ID = "synthetic-browser-package";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function syntheticPackage(
  overrides: Partial<WriterPackage> = {}
): WriterPackage {
  return {
    id: PACKAGE_ID,
    title: "Synthetic browser title",
    sparkText: "Synthetic browser spark",
    notes: [],
    workshopText: "Synthetic browser workshop",
    finalText: "Synthetic browser final",
    createdAt: BASE,
    updatedAt: BASE,
    packageVersion: 1,
    ...overrides
  };
}

function raw(packages: readonly Readonly<WriterPackage>[]): string {
  const serialized = serializeWriterPackageCollection(packages);
  if (!serialized.ok) {
    throw new Error(`Synthetic package serialization failed: ${serialized.reason}.`);
  }
  return serialized.raw;
}

class ArtificialStorage {
  currentRaw: string | null;
  readonly operations: string[] = [];
  readonly keys: string[] = [];
  readonly values: string[] = [];

  constructor(
    initialRaw: string | null,
    private readonly onGet?: (key: string, call: number) => string | null
  ) {
    this.currentRaw = initialRaw;
  }

  getItem(key: string): string | null {
    this.operations.push("get");
    this.keys.push(key);
    if (this.onGet) {
      return this.onGet(key, this.operations.filter((op) => op === "get").length);
    }
    return this.currentRaw;
  }

  setItem(key: string, value: string): void {
    this.operations.push("set");
    this.keys.push(key);
    this.values.push(value);
    this.currentRaw = value;
  }

  removeItem(key: string): void {
    this.operations.push(`forbidden:${key}`);
  }
}

function activeOwnership(): Readonly<{
  ownership: WriterPackageWorkshopWriteOwnership;
  deactivate: () => void;
  releases: () => number;
}> {
  let active = true;
  let releaseCount = 0;
  return Object.freeze({
    ownership: Object.freeze({
      hasWriteOwnership: () => active,
      releaseWriteOwnership() {
        if (!active) {
          return;
        }
        active = false;
        releaseCount += 1;
      }
    }),
    deactivate() {
      active = false;
    },
    releases() {
      return releaseCount;
    }
  });
}

function readSinglePackage(storage: ArtificialStorage): Readonly<WriterPackage> {
  if (storage.currentRaw === null) {
    throw new Error("Expected synthetic storage to contain Package bytes.");
  }
  const parsed = parseWriterPackageCollectionJsonStrict(storage.currentRaw);
  if (!parsed.ok) {
    throw new Error(`Expected synthetic read-back to parse: ${parsed.reason}.`);
  }
  const writerPackage = parsed.packages.find((candidate) => candidate.id === PACKAGE_ID);
  if (!writerPackage) {
    throw new Error("Expected synthetic read-back Package.");
  }
  return writerPackage;
}

class ArtificialTimers implements WriterPackageWorkshopTimerTarget {
  readonly delays: number[] = [];
  readonly cleared: unknown[] = [];
  private nextHandle = 1;
  private readonly callbacks = new Map<unknown, () => void>();

  setTimeout(callback: () => void, delayMs: number): unknown {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.delays.push(delayMs);
    this.callbacks.set(handle, callback);
    return handle;
  }

  clearTimeout(handle: unknown): void {
    this.cleared.push(handle);
    this.callbacks.delete(handle);
  }

  fire(handle: unknown): boolean {
    const callback = this.callbacks.get(handle);
    if (!callback) {
      return false;
    }
    this.callbacks.delete(handle);
    callback();
    return true;
  }

  lastHandle(): unknown {
    return this.nextHandle - 1;
  }
}

class ArtificialBeforeUnloadTarget {
  readonly operations: string[] = [];
  readonly handlers: WriterPackageWorkshopBeforeUnloadHandler[] = [];

  addEventListener(
    type: "beforeunload",
    handler: WriterPackageWorkshopBeforeUnloadHandler
  ): void {
    this.operations.push(`add:${type}`);
    this.handlers.push(handler);
  }

  removeEventListener(
    type: "beforeunload",
    handler: WriterPackageWorkshopBeforeUnloadHandler
  ): void {
    this.operations.push(`remove:${type}`);
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  fire(event: WriterPackageWorkshopBeforeUnloadEvent): Array<string | undefined> {
    return this.handlers.map((handler) => handler(event));
  }
}

function lockManager(
  behavior: "grant" | "deny" | "throw"
): Readonly<{
  manager: WriterPackageWorkshopBrowserLockManager;
  calls: Array<
    Readonly<{
      name: string;
      mode: string;
      ifAvailable: boolean;
    }>
  >;
}> {
  const calls: Array<
    Readonly<{
      name: string;
      mode: string;
      ifAvailable: boolean;
    }>
  > = [];
  return Object.freeze({
    calls,
    manager: Object.freeze({
      request(
        name: typeof WRITER_PACKAGE_WORKSHOP_WRITE_LOCK_NAME,
        options: Readonly<{ mode: "exclusive"; ifAvailable: true }>,
        callback: (
          lock: WriterPackageWorkshopBrowserLock | null
        ) => Promise<void> | void
      ) {
        calls.push(
          Object.freeze({
            name,
            mode: options.mode,
            ifAvailable: options.ifAvailable
          })
        );
        if (behavior === "throw") {
          throw new Error("Synthetic lock request failure.");
        }
        return callback(behavior === "grant" ? Object.freeze({}) : null);
      }
    })
  });
}

async function runChecks() {
  const baseRaw = raw([syntheticPackage()]);

  check(
    resolveWriterPackageWorkshopEditMode({
      isDevelopment: true,
      search: "?mode=real-edit-workshop"
    }) === WRITER_PACKAGE_WORKSHOP_EDIT_MODE,
    "A exact development edit query must enable only the D4c edit mode."
  );

  check(
    [
      "",
      "?mode=fixture",
      "?mode=real-read-only",
      "?mode=REAL-EDIT-WORKSHOP",
      "?mode=",
      "?preview=1",
      "?%ZZ=1"
    ].every(
      (search) =>
        resolveWriterPackageWorkshopEditMode({
          isDevelopment: true,
          search
        }) === "fixture"
    ) &&
      resolveWriterPackageWorkshopEditMode({
        isDevelopment: false,
        search: "?mode=real-edit-workshop"
      }) === "fixture",
    "B absent, production, malformed, read-only, and non-exact queries must fail closed."
  );

  check(
    resolveWriterPackageWorkshopEditMode({
      isDevelopment: true,
      search: "?panel=library&mode=real-edit-workshop"
    }) === WRITER_PACKAGE_WORKSHOP_EDIT_MODE,
    "C unrelated query parameters must not block the exact edit mode."
  );

  const sourceStorage = new ArtificialStorage(baseRaw);
  const adaptedStorage = createWriterPackageWorkshopBrowserStorage(sourceStorage);
  check(
    sourceStorage.operations.length === 0 && Object.isFrozen(adaptedStorage),
    "D creating the narrow storage adapter must have no storage effect."
  );
  adaptedStorage.getItem(WRITER_PACKAGE_STORAGE_KEY);
  adaptedStorage.setItem(WRITER_PACKAGE_STORAGE_KEY, baseRaw);
  check(
    sourceStorage.operations.join(",") === "get,set" &&
      sourceStorage.keys.every((key) => key === WRITER_PACKAGE_STORAGE_KEY) &&
      !sourceStorage.operations.some((operation) => operation.startsWith("forbidden:")),
    "E the narrow storage adapter must forward only get and set for the supplied key."
  );

  const validInspectionStorage = createWriterPackageWorkshopBrowserStorage(
    new ArtificialStorage(baseRaw)
  );
  const validInspection = inspectWriterPackageWorkshopBrowserEditablePackage({
    storage: validInspectionStorage,
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    validInspection.status === "editable" &&
      validInspection.package.id === PACKAGE_ID &&
      validInspection.package.updatedAt === BASE &&
      Object.isFrozen(validInspection.package),
    "F a fresh stored Package must inspect as editable and detached."
  );

  const invalidKeyStorage = new ArtificialStorage(baseRaw);
  const invalidKeyInspection = inspectWriterPackageWorkshopBrowserEditablePackage({
    storage: createWriterPackageWorkshopBrowserStorage(invalidKeyStorage),
    key: " ",
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    invalidKeyInspection.status === "blocked" &&
      invalidKeyInspection.reason === "invalid-storage-key" &&
      invalidKeyStorage.operations.length === 0,
    "G invalid keys must block before any read."
  );

  const thrownReadStorage = new ArtificialStorage(baseRaw, () => {
    throw new Error("Synthetic private read failure.");
  });
  const thrownRead = inspectWriterPackageWorkshopBrowserEditablePackage({
    storage: createWriterPackageWorkshopBrowserStorage(thrownReadStorage),
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    thrownRead.status === "blocked" &&
      thrownRead.reason === "package-storage-read-failed" &&
      thrownReadStorage.operations.join(",") === "get",
    "H read failures must block without any write."
  );

  const damagedCases = [
    [null, "package-storage-missing"],
    ["{", "malformed-json"],
    [JSON.stringify({}), "package-storage-not-array"],
    [JSON.stringify([{ ...syntheticPackage(), extra: true }]), "unsupported-package-shape"],
    [JSON.stringify([syntheticPackage({ packageVersion: 2 as 1 })]), "unsupported-package-version"],
    [
      JSON.stringify([
        syntheticPackage({ id: "duplicate-synthetic-package" }),
        syntheticPackage({ id: "duplicate-synthetic-package" })
      ]),
      "duplicate-package-id"
    ],
    [raw([syntheticPackage({ id: "different-synthetic-package" })]), "package-not-found"],
    [raw([syntheticPackage({ deletedAt: NEXT })]), "package-deleted"],
    [raw([syntheticPackage({ updatedAt: NEXT })]), "stale-revision"]
  ] as const;
  check(
    damagedCases.every(([initialRaw, reason]) => {
      const storage = new ArtificialStorage(initialRaw);
      const result = inspectWriterPackageWorkshopBrowserEditablePackage({
        storage: createWriterPackageWorkshopBrowserStorage(storage),
        packageId: PACKAGE_ID,
        expectedUpdatedAt: BASE
      });
      return (
        result.status === "blocked" &&
        result.reason === reason &&
        storage.operations.join(",") === "get"
      );
    }),
    "I missing, damaged, duplicate, absent, deleted, and stale storage must stay blocked read-only."
  );

  let nowCalls = 0;
  const now = createWriterPackageWorkshopBrowserNow({
    readDate() {
      nowCalls += 1;
      return new Date(NEXT);
    }
  });
  check(
    now() === NEXT && nowCalls === 1,
    "J browser time adapter must return one canonical ISO timestamp per call."
  );

  const invalidNow = createWriterPackageWorkshopBrowserNow({
    readDate() {
      return new Date("not-a-date");
    }
  });
  let invalidNowThrew = false;
  try {
    invalidNow();
  } catch (error) {
    invalidNowThrew =
      error instanceof Error &&
      error.message === "WRITER_PACKAGE_WORKSHOP_TIME_UNAVAILABLE";
  }
  check(invalidNowThrew, "K invalid browser time must throw only a stable safe code.");

  const owned = activeOwnership();
  let sessionNowCalls = 0;
  const sessionStorageSource = new ArtificialStorage(baseRaw);
  const sessionStorage = createWriterPackageWorkshopBrowserStorage(
    sessionStorageSource
  );
  const dependencies = createWriterPackageWorkshopBrowserSessionDependencies({
    storage: sessionStorage,
    ownership: owned.ownership,
    now: () => {
      sessionNowCalls += 1;
      return NEXT;
    }
  });
  const session = createWriterPackageWorkshopEditingSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE,
    dependencies
  });
  const openView = session.getViewModel();
  check(
    openView.status === "editable" &&
      sessionStorageSource.operations.join(",") === "get" &&
      sessionNowCalls === 0,
    "L opening through D4c dependencies must inspect once and perform no time or write effect."
  );
  session.editWorkshopText("Synthetic browser changed workshop");
  const saveResult = session.requestAutosave();
  const savedPackage = readSinglePackage(sessionStorageSource);
  check(
    saveResult.accepted &&
      saveResult.view.status === "editable" &&
      saveResult.view.autosaveState.status === "saved" &&
      savedPackage.workshopText === "Synthetic browser changed workshop" &&
      savedPackage.updatedAt === NEXT &&
      sessionNowCalls === 1 &&
      sessionStorageSource.operations.join(",") === "get,get,set,get" &&
      sessionStorageSource.keys.every((key) => key === WRITER_PACKAGE_STORAGE_KEY),
    "M an accepted save must use one timestamp and the existing Package key only."
  );

  const unchangedStorageSource = new ArtificialStorage(baseRaw);
  const unchangedSession = createWriterPackageWorkshopEditingSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE,
    dependencies: createWriterPackageWorkshopBrowserSessionDependencies({
      storage: createWriterPackageWorkshopBrowserStorage(unchangedStorageSource),
      ownership: activeOwnership().ownership,
      now: () => NEXT
    })
  });
  unchangedSession.editWorkshopText("Synthetic browser workshop");
  const unchangedSave = unchangedSession.requestAutosave();
  check(
    unchangedSave.accepted &&
      unchangedSave.view.status === "editable" &&
      unchangedSave.view.autosaveState.status === "saved" &&
      unchangedStorageSource.operations.join(",") === "get,get" &&
      unchangedStorageSource.currentRaw === baseRaw,
    "N unchanged workshop text must not write the Package key."
  );

  const deniedOwnershipStorage = new ArtificialStorage(baseRaw);
  const deniedSession = createWriterPackageWorkshopEditingSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE,
    dependencies: createWriterPackageWorkshopBrowserSessionDependencies({
      storage: createWriterPackageWorkshopBrowserStorage(deniedOwnershipStorage),
      ownership: Object.freeze({
        hasWriteOwnership: () => false,
        releaseWriteOwnership: () => {}
      }),
      now: () => NEXT
    })
  });
  const deniedView = deniedSession.getViewModel();
  check(
    deniedView.status === "read-only" &&
      deniedView.reason === "write-ownership-unavailable" &&
      deniedOwnershipStorage.operations.length === 0,
    "O denied ownership must block before fresh storage inspection."
  );

  const lostOwnership = activeOwnership();
  const lostStorage = new ArtificialStorage(baseRaw);
  const lostSession = createWriterPackageWorkshopEditingSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE,
    dependencies: createWriterPackageWorkshopBrowserSessionDependencies({
      storage: createWriterPackageWorkshopBrowserStorage(lostStorage),
      ownership: lostOwnership.ownership,
      now: () => NEXT
    })
  });
  lostSession.editWorkshopText("Synthetic lost ownership draft");
  lostOwnership.deactivate();
  const lostSave = lostSession.requestAutosave();
  check(
    lostSave.accepted &&
      lostSave.view.status === "editable" &&
      lostSave.view.autosaveState.status === "failed-safe" &&
      lostSave.view.issue === "write-ownership-lost" &&
      lostStorage.operations.join(",") === "get",
    "P lost ownership before save must fail safely before time or persistence."
  );

  const grantedLock = lockManager("grant");
  const granted = await acquireWriterPackageWorkshopBrowserWriteOwnership(
    grantedLock.manager
  );
  check(
    granted.status === "active" &&
      granted.ownership.hasWriteOwnership() &&
      grantedLock.calls.length === 1 &&
      grantedLock.calls[0].name === WRITER_PACKAGE_WORKSHOP_WRITE_LOCK_NAME &&
      grantedLock.calls[0].mode === "exclusive" &&
      grantedLock.calls[0].ifAvailable,
    "Q lock acquisition must request the fixed exclusive non-waiting Web Lock."
  );
  if (granted.status === "active") {
    granted.ownership.releaseWriteOwnership();
    granted.ownership.releaseWriteOwnership();
  }
  check(
    granted.status === "active" && !granted.ownership.hasWriteOwnership(),
    "R lock release must be explicit and idempotent."
  );

  const deniedLock = lockManager("deny");
  const denied = await acquireWriterPackageWorkshopBrowserWriteOwnership(
    deniedLock.manager
  );
  check(
    denied.status === "unavailable" &&
      denied.reason === "web-lock-denied" &&
      deniedLock.calls.length === 1,
    "S denied Web Lock must remain unavailable without waiting."
  );

  const unavailable = await acquireWriterPackageWorkshopBrowserWriteOwnership(null);
  const throwingLock = await acquireWriterPackageWorkshopBrowserWriteOwnership(
    lockManager("throw").manager
  );
  check(
    unavailable.status === "unavailable" &&
      unavailable.reason === "web-locks-unavailable" &&
      throwingLock.status === "unavailable" &&
      throwingLock.reason === "web-lock-request-failed",
    "T missing or throwing Web Locks must fail closed."
  );

  const timers = new ArtificialTimers();
  const scheduler = createWriterPackageWorkshopDebounceScheduler({
    timers,
    delayMs: 25.9
  });
  const fired: string[] = [];
  check(
    !scheduler.hasPending() && timers.delays.length === 0,
    "U creating a debounce scheduler must not schedule any timer."
  );
  scheduler.schedule(() => fired.push("first"));
  const firstHandle = timers.lastHandle();
  scheduler.schedule(() => fired.push("second"));
  const secondHandle = timers.lastHandle();
  const firstFired = timers.fire(firstHandle);
  const secondFired = timers.fire(secondHandle);
  check(
    !firstFired &&
      secondFired &&
      fired.join(",") === "second" &&
      timers.cleared.includes(firstHandle) &&
      timers.delays.join(",") === "25,25" &&
      !scheduler.hasPending(),
    "V debounce scheduling must keep only one pending timer and clear the previous handle."
  );
  scheduler.cancel();
  check(
    timers.cleared.filter((handle) => handle === secondHandle).length === 0,
    "W cancelling after a fired timer must be idempotent."
  );

  const zeroTimers = new ArtificialTimers();
  createWriterPackageWorkshopDebounceScheduler({
    timers: zeroTimers,
    delayMs: -1
  }).schedule(() => {});
  check(zeroTimers.delays[0] === 0, "X invalid debounce delays must normalize to zero.");

  const target = new ArtificialBeforeUnloadTarget();
  let warn = false;
  let prevented = 0;
  const guard = createWriterPackageWorkshopBeforeUnloadGuard({
    target,
    shouldWarn: () => warn
  });
  check(
    !guard.isRegistered() && target.operations.length === 0,
    "Y creating a beforeunload guard must not register a browser event."
  );
  check(!guard.sync() && target.operations.length === 0, "Z a clean state must not register beforeunload.");
  warn = true;
  check(guard.sync() && target.operations.join(",") === "add:beforeunload", "AA dirty state must register one beforeunload handler.");
  const event: WriterPackageWorkshopBeforeUnloadEvent = {
    preventDefault() {
      prevented += 1;
    }
  };
  const warnings = target.fire(event);
  check(
    prevented === 1 &&
      event.returnValue === "" &&
      warnings.join(",") === "",
    "AB beforeunload warning must be text-free and prevent the event only while dirty."
  );
  warn = false;
  const cleanEvent: WriterPackageWorkshopBeforeUnloadEvent = {
    preventDefault() {
      prevented += 1;
    }
  };
  target.fire(cleanEvent);
  check(
    prevented === 1 &&
      cleanEvent.returnValue === undefined &&
      !guard.sync() &&
      target.operations.join(",") === "add:beforeunload,remove:beforeunload",
    "AC clean transition must unregister the existing beforeunload handler."
  );
  warn = true;
  guard.sync();
  guard.dispose();
  guard.dispose();
  check(
    !guard.isRegistered() &&
      target.operations.join(",") ===
        "add:beforeunload,remove:beforeunload,add:beforeunload,remove:beforeunload",
    "AD beforeunload disposal must release the handler once."
  );

  let state = createWriterPackageWorkshopAutosaveState({
    editable: true,
    baseUpdatedAt: BASE
  });
  check(
    !writerPackageWorkshopAutosaveShouldWarnBeforeUnload(state),
    "AE clean autosave state must not warn before unload."
  );
  const dirty = applyWriterPackageWorkshopAutosaveEvent(state, { type: "edited" });
  if (!dirty.accepted) {
    throw new Error("Synthetic dirty transition failed.");
  }
  state = dirty.state;
  check(
    writerPackageWorkshopAutosaveShouldWarnBeforeUnload(state),
    "AF dirty autosave state must warn before unload."
  );

  const publicMetadata = JSON.stringify([
    thrownRead,
    denied,
    unavailable,
    throwingLock,
    lostSave.view
  ]);
  check(
    !publicMetadata.includes("Synthetic browser title") &&
      !publicMetadata.includes("Synthetic browser workshop") &&
      !publicMetadata.includes(PACKAGE_ID) &&
      !publicMetadata.includes(baseRaw),
    "AG public failure metadata must not expose raw JSON, Package IDs, titles, or draft text."
  );

  console.log(
    `WriterPackage workshop browser adapter checks: ${passed}/${passed} passed.`
  );
}

runChecks().catch((error) => {
  setTimeout(() => {
    throw error;
  }, 0);
});
