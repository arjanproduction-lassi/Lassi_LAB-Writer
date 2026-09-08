import type { WriterPackage } from "./types";
import {
  applyWriterPackageWorkshopAutosaveEvent,
  createWriterPackageWorkshopAutosaveState
} from "./writerPackageWorkshopAutosaveState";
import type {
  WriterPackageWorkshopBrowserLock,
  WriterPackageWorkshopBrowserLockManager,
  WriterPackageWorkshopTimerTarget
} from "./writerPackageWorkshopBrowserAdapters";
import { WRITER_PACKAGE_STORAGE_KEY } from "./writerPackageStorage";
import { serializeWriterPackageCollection } from "./writerPackageCollectionCodec";
import { buildWriterLibraryReadOnlySnapshot } from "./writerLibraryReadOnlySnapshot";
import { createProductShellWorkshopEditRuntime } from "./productShellWorkshopEditRuntime";

const BASE = "2026-01-02T08:00:00.000Z";
const NEXT = "2026-01-03T09:10:11.123Z";
const PACKAGE_ID = "synthetic-runtime-package";
const OTHER_PACKAGE_ID = "synthetic-runtime-other";

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
    title: "Synthetic runtime title",
    sparkText: "Synthetic runtime spark",
    notes: [],
    workshopText: "Synthetic runtime workshop",
    finalText: "Synthetic runtime final",
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

  constructor(initialRaw: string | null) {
    this.currentRaw = initialRaw;
  }

  getItem(key: string): string | null {
    this.operations.push("get");
    this.keys.push(key);
    return this.currentRaw;
  }

  setItem(key: string, value: string): void {
    this.operations.push("set");
    this.keys.push(key);
    this.currentRaw = value;
  }
}

class ArtificialTimers implements WriterPackageWorkshopTimerTarget {
  readonly delays: number[] = [];
  readonly cleared: unknown[] = [];
  private nextHandle = 1;

  setTimeout(_callback: () => void, delayMs: number): unknown {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.delays.push(delayMs);
    return handle;
  }

  clearTimeout(handle: unknown): void {
    this.cleared.push(handle);
  }
}

class ArtificialBeforeUnloadTarget {
  readonly operations: string[] = [];

  addEventListener(): void {
    this.operations.push("add");
  }

  removeEventListener(): void {
    this.operations.push("remove");
  }
}

function lockManager(
  behavior: "grant" | "deny"
): WriterPackageWorkshopBrowserLockManager {
  return Object.freeze({
    request(_name, _options, callback) {
      return callback(behavior === "grant" ? Object.freeze({}) as WriterPackageWorkshopBrowserLock : null);
    }
  });
}

function createRuntime(
  storage: ArtificialStorage,
  locks: WriterPackageWorkshopBrowserLockManager | null | undefined = lockManager("grant"),
  timers = new ArtificialTimers(),
  beforeUnloadTarget = new ArtificialBeforeUnloadTarget(),
  confirmUnsavedExit = () => false
) {
  return createProductShellWorkshopEditRuntime({
    storage,
    locks,
    timers,
    beforeUnloadTarget,
    now: () => NEXT,
    debounceDelayMs: 42,
    confirmUnsavedExit
  });
}

async function runChecks() {
  const baseRaw = raw([
    syntheticPackage(),
    syntheticPackage({
      id: OTHER_PACKAGE_ID,
      title: "Synthetic other package",
      updatedAt: "2026-01-01T07:00:00.000Z"
    })
  ]);

  const noLockStorage = new ArtificialStorage(baseRaw);
  const noLockOpen = await createRuntime(noLockStorage, null).openSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    noLockOpen.status === "read-only" &&
      noLockOpen.reason === "web-locks-unavailable" &&
      noLockStorage.operations.length === 0,
    "A missing Web Locks must keep D4d read-only before storage inspection."
  );

  const deniedLockStorage = new ArtificialStorage(baseRaw);
  const deniedLockOpen = await createRuntime(
    deniedLockStorage,
    lockManager("deny")
  ).openSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    deniedLockOpen.status === "read-only" &&
      deniedLockOpen.reason === "web-lock-denied" &&
      deniedLockStorage.operations.length === 0,
    "B denied Web Lock must keep D4d read-only without Package storage access."
  );

  const openStorage = new ArtificialStorage(baseRaw);
  const runtime = createRuntime(openStorage);
  const opened = await runtime.openSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    opened.status === "editable" &&
      openStorage.operations.join(",") === "get" &&
      openStorage.keys.every((key) => key === WRITER_PACKAGE_STORAGE_KEY),
    "C opening an editable D4d session must inspect once and write nothing."
  );

  if (opened.status !== "editable") {
    throw new Error("Synthetic D4d editable open failed.");
  }
  opened.session.editWorkshopText("Synthetic runtime changed workshop");
  const saved = opened.session.requestAutosave();
  check(
    saved.accepted &&
      saved.view.status === "editable" &&
      saved.view.autosaveState.status === "saved" &&
      openStorage.operations.join(",") === "get,get,set,get" &&
      openStorage.keys.every((key) => key === WRITER_PACKAGE_STORAGE_KEY),
    "D D4d-composed save must write only the existing Package storage key after an accepted save."
  );

  const snapshot = buildWriterLibraryReadOnlySnapshot([
    syntheticPackage(),
    syntheticPackage({
      id: OTHER_PACKAGE_ID,
      title: "Synthetic other package",
      updatedAt: "2026-01-01T07:00:00.000Z"
    })
  ]);
  const refreshed =
    saved.view.status === "editable" && saved.view.autosaveState.status !== "read-only"
      ? runtime.refreshSelectedPackage({
          snapshot,
          packageId: PACKAGE_ID,
          expectedUpdatedAt: saved.view.autosaveState.baseUpdatedAt
        })
      : undefined;
  check(
    refreshed?.status === "ready" &&
      refreshed.snapshot.detailsById[PACKAGE_ID].workshopText ===
        "Synthetic runtime changed workshop" &&
      refreshed.snapshot.detailsById[OTHER_PACKAGE_ID] ===
        snapshot.detailsById[OTHER_PACKAGE_ID] &&
      refreshed.snapshot.items.length === snapshot.items.length &&
      openStorage.operations.join(",") === "get,get,set,get,get",
    "E refresh must read back and replace only the selected Package snapshot."
  );

  const missingSnapshotStorage = new ArtificialStorage(baseRaw);
  const missingRefresh = createRuntime(
    missingSnapshotStorage
  ).refreshSelectedPackage({
    snapshot,
    packageId: "missing-snapshot-package",
    expectedUpdatedAt: BASE
  });
  check(
    missingRefresh.status === "blocked" &&
      missingRefresh.reason === "snapshot-package-missing" &&
      missingSnapshotStorage.operations.length === 0,
    "F refresh must block missing snapshot targets before storage access."
  );

  const staleRefreshStorage = new ArtificialStorage(baseRaw);
  const staleRefresh = createRuntime(staleRefreshStorage).refreshSelectedPackage({
    snapshot,
    packageId: PACKAGE_ID,
    expectedUpdatedAt: NEXT
  });
  check(
    staleRefresh.status === "blocked" &&
      staleRefresh.reason === "stale-revision" &&
      staleRefreshStorage.operations.join(",") === "get",
    "G refresh must keep stale stored Packages blocked and read-only."
  );

  const deletedStorage = new ArtificialStorage(
    raw([syntheticPackage({ deletedAt: NEXT })])
  );
  const deletedOpen = await createRuntime(deletedStorage).openSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE
  });
  check(
    deletedOpen.status === "read-only" &&
      deletedOpen.reason === "package-deleted" &&
      deletedStorage.operations.join(",") === "get",
    "H deleted Packages must remain read-only after one inspection."
  );

  const timers = new ArtificialTimers();
  const scheduler = createRuntime(new ArtificialStorage(baseRaw), lockManager("grant"), timers)
    .createAutosaveScheduler();
  check(
    !scheduler.hasPending() && timers.delays.length === 0,
    "I creating the D4d scheduler must not schedule a timer."
  );
  scheduler.schedule(() => {});
  check(
    scheduler.hasPending() && timers.delays.join(",") === "42",
    "J D4d scheduler must use the injected debounce delay."
  );

  const beforeUnloadTarget = new ArtificialBeforeUnloadTarget();
  const beforeUnloadRuntime = createRuntime(
    new ArtificialStorage(baseRaw),
    lockManager("grant"),
    new ArtificialTimers(),
    beforeUnloadTarget
  );
  const guard = beforeUnloadRuntime.createBeforeUnloadGuard({
    shouldWarn: () => false
  });
  check(
    !guard.isRegistered() &&
      !guard.sync() &&
      beforeUnloadTarget.operations.length === 0,
    "K D4d beforeunload guard creation and clean sync must have no browser registration effect."
  );

  let state = createWriterPackageWorkshopAutosaveState({
    editable: true,
    baseUpdatedAt: BASE
  });
  const dirty = applyWriterPackageWorkshopAutosaveEvent(state, { type: "edited" });
  if (!dirty.accepted) {
    throw new Error("Synthetic dirty transition failed.");
  }
  state = dirty.state;
  check(
    beforeUnloadRuntime.shouldWarnBeforeUnload(state),
    "L D4d beforeunload warning must delegate to the D3 text-free autosave state."
  );

  check(
    createRuntime(
      new ArtificialStorage(baseRaw),
      lockManager("grant"),
      new ArtificialTimers(),
      new ArtificialBeforeUnloadTarget(),
      () => true
    ).confirmUnsavedExit("library-return") &&
      !createRuntime(
        new ArtificialStorage(baseRaw),
        lockManager("grant"),
        new ArtificialTimers(),
        new ArtificialBeforeUnloadTarget(),
        () => {
          throw new Error("Synthetic confirmation failure.");
        }
      ).confirmUnsavedExit("package-switch"),
    "M D4d confirmation must use the injected decision and fail closed."
  );

  const publicMetadata = JSON.stringify([
    noLockOpen,
    deniedLockOpen,
    staleRefresh,
    deletedOpen
  ]);
  check(
    !publicMetadata.includes(PACKAGE_ID) &&
      !publicMetadata.includes("Synthetic runtime title") &&
      !publicMetadata.includes("Synthetic runtime workshop") &&
      !publicMetadata.includes(baseRaw),
    "N D4d public failure metadata must not expose Package ids, titles, drafts, or raw JSON."
  );

  console.log(
    `Product shell workshop edit runtime checks: ${passed}/${passed} passed.`
  );
}

runChecks().catch((error) => {
  setTimeout(() => {
    throw error;
  }, 0);
});
