import {
  applyWriterPackageWorkshopAutosaveEvent,
  type WriterPackageWorkshopAutosaveEvent,
  type WriterPackageWorkshopAutosaveState,
  type WriterPackageWorkshopAutosaveTransitionResult
} from "./writerPackageWorkshopAutosaveState";
import type {
  WriterPackageWorkshopPersistenceBlockedReason,
  WriterPackageWorkshopPersistenceResult
} from "./writerPackageWorkshopPersistence";

export type WriterPackageWorkshopAutosaveRefresh =
  | "none"
  | "saved"
  | "unchanged";

export type WriterPackageWorkshopAutosaveBridgeResult = Readonly<{
  transition: WriterPackageWorkshopAutosaveTransitionResult;
  refresh: WriterPackageWorkshopAutosaveRefresh;
  blockedReason?: WriterPackageWorkshopPersistenceBlockedReason;
}>;

export type ApplyWriterPackageWorkshopPersistenceResultInput = Readonly<{
  state: WriterPackageWorkshopAutosaveState;
  saveRevision: number;
  result: WriterPackageWorkshopPersistenceResult;
}>;

function createAutosaveEvent(
  saveRevision: number,
  result: WriterPackageWorkshopPersistenceResult
): WriterPackageWorkshopAutosaveEvent {
  switch (result.status) {
    case "saved":
      return Object.freeze({
        type: "save-succeeded" as const,
        saveRevision,
        previousUpdatedAt: result.previousUpdatedAt,
        nextUpdatedAt: result.nextUpdatedAt
      });
    case "unchanged":
      return Object.freeze({
        type: "save-unchanged" as const,
        saveRevision,
        currentUpdatedAt: result.package.updatedAt
      });
    case "conflict":
      return Object.freeze({
        type: "save-conflicted" as const,
        saveRevision,
        currentUpdatedAt: result.currentUpdatedAt
      });
    case "blocked":
      return Object.freeze({
        type: "save-failed" as const,
        saveRevision,
        failure: Object.freeze({
          stage: "blocked" as const,
          writeAttempted: false,
          rollbackAttempted: false,
          rollbackSucceeded: false,
          storageState: "not-written" as const
        })
      });
    case "failed":
      return Object.freeze({
        type: "save-failed" as const,
        saveRevision,
        failure: Object.freeze({
          stage: result.stage,
          writeAttempted: result.writeAttempted,
          rollbackAttempted: result.rollbackAttempted,
          rollbackSucceeded: result.rollbackSucceeded,
          storageState: result.storageState
        })
      });
  }
}

export function applyWriterPackageWorkshopPersistenceResult({
  state,
  saveRevision,
  result
}: ApplyWriterPackageWorkshopPersistenceResultInput): WriterPackageWorkshopAutosaveBridgeResult {
  const transition = applyWriterPackageWorkshopAutosaveEvent(
    state,
    createAutosaveEvent(saveRevision, result)
  );
  const refresh =
    transition.accepted &&
    (result.status === "saved" || result.status === "unchanged")
      ? result.status
      : "none";

  return Object.freeze({
    transition,
    refresh,
    ...(transition.accepted && result.status === "blocked"
      ? { blockedReason: result.reason }
      : {})
  });
}
