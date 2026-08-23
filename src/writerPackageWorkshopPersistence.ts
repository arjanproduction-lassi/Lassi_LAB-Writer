import type { WriterPackage } from "./types";
import {
  parseWriterPackageCollectionJsonStrict,
  serializeWriterPackageCollection,
  type WriterPackageCollectionFailureReason
} from "./writerPackageCollectionCodec";
import {
  planWriterPackageWorkshopEdit,
  type WriterPackageWorkshopEditBlockedReason
} from "./writerPackageWorkshopEdit";

export type WriterPackageWorkshopStorage = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

export type PersistWriterPackageWorkshopEditInput = Readonly<{
  storage: WriterPackageWorkshopStorage;
  key: string;
  packageId: string;
  expectedUpdatedAt: string;
  workshopText: string;
  now: string;
}>;

export type WriterPackageWorkshopPersistenceBlockedReason =
  | "invalid-storage-key"
  | "package-storage-missing"
  | WriterPackageCollectionFailureReason
  | Exclude<WriterPackageWorkshopEditBlockedReason, "stale-revision">;

export type WriterPackageWorkshopPersistenceFailureStage =
  | "current-read"
  | "serialize"
  | "write"
  | "read-back"
  | "verify";

export type WriterPackageWorkshopPersistenceStorageState =
  | "not-written"
  | "previous-verified"
  | "unknown";

export type WriterPackageWorkshopPersistenceFailure = Readonly<{
  status: "failed";
  stage: WriterPackageWorkshopPersistenceFailureStage;
  writeAttempted: boolean;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  storageState: WriterPackageWorkshopPersistenceStorageState;
  rollbackStage?: "inspect" | "write" | "verify";
}>;

export type WriterPackageWorkshopPersistenceResult =
  | Readonly<{
      status: "saved";
      package: Readonly<WriterPackage>;
      previousUpdatedAt: string;
      nextUpdatedAt: string;
    }>
  | Readonly<{
      status: "unchanged";
      package: Readonly<WriterPackage>;
    }>
  | Readonly<{
      status: "conflict";
      expectedUpdatedAt: string;
      currentUpdatedAt: string;
    }>
  | Readonly<{
      status: "blocked";
      reason: WriterPackageWorkshopPersistenceBlockedReason;
    }>
  | WriterPackageWorkshopPersistenceFailure;

type FailureOverrides = Readonly<{
  rollbackAttempted?: boolean;
  rollbackSucceeded?: boolean;
  storageState?: WriterPackageWorkshopPersistenceStorageState;
  rollbackStage?: WriterPackageWorkshopPersistenceFailure["rollbackStage"];
}>;

function blocked(
  reason: WriterPackageWorkshopPersistenceBlockedReason
): WriterPackageWorkshopPersistenceResult {
  return Object.freeze({ status: "blocked" as const, reason });
}

function failed(
  stage: WriterPackageWorkshopPersistenceFailureStage,
  writeAttempted: boolean,
  overrides: FailureOverrides = {}
): WriterPackageWorkshopPersistenceFailure {
  return Object.freeze({
    status: "failed" as const,
    stage,
    writeAttempted,
    rollbackAttempted: overrides.rollbackAttempted ?? false,
    rollbackSucceeded: overrides.rollbackSucceeded ?? false,
    storageState:
      overrides.storageState ?? (writeAttempted ? "unknown" : "not-written"),
    ...(overrides.rollbackStage
      ? { rollbackStage: overrides.rollbackStage }
      : {})
  });
}

function semanticCollectionsMatch(
  first: readonly Readonly<WriterPackage>[],
  second: readonly Readonly<WriterPackage>[]
): boolean {
  const firstSerialized = serializeWriterPackageCollection(first);
  const secondSerialized = serializeWriterPackageCollection(second);
  return (
    firstSerialized.ok &&
    secondSerialized.ok &&
    firstSerialized.raw === secondSerialized.raw
  );
}

function failAfterWriteAttempt(
  input: PersistWriterPackageWorkshopEditInput,
  stage: Extract<
    WriterPackageWorkshopPersistenceFailureStage,
    "write" | "read-back" | "verify"
  >,
  previousRaw: string,
  plannedRaw: string
): WriterPackageWorkshopPersistenceFailure {
  let inspectedRaw: string | null;
  try {
    inspectedRaw = input.storage.getItem(input.key);
  } catch {
    return failed(stage, true, {
      storageState: "unknown",
      rollbackStage: "inspect"
    });
  }

  if (inspectedRaw === previousRaw) {
    return failed(stage, true, { storageState: "previous-verified" });
  }

  if (inspectedRaw !== plannedRaw) {
    return failed(stage, true, { storageState: "unknown" });
  }

  let rollbackWriteThrew = false;
  try {
    input.storage.setItem(input.key, previousRaw);
  } catch {
    rollbackWriteThrew = true;
  }

  let rollbackRaw: string | null;
  try {
    rollbackRaw = input.storage.getItem(input.key);
  } catch {
    return failed(stage, true, {
      rollbackAttempted: true,
      storageState: "unknown",
      rollbackStage: rollbackWriteThrew ? "write" : "verify"
    });
  }

  if (rollbackRaw === previousRaw) {
    return failed(stage, true, {
      rollbackAttempted: true,
      rollbackSucceeded: true,
      storageState: "previous-verified"
    });
  }

  return failed(stage, true, {
    rollbackAttempted: true,
    storageState: "unknown",
    rollbackStage: rollbackWriteThrew ? "write" : "verify"
  });
}

export function persistWriterPackageWorkshopEdit(
  input: PersistWriterPackageWorkshopEditInput
): WriterPackageWorkshopPersistenceResult {
  if (typeof input.key !== "string" || input.key.trim().length === 0) {
    return blocked("invalid-storage-key");
  }

  let previousRaw: string | null;
  try {
    previousRaw = input.storage.getItem(input.key);
  } catch {
    return failed("current-read", false);
  }

  if (previousRaw === null) {
    return blocked("package-storage-missing");
  }

  const parsed = parseWriterPackageCollectionJsonStrict(previousRaw);
  if (!parsed.ok) {
    return blocked(parsed.reason);
  }

  const plan = planWriterPackageWorkshopEdit({
    packages: parsed.packages,
    packageId: input.packageId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    workshopText: input.workshopText,
    now: input.now
  });

  if (plan.status === "blocked") {
    if (plan.reason === "stale-revision") {
      const currentPackage = parsed.packages.find(
        (writerPackage) => writerPackage.id === input.packageId
      );
      if (!currentPackage) {
        return blocked("package-not-found");
      }
      return Object.freeze({
        status: "conflict" as const,
        expectedUpdatedAt: input.expectedUpdatedAt,
        currentUpdatedAt: currentPackage.updatedAt
      });
    }
    return blocked(plan.reason);
  }

  if (plan.status === "unchanged") {
    return Object.freeze({
      status: "unchanged" as const,
      package: plan.package
    });
  }

  const serialized = serializeWriterPackageCollection(plan.packages);
  if (!serialized.ok) {
    return failed("serialize", false);
  }
  const plannedRaw = serialized.raw;

  try {
    input.storage.setItem(input.key, plannedRaw);
  } catch {
    return failAfterWriteAttempt(
      input,
      "write",
      previousRaw,
      plannedRaw
    );
  }

  let readBackRaw: string | null;
  try {
    readBackRaw = input.storage.getItem(input.key);
  } catch {
    return failAfterWriteAttempt(
      input,
      "read-back",
      previousRaw,
      plannedRaw
    );
  }

  if (readBackRaw !== plannedRaw) {
    return failAfterWriteAttempt(
      input,
      "verify",
      previousRaw,
      plannedRaw
    );
  }

  const readBackParsed = parseWriterPackageCollectionJsonStrict(readBackRaw);
  if (
    !readBackParsed.ok ||
    !semanticCollectionsMatch(readBackParsed.packages, plan.packages)
  ) {
    return failAfterWriteAttempt(
      input,
      "verify",
      previousRaw,
      plannedRaw
    );
  }

  return Object.freeze({
    status: "saved" as const,
    package: plan.updatedPackage,
    previousUpdatedAt: plan.previousUpdatedAt,
    nextUpdatedAt: plan.nextUpdatedAt
  });
}
