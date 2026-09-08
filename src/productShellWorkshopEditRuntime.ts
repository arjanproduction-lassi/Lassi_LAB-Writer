import type { WriterPackage } from "./types";
import { toWriterLibraryDetail } from "./writerLibraryDetailViewModel";
import type {
  WriterLibraryReadOnlySnapshot
} from "./writerLibraryReadOnlySnapshot";
import { toWriterLibraryItem } from "./writerLibraryViewModel";
import {
  createWriterPackageWorkshopEditingSession,
  type WriterPackageWorkshopEditingSession,
  type WriterPackageWorkshopSessionReadOnlyReason
} from "./writerPackageWorkshopEditingSession";
import {
  acquireWriterPackageWorkshopBrowserWriteOwnership,
  createWriterPackageWorkshopBeforeUnloadGuard,
  createWriterPackageWorkshopBrowserSessionDependencies,
  createWriterPackageWorkshopDebounceScheduler,
  inspectWriterPackageWorkshopBrowserEditablePackage,
  writerPackageWorkshopAutosaveShouldWarnBeforeUnload,
  type WriterPackageWorkshopBeforeUnloadGuard,
  type WriterPackageWorkshopBeforeUnloadTarget,
  type WriterPackageWorkshopBrowserInspectionBlockedReason,
  type WriterPackageWorkshopBrowserLockManager,
  type WriterPackageWorkshopBrowserWriteOwnershipResult,
  type WriterPackageWorkshopDebounceScheduler,
  type WriterPackageWorkshopTimerTarget
} from "./writerPackageWorkshopBrowserAdapters";
import type { WriterPackageWorkshopAutosaveState } from "./writerPackageWorkshopAutosaveState";
import type { WriterPackageWorkshopStorage } from "./writerPackageWorkshopPersistence";
import { WRITER_PACKAGE_STORAGE_KEY } from "./writerPackageStorage";

export type ProductShellWorkshopEditExitAction =
  | "package-switch"
  | "layer-switch"
  | "library-return"
  | "reset"
  | "unload";

export type ProductShellWorkshopEditReadOnlyReason =
  | Extract<
      WriterPackageWorkshopBrowserWriteOwnershipResult,
      { status: "unavailable" }
    >["reason"]
  | WriterPackageWorkshopSessionReadOnlyReason
  | "legacy-spark-adapted"
  | "session-closed";

export type ProductShellWorkshopEditOpenResult =
  | Readonly<{
      status: "editable";
      session: WriterPackageWorkshopEditingSession;
    }>
  | Readonly<{
      status: "read-only";
      reason: ProductShellWorkshopEditReadOnlyReason;
    }>;

export type ProductShellWorkshopEditRefreshBlockedReason =
  | WriterPackageWorkshopBrowserInspectionBlockedReason
  | "snapshot-package-missing";

export type ProductShellWorkshopEditRefreshResult =
  | Readonly<{
      status: "ready";
      snapshot: WriterLibraryReadOnlySnapshot;
    }>
  | Readonly<{
      status: "blocked";
      reason: ProductShellWorkshopEditRefreshBlockedReason;
    }>;

export type ProductShellWorkshopEditRuntime = Readonly<{
  openSession: (input: Readonly<{
    packageId: string;
    expectedUpdatedAt: string;
  }>) => Promise<ProductShellWorkshopEditOpenResult>;
  refreshSelectedPackage: (input: Readonly<{
    snapshot: WriterLibraryReadOnlySnapshot;
    packageId: string;
    expectedUpdatedAt: string;
  }>) => ProductShellWorkshopEditRefreshResult;
  createAutosaveScheduler: () => WriterPackageWorkshopDebounceScheduler;
  createBeforeUnloadGuard: (input: Readonly<{
    shouldWarn: () => boolean;
  }>) => WriterPackageWorkshopBeforeUnloadGuard;
  shouldWarnBeforeUnload: (state: WriterPackageWorkshopAutosaveState) => boolean;
  confirmUnsavedExit: (action: ProductShellWorkshopEditExitAction) => boolean;
}>;

export type ProductShellWorkshopEditRuntimeInput = Readonly<{
  storage: WriterPackageWorkshopStorage;
  locks: WriterPackageWorkshopBrowserLockManager | null | undefined;
  timers: WriterPackageWorkshopTimerTarget;
  beforeUnloadTarget: WriterPackageWorkshopBeforeUnloadTarget;
  now: () => string;
  key?: string;
  debounceDelayMs?: number;
  confirmUnsavedExit?: (action: ProductShellWorkshopEditExitAction) => boolean;
}>;

function hasSnapshotPackage(
  snapshot: WriterLibraryReadOnlySnapshot,
  packageId: string
): boolean {
  return (
    snapshot.items.some((item) => item.id === packageId) &&
    Object.prototype.hasOwnProperty.call(snapshot.detailsById, packageId)
  );
}

function replaceSnapshotPackage(
  snapshot: WriterLibraryReadOnlySnapshot,
  writerPackage: Readonly<WriterPackage>
): WriterLibraryReadOnlySnapshot {
  const nextItem = toWriterLibraryItem(writerPackage);
  const nextDetail = toWriterLibraryDetail(writerPackage);
  const detailsById = Object.create(null) as Record<string, typeof nextDetail>;

  for (const key of Object.keys(snapshot.detailsById)) {
    Object.defineProperty(detailsById, key, {
      value: key === nextDetail.id ? nextDetail : snapshot.detailsById[key],
      enumerable: true,
      writable: false,
      configurable: false
    });
  }

  return Object.freeze({
    items: Object.freeze(
      snapshot.items.map((item) => (item.id === nextItem.id ? nextItem : item))
    ),
    detailsById: Object.freeze(detailsById)
  });
}

function safeConfirm(
  confirm: (action: ProductShellWorkshopEditExitAction) => boolean,
  action: ProductShellWorkshopEditExitAction
): boolean {
  try {
    return confirm(action);
  } catch {
    return false;
  }
}

export function createProductShellWorkshopEditRuntime({
  storage,
  locks,
  timers,
  beforeUnloadTarget,
  now,
  key = WRITER_PACKAGE_STORAGE_KEY,
  debounceDelayMs = 600,
  confirmUnsavedExit = () => false
}: ProductShellWorkshopEditRuntimeInput): ProductShellWorkshopEditRuntime {
  return Object.freeze({
    async openSession({ packageId, expectedUpdatedAt }) {
      const ownership = await acquireWriterPackageWorkshopBrowserWriteOwnership(
        locks
      );
      if (ownership.status === "unavailable") {
        return Object.freeze({
          status: "read-only" as const,
          reason: ownership.reason
        });
      }

      const session = createWriterPackageWorkshopEditingSession({
        packageId,
        expectedUpdatedAt,
        dependencies: createWriterPackageWorkshopBrowserSessionDependencies({
          storage,
          ownership: ownership.ownership,
          now,
          key
        })
      });
      const view = session.getViewModel();
      if (view.status !== "editable") {
        return Object.freeze({
          status: "read-only" as const,
          reason: view.status === "read-only" ? view.reason : "session-closed"
        });
      }

      return Object.freeze({
        status: "editable" as const,
        session
      });
    },
    refreshSelectedPackage({ snapshot, packageId, expectedUpdatedAt }) {
      if (!hasSnapshotPackage(snapshot, packageId)) {
        return Object.freeze({
          status: "blocked" as const,
          reason: "snapshot-package-missing" as const
        });
      }

      const inspection = inspectWriterPackageWorkshopBrowserEditablePackage({
        storage,
        key,
        packageId,
        expectedUpdatedAt
      });
      if (inspection.status === "blocked") {
        return Object.freeze({
          status: "blocked" as const,
          reason: inspection.reason
        });
      }

      return Object.freeze({
        status: "ready" as const,
        snapshot: replaceSnapshotPackage(snapshot, inspection.package)
      });
    },
    createAutosaveScheduler() {
      return createWriterPackageWorkshopDebounceScheduler({
        timers,
        delayMs: debounceDelayMs
      });
    },
    createBeforeUnloadGuard({ shouldWarn }) {
      return createWriterPackageWorkshopBeforeUnloadGuard({
        target: beforeUnloadTarget,
        shouldWarn
      });
    },
    shouldWarnBeforeUnload: writerPackageWorkshopAutosaveShouldWarnBeforeUnload,
    confirmUnsavedExit(action) {
      return safeConfirm(confirmUnsavedExit, action);
    }
  });
}
