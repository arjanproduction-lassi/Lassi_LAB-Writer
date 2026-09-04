import { WRITER_PACKAGE_STORAGE_KEY } from "./writerPackageStorage";
import {
  parseWriterPackageCollectionJsonStrict,
  type WriterPackageCollectionFailureReason
} from "./writerPackageCollectionCodec";
import type {
  WriterPackageWorkshopEditableInspection,
  WriterPackageWorkshopEditingSessionDependencies,
  WriterPackageWorkshopInspectionBlockedReason
} from "./writerPackageWorkshopEditingSession";
import {
  persistWriterPackageWorkshopEdit,
  type WriterPackageWorkshopStorage
} from "./writerPackageWorkshopPersistence";
import {
  writerPackageWorkshopHasUnsavedDraft,
  type WriterPackageWorkshopAutosaveState
} from "./writerPackageWorkshopAutosaveState";
import type { WriterPackage } from "./types";

export const WRITER_PACKAGE_WORKSHOP_EDIT_MODE = "real-edit-workshop";
export const WRITER_PACKAGE_WORKSHOP_WRITE_LOCK_NAME =
  "writer-package-workshop-edit";

export type WriterPackageWorkshopDevelopmentEditMode =
  | "fixture"
  | typeof WRITER_PACKAGE_WORKSHOP_EDIT_MODE;

export type ResolveWriterPackageWorkshopEditModeInput = Readonly<{
  isDevelopment: boolean;
  search: string;
}>;

export type WriterPackageWorkshopBrowserStorageSource = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

export type WriterPackageWorkshopBrowserInspectionBlockedReason =
  | "invalid-storage-key"
  | "package-storage-read-failed"
  | "package-storage-missing"
  | WriterPackageCollectionFailureReason
  | WriterPackageWorkshopInspectionBlockedReason;

export type WriterPackageWorkshopBrowserEditableInspection =
  | Readonly<{
      status: "editable";
      package: Readonly<WriterPackage>;
    }>
  | Readonly<{
      status: "blocked";
      reason: WriterPackageWorkshopBrowserInspectionBlockedReason;
    }>;

export type InspectWriterPackageWorkshopBrowserEditablePackageInput = Readonly<{
  storage: WriterPackageWorkshopStorage;
  key?: string;
  packageId: string;
  expectedUpdatedAt: string;
}>;

export type WriterPackageWorkshopBrowserNowInput = Readonly<{
  readDate?: () => Date;
}>;

export type WriterPackageWorkshopBrowserLock = Readonly<object>;

export type WriterPackageWorkshopBrowserLockManager = Readonly<{
  request: (
    name: typeof WRITER_PACKAGE_WORKSHOP_WRITE_LOCK_NAME,
    options: Readonly<{ mode: "exclusive"; ifAvailable: true }>,
    callback: (
      lock: WriterPackageWorkshopBrowserLock | null
    ) => Promise<void> | void
  ) => Promise<unknown> | unknown;
}>;

export type WriterPackageWorkshopWriteOwnership = Readonly<{
  hasWriteOwnership: () => boolean;
  releaseWriteOwnership: () => void;
}>;

export type WriterPackageWorkshopBrowserWriteOwnershipResult =
  | Readonly<{
      status: "active";
      ownership: WriterPackageWorkshopWriteOwnership;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "web-locks-unavailable"
        | "web-lock-denied"
        | "web-lock-request-failed";
    }>;

export type WriterPackageWorkshopTimerTarget = Readonly<{
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}>;

export type WriterPackageWorkshopDebounceScheduler = Readonly<{
  schedule: (callback: () => void) => void;
  cancel: () => void;
  hasPending: () => boolean;
}>;

export type CreateWriterPackageWorkshopDebounceSchedulerInput = Readonly<{
  timers: WriterPackageWorkshopTimerTarget;
  delayMs: number;
}>;

export type WriterPackageWorkshopBeforeUnloadEvent = {
  preventDefault?: () => void;
  returnValue?: string;
};

export type WriterPackageWorkshopBeforeUnloadHandler = (
  event: WriterPackageWorkshopBeforeUnloadEvent
) => string | undefined;

export type WriterPackageWorkshopBeforeUnloadTarget = Readonly<{
  addEventListener(
    type: "beforeunload",
    handler: WriterPackageWorkshopBeforeUnloadHandler
  ): void;
  removeEventListener(
    type: "beforeunload",
    handler: WriterPackageWorkshopBeforeUnloadHandler
  ): void;
}>;

export type WriterPackageWorkshopBeforeUnloadGuard = Readonly<{
  sync: () => boolean;
  dispose: () => void;
  isRegistered: () => boolean;
}>;

export type CreateWriterPackageWorkshopBeforeUnloadGuardInput = Readonly<{
  target: WriterPackageWorkshopBeforeUnloadTarget;
  shouldWarn: () => boolean;
}>;

export type WriterPackageWorkshopBrowserSessionDependenciesInput = Readonly<{
  storage: WriterPackageWorkshopStorage;
  ownership: WriterPackageWorkshopWriteOwnership;
  now: () => string;
  key?: string;
}>;

function decodeQueryComponent(value: string) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function readMode(search: string) {
  const query = search.startsWith("?") ? search.slice(1) : search;

  if (!query) {
    return undefined;
  }

  for (const pair of query.split("&")) {
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf("=");
    const rawKey = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);

    if (decodeQueryComponent(rawKey) !== "mode") {
      continue;
    }

    const rawValue = separatorIndex === -1 ? "" : pair.slice(separatorIndex + 1);
    return decodeQueryComponent(rawValue);
  }

  return undefined;
}

function unavailable(
  reason: Extract<
    WriterPackageWorkshopBrowserWriteOwnershipResult,
    { status: "unavailable" }
  >["reason"]
): WriterPackageWorkshopBrowserWriteOwnershipResult {
  return Object.freeze({ status: "unavailable" as const, reason });
}

function blocked(
  reason: WriterPackageWorkshopBrowserInspectionBlockedReason
): WriterPackageWorkshopBrowserEditableInspection {
  return Object.freeze({ status: "blocked" as const, reason });
}

function mapInspectionReason(
  reason: WriterPackageWorkshopBrowserInspectionBlockedReason
): WriterPackageWorkshopInspectionBlockedReason {
  switch (reason) {
    case "package-not-found":
    case "package-deleted":
    case "stale-revision":
    case "invalid-package":
      return reason;
    default:
      return "inspection-failed";
  }
}

function safeShouldWarn(shouldWarn: () => boolean): boolean {
  try {
    return shouldWarn();
  } catch {
    return false;
  }
}

function normalizeDelayMs(delayMs: number): number {
  return Number.isFinite(delayMs) && delayMs > 0 ? Math.floor(delayMs) : 0;
}

export function resolveWriterPackageWorkshopEditMode({
  isDevelopment,
  search
}: ResolveWriterPackageWorkshopEditModeInput): WriterPackageWorkshopDevelopmentEditMode {
  if (!isDevelopment) {
    return "fixture";
  }

  try {
    return readMode(search) === WRITER_PACKAGE_WORKSHOP_EDIT_MODE
      ? WRITER_PACKAGE_WORKSHOP_EDIT_MODE
      : "fixture";
  } catch {
    return "fixture";
  }
}

export function createWriterPackageWorkshopBrowserStorage(
  storage: WriterPackageWorkshopBrowserStorageSource
): WriterPackageWorkshopStorage {
  return Object.freeze({
    getItem(key) {
      return storage.getItem(key);
    },
    setItem(key, value) {
      storage.setItem(key, value);
    }
  });
}

export function inspectWriterPackageWorkshopBrowserEditablePackage({
  storage,
  key = WRITER_PACKAGE_STORAGE_KEY,
  packageId,
  expectedUpdatedAt
}: InspectWriterPackageWorkshopBrowserEditablePackageInput): WriterPackageWorkshopBrowserEditableInspection {
  if (typeof key !== "string" || key.trim().length === 0) {
    return blocked("invalid-storage-key");
  }

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return blocked("package-storage-read-failed");
  }

  if (raw === null) {
    return blocked("package-storage-missing");
  }

  const parsed = parseWriterPackageCollectionJsonStrict(raw);
  if (!parsed.ok) {
    return blocked(parsed.reason);
  }

  const writerPackage = parsed.packages.find(
    (candidate) => candidate.id === packageId
  );

  if (!writerPackage) {
    return blocked("package-not-found");
  }

  if (writerPackage.deletedAt !== undefined) {
    return blocked("package-deleted");
  }

  if (writerPackage.updatedAt !== expectedUpdatedAt) {
    return blocked("stale-revision");
  }

  return Object.freeze({
    status: "editable" as const,
    package: writerPackage
  });
}

export function createWriterPackageWorkshopBrowserNow({
  readDate = () => new Date()
}: WriterPackageWorkshopBrowserNowInput = {}): () => string {
  return () => {
    const date = readDate();
    const time = date.getTime();
    if (!Number.isFinite(time)) {
      throw new Error("WRITER_PACKAGE_WORKSHOP_TIME_UNAVAILABLE");
    }
    return new Date(time).toISOString();
  };
}

export async function acquireWriterPackageWorkshopBrowserWriteOwnership(
  locks: WriterPackageWorkshopBrowserLockManager | null | undefined
): Promise<WriterPackageWorkshopBrowserWriteOwnershipResult> {
  if (!locks) {
    return unavailable("web-locks-unavailable");
  }

  return new Promise((resolve) => {
    let resolved = false;

    const finish = (result: WriterPackageWorkshopBrowserWriteOwnershipResult) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(result);
    };

    let requestResult: unknown;
    try {
      requestResult = locks.request(
        WRITER_PACKAGE_WORKSHOP_WRITE_LOCK_NAME,
        Object.freeze({ mode: "exclusive" as const, ifAvailable: true as const }),
        (lock) => {
          if (!lock) {
            finish(unavailable("web-lock-denied"));
            return undefined;
          }

          let active = true;
          let releaseActiveLock = () => {};
          const releaseSignal = new Promise<void>((release) => {
            releaseActiveLock = release;
          });
          const ownership: WriterPackageWorkshopWriteOwnership = Object.freeze({
            hasWriteOwnership: () => active,
            releaseWriteOwnership() {
              if (!active) {
                return;
              }
              active = false;
              releaseActiveLock();
            }
          });

          finish(
            Object.freeze({
              status: "active" as const,
              ownership
            })
          );
          return releaseSignal;
        }
      );
    } catch {
      finish(unavailable("web-lock-request-failed"));
      return;
    }

    Promise.resolve(requestResult).then(
      () => finish(unavailable("web-lock-denied")),
      () => finish(unavailable("web-lock-request-failed"))
    );
  });
}

export function createWriterPackageWorkshopDebounceScheduler({
  timers,
  delayMs
}: CreateWriterPackageWorkshopDebounceSchedulerInput): WriterPackageWorkshopDebounceScheduler {
  const normalizedDelayMs = normalizeDelayMs(delayMs);
  let activeHandle: unknown;

  function cancel() {
    if (activeHandle === undefined) {
      return;
    }
    const handle = activeHandle;
    activeHandle = undefined;
    timers.clearTimeout(handle);
  }

  return Object.freeze({
    schedule(callback) {
      cancel();
      activeHandle = timers.setTimeout(() => {
        activeHandle = undefined;
        callback();
      }, normalizedDelayMs);
    },
    cancel,
    hasPending() {
      return activeHandle !== undefined;
    }
  });
}

export function writerPackageWorkshopAutosaveShouldWarnBeforeUnload(
  state: WriterPackageWorkshopAutosaveState
): boolean {
  return writerPackageWorkshopHasUnsavedDraft(state);
}

export function createWriterPackageWorkshopBeforeUnloadGuard({
  target,
  shouldWarn
}: CreateWriterPackageWorkshopBeforeUnloadGuardInput): WriterPackageWorkshopBeforeUnloadGuard {
  let registered = false;

  const handler: WriterPackageWorkshopBeforeUnloadHandler = (event) => {
    if (!safeShouldWarn(shouldWarn)) {
      return undefined;
    }
    event.preventDefault?.();
    event.returnValue = "";
    return "";
  };

  function sync() {
    const warn = safeShouldWarn(shouldWarn);
    if (warn && !registered) {
      target.addEventListener("beforeunload", handler);
      registered = true;
    } else if (!warn && registered) {
      target.removeEventListener("beforeunload", handler);
      registered = false;
    }
    return registered;
  }

  function dispose() {
    if (!registered) {
      return;
    }
    target.removeEventListener("beforeunload", handler);
    registered = false;
  }

  return Object.freeze({
    sync,
    dispose,
    isRegistered: () => registered
  });
}

export function createWriterPackageWorkshopBrowserSessionDependencies({
  storage,
  ownership,
  now,
  key = WRITER_PACKAGE_STORAGE_KEY
}: WriterPackageWorkshopBrowserSessionDependenciesInput): WriterPackageWorkshopEditingSessionDependencies {
  return Object.freeze({
    inspectEditablePackage(input): WriterPackageWorkshopEditableInspection {
      const inspection = inspectWriterPackageWorkshopBrowserEditablePackage({
        storage,
        key,
        packageId: input.packageId,
        expectedUpdatedAt: input.expectedUpdatedAt
      });

      if (inspection.status === "editable") {
        return Object.freeze({
          status: "editable" as const,
          package: inspection.package
        });
      }

      return Object.freeze({
        status: "blocked" as const,
        reason: mapInspectionReason(inspection.reason)
      });
    },
    hasWriteOwnership: ownership.hasWriteOwnership,
    releaseWriteOwnership: ownership.releaseWriteOwnership,
    persistWorkshopEdit(input) {
      return persistWriterPackageWorkshopEdit({
        storage,
        key,
        packageId: input.packageId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        workshopText: input.workshopText,
        now: input.now
      });
    },
    now
  });
}
