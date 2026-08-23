import type { WriterPackage } from "./types";
import {
  applyWriterPackageWorkshopPersistenceResult,
  type WriterPackageWorkshopAutosaveBridgeResult
} from "./writerPackageWorkshopAutosaveBridge";
import {
  applyWriterPackageWorkshopAutosaveEvent,
  createWriterPackageWorkshopAutosaveState,
  type WriterPackageWorkshopAutosaveState
} from "./writerPackageWorkshopAutosaveState";
import type { WriterPackageWorkshopPersistenceResult } from "./writerPackageWorkshopPersistence";

const BASE = "2026-01-02T08:00:00.000Z";
const NEXT = "2026-01-03T09:10:11.123Z";
const SYNTHETIC_PACKAGE_ID = "synthetic-package";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function syntheticPackage(updatedAt = NEXT): Readonly<WriterPackage> {
  return Object.freeze({
    id: SYNTHETIC_PACKAGE_ID,
    title: "Synthetic title",
    sparkText: "Synthetic spark",
    notes: [],
    workshopText: "Synthetic workshop",
    finalText: "Synthetic final",
    createdAt: BASE,
    updatedAt,
    packageVersion: 1 as const
  });
}

function saving(
  edits = 1
): Extract<WriterPackageWorkshopAutosaveState, { status: "saving" }> {
  let state = createWriterPackageWorkshopAutosaveState({
    editable: true,
    baseUpdatedAt: BASE
  });

  for (let index = 0; index < edits; index += 1) {
    const edited = applyWriterPackageWorkshopAutosaveEvent(state, {
      type: "edited"
    });
    if (!edited.accepted) {
      throw new Error(`Expected edit ${index + 1} to be accepted.`);
    }
    state = edited.state;
  }

  const requested = applyWriterPackageWorkshopAutosaveEvent(state, {
    type: "save-requested"
  });
  if (!requested.accepted || requested.state.status !== "saving") {
    throw new Error("Expected a saving state.");
  }
  return requested.state;
}

function bridge(
  state: WriterPackageWorkshopAutosaveState,
  result: WriterPackageWorkshopPersistenceResult,
  saveRevision = 1
): WriterPackageWorkshopAutosaveBridgeResult {
  return applyWriterPackageWorkshopPersistenceResult({
    state,
    saveRevision,
    result
  });
}

const savedResult: WriterPackageWorkshopPersistenceResult = Object.freeze({
  status: "saved" as const,
  package: syntheticPackage(),
  previousUpdatedAt: BASE,
  nextUpdatedAt: NEXT
});
const saved = bridge(saving(), savedResult);
check(
  saved.transition.accepted &&
    saved.transition.state.status === "saved" &&
    saved.transition.state.baseUpdatedAt === NEXT &&
    saved.refresh === "saved" &&
    Object.isFrozen(saved),
  "A verified saved result must map to accepted saved state and permit refresh."
);

const savingWithNewerEdit = applyWriterPackageWorkshopAutosaveEvent(saving(), {
  type: "edited"
});
if (!savingWithNewerEdit.accepted) {
  throw new Error("Expected an edit during save to be accepted.");
}
const lateSaved = bridge(savingWithNewerEdit.state, savedResult);
check(
  lateSaved.transition.accepted &&
    lateSaved.transition.state.status === "dirty" &&
    lateSaved.transition.state.localRevision === 2 &&
    lateSaved.transition.state.baseUpdatedAt === NEXT &&
    lateSaved.refresh === "saved",
  "B late saved result must refresh the verified base while preserving the newer draft."
);

const unchangedResult: WriterPackageWorkshopPersistenceResult = Object.freeze({
  status: "unchanged" as const,
  package: syntheticPackage(BASE)
});
const unchanged = bridge(saving(), unchangedResult);
check(
  unchanged.transition.accepted &&
    unchanged.transition.state.status === "saved" &&
    unchanged.transition.state.baseUpdatedAt === BASE &&
    unchanged.refresh === "unchanged",
  "C unchanged result must map through the returned Package revision."
);

const lateUnchanged = bridge(savingWithNewerEdit.state, unchangedResult);
check(
  lateUnchanged.transition.accepted &&
    lateUnchanged.transition.state.status === "dirty" &&
    lateUnchanged.transition.state.localRevision === 2 &&
    lateUnchanged.refresh === "unchanged",
  "D late unchanged result must not mark a newer local edit saved."
);

const conflict = bridge(
  saving(),
  Object.freeze({
    status: "conflict" as const,
    expectedUpdatedAt: BASE,
    currentUpdatedAt: NEXT
  })
);
check(
  conflict.transition.accepted &&
    conflict.transition.state.status === "conflict" &&
    conflict.transition.state.currentStoredUpdatedAt === NEXT &&
    conflict.refresh === "none",
  "E conflict must remain typed and must never permit refresh or overwrite."
);

const blocked = bridge(
  saving(),
  Object.freeze({
    status: "blocked" as const,
    reason: "package-storage-missing" as const
  })
);
check(
  blocked.transition.accepted &&
    blocked.transition.state.status === "failed-safe" &&
    blocked.transition.state.failure.stage === "blocked" &&
    blocked.transition.state.failure.storageState === "not-written" &&
    blocked.blockedReason === "package-storage-missing" &&
    blocked.refresh === "none",
  "F blocked result must become a safe text-free failure and retain its stable reason."
);

const failedBeforeWrite = bridge(
  saving(),
  Object.freeze({
    status: "failed" as const,
    stage: "current-read" as const,
    writeAttempted: false,
    rollbackAttempted: false,
    rollbackSucceeded: false,
    storageState: "not-written" as const
  })
);
check(
  failedBeforeWrite.transition.accepted &&
    failedBeforeWrite.transition.state.status === "failed-safe" &&
    failedBeforeWrite.transition.state.failure.stage === "current-read" &&
    !failedBeforeWrite.transition.state.failure.writeAttempted &&
    failedBeforeWrite.refresh === "none",
  "G pre-write failure must remain safely retryable with exact facts."
);

const rollbackVerified = bridge(
  saving(),
  Object.freeze({
    status: "failed" as const,
    stage: "verify" as const,
    writeAttempted: true,
    rollbackAttempted: true,
    rollbackSucceeded: true,
    storageState: "previous-verified" as const,
    rollbackStage: "verify" as const
  })
);
check(
  rollbackVerified.transition.accepted &&
    rollbackVerified.transition.state.status === "failed-safe" &&
    rollbackVerified.transition.state.failure.rollbackAttempted &&
    rollbackVerified.transition.state.failure.rollbackSucceeded &&
    rollbackVerified.transition.state.failure.storageState === "previous-verified",
  "H verified rollback must preserve all D3 safety facts."
);

const unknownStorage = bridge(
  saving(),
  Object.freeze({
    status: "failed" as const,
    stage: "write" as const,
    writeAttempted: true,
    rollbackAttempted: true,
    rollbackSucceeded: false,
    storageState: "unknown" as const,
    rollbackStage: "write" as const
  })
);
check(
  unknownStorage.transition.accepted &&
    unknownStorage.transition.state.status === "failed-unsafe" &&
    unknownStorage.transition.state.failure.storageState === "unknown" &&
    unknownStorage.refresh === "none",
  "I unknown storage state must remain failed-unsafe and block refresh."
);

const mismatchedRevision = bridge(saving(), savedResult, 2);
check(
  !mismatchedRevision.transition.accepted &&
    mismatchedRevision.transition.reason === "no-matching-save" &&
    mismatchedRevision.refresh === "none",
  "J mismatched save revision must be rejected and cannot refresh."
);

const invalidSuccess = bridge(
  saving(),
  Object.freeze({
    ...savedResult,
    nextUpdatedAt: BASE
  })
);
check(
  !invalidSuccess.transition.accepted &&
    invalidSuccess.transition.reason === "invalid-save-result" &&
    invalidSuccess.refresh === "none",
  "K invalid saved timestamps must be rejected and cannot refresh."
);

const cleanState = createWriterPackageWorkshopAutosaveState({
  editable: true,
  baseUpdatedAt: BASE
});
const nonSaving = bridge(cleanState, savedResult);
check(
  !nonSaving.transition.accepted &&
    nonSaving.transition.reason === "no-matching-save" &&
    nonSaving.transition.state === cleanState &&
    nonSaving.refresh === "none",
  "L result outside saving must not change state or permit refresh."
);

const failedInput = Object.freeze({
  status: "failed" as const,
  stage: "read-back" as const,
  writeAttempted: true,
  rollbackAttempted: false,
  rollbackSucceeded: false,
  storageState: "previous-verified" as const
});
const beforeFailure = JSON.stringify(failedInput);
const failureApplication = bridge(saving(), failedInput);
check(
  JSON.stringify(failedInput) === beforeFailure &&
    failureApplication.transition.accepted &&
    failureApplication.transition.state.status === "failed-safe" &&
    failureApplication.transition.state.failure !== failedInput &&
    Object.isFrozen(failureApplication.transition.state.failure),
  "M bridge must not mutate persistence input and D3 must own frozen failure facts."
);

const deterministicState = saving();
const deterministicA = bridge(deterministicState, savedResult);
const deterministicB = bridge(deterministicState, savedResult);
check(
  JSON.stringify(deterministicA) === JSON.stringify(deterministicB) &&
    deterministicA !== deterministicB &&
    deterministicA.transition !== deterministicB.transition,
  "N equivalent inputs must produce equivalent detached applications."
);

const publicOutput = JSON.stringify([
  saved,
  unchanged,
  conflict,
  blocked,
  failedBeforeWrite,
  rollbackVerified,
  unknownStorage
]);
check(
  !publicOutput.includes(SYNTHETIC_PACKAGE_ID) &&
    !publicOutput.includes("Synthetic title") &&
    !publicOutput.includes("Synthetic spark") &&
    !publicOutput.includes("Synthetic workshop") &&
    !publicOutput.includes("Synthetic final") &&
    !publicOutput.includes('"package":'),
  "O bridge output must not copy Package identity, object, or author content."
);

check(
  !("package" in saved) &&
    !("package" in unchanged) &&
    !("result" in saved) &&
    !("result" in unchanged),
  "P bridge must not return the original persistence result or Package."
);

check(
  Object.isFrozen(saved) &&
    Object.isFrozen(saved.transition) &&
    Object.isFrozen(saved.transition.state) &&
    Object.isFrozen(blocked) &&
    Object.isFrozen(blocked.transition),
  "Q application, transition, state, and failure outputs must be frozen."
);

const allBlockedReasons: readonly WriterPackageWorkshopPersistenceResult[] = [
  Object.freeze({ status: "blocked" as const, reason: "invalid-storage-key" as const }),
  Object.freeze({ status: "blocked" as const, reason: "malformed-json" as const }),
  Object.freeze({ status: "blocked" as const, reason: "duplicate-package-id" as const }),
  Object.freeze({ status: "blocked" as const, reason: "package-deleted" as const })
];
check(
  allBlockedReasons.every((result) => {
    const application = bridge(saving(), result);
    return (
      application.transition.accepted &&
      application.transition.state.status === "failed-safe" &&
      application.blockedReason ===
        (result.status === "blocked" ? result.reason : undefined)
    );
  }),
  "R stable blocked reasons must survive without becoming executable commands."
);

const rejectedBlocked = bridge(
  cleanState,
  Object.freeze({
    status: "blocked" as const,
    reason: "package-storage-missing" as const
  })
);
check(
  !rejectedBlocked.transition.accepted &&
    rejectedBlocked.transition.reason === "no-matching-save" &&
    rejectedBlocked.blockedReason === undefined,
  "S rejected blocked result must not expose source metadata as accepted UI state."
);

console.log(
  `WriterPackage workshop autosave bridge checks: ${passed}/${passed} passed.`
);
