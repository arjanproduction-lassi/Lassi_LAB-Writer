import {
  applyWriterPackageWorkshopAutosaveEvent,
  createWriterPackageWorkshopAutosaveState,
  inspectWriterPackageWorkshopExit,
  writerPackageWorkshopHasUnsavedDraft,
  type WriterPackageWorkshopAutosaveFailureFacts,
  type WriterPackageWorkshopAutosaveState,
  type WriterPackageWorkshopAutosaveTransitionResult,
  type WriterPackageWorkshopExitAction
} from "./writerPackageWorkshopAutosaveState";

const BASE = "2026-01-02T08:00:00.000Z";
const NEXT = "2026-01-03T09:10:11.123Z";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function editable(): WriterPackageWorkshopAutosaveState {
  return createWriterPackageWorkshopAutosaveState({
    editable: true,
    baseUpdatedAt: BASE
  });
}

function apply(
  state: WriterPackageWorkshopAutosaveState,
  event: Parameters<typeof applyWriterPackageWorkshopAutosaveEvent>[1]
): WriterPackageWorkshopAutosaveTransitionResult {
  return applyWriterPackageWorkshopAutosaveEvent(state, event);
}

function accepted(result: WriterPackageWorkshopAutosaveTransitionResult) {
  if (!result.accepted) {
    throw new Error(`Expected accepted transition, received ${result.reason}.`);
  }
  return result;
}

function rejected(
  result: WriterPackageWorkshopAutosaveTransitionResult,
  reason: Extract<
    WriterPackageWorkshopAutosaveTransitionResult,
    { accepted: false }
  >["reason"]
) {
  return !result.accepted && result.reason === reason;
}

function dirty(
  state: WriterPackageWorkshopAutosaveState = editable()
): Extract<WriterPackageWorkshopAutosaveState, { status: "dirty" }> {
  const result = accepted(apply(state, { type: "edited" }));
  if (result.state.status !== "dirty") {
    throw new Error(`Expected dirty, received ${result.state.status}.`);
  }
  return result.state;
}

function saving(
  state: Extract<WriterPackageWorkshopAutosaveState, { status: "dirty" }> = dirty()
): Extract<WriterPackageWorkshopAutosaveState, { status: "saving" }> {
  const result = accepted(apply(state, { type: "save-requested" }));
  if (result.state.status !== "saving") {
    throw new Error(`Expected saving, received ${result.state.status}.`);
  }
  return result.state;
}

function safeFailure(
  overrides: Partial<WriterPackageWorkshopAutosaveFailureFacts> = {}
): WriterPackageWorkshopAutosaveFailureFacts {
  return {
    stage: "current-read",
    writeAttempted: false,
    rollbackAttempted: false,
    rollbackSucceeded: false,
    storageState: "not-written",
    ...overrides
  };
}

const readOnly = createWriterPackageWorkshopAutosaveState({ editable: false });
check(
  readOnly.status === "read-only" && Object.isFrozen(readOnly),
  "A non-editable input must create a frozen read-only state."
);

const invalidBase = createWriterPackageWorkshopAutosaveState({
  editable: true,
  baseUpdatedAt: "invalid-date"
});
check(
  invalidBase.status === "read-only",
  "B invalid base revision must fail closed as read-only."
);

const clean = editable();
check(
  clean.status === "clean" &&
    clean.localRevision === 0 &&
    clean.baseUpdatedAt === BASE &&
    Object.isFrozen(clean),
  "C editable input must create a frozen clean revision zero state."
);

const firstDirty = dirty(clean);
check(
  firstDirty.localRevision === 1 &&
    firstDirty.baseUpdatedAt === BASE &&
    writerPackageWorkshopHasUnsavedDraft(firstDirty),
  "D one edit must become dirty and increment the local revision."
);

const secondDirty = dirty(firstDirty);
check(
  secondDirty.localRevision === 2 && firstDirty.localRevision === 1,
  "E repeated edits must increase revision monotonically without mutating prior state."
);

const saveStart = accepted(apply(secondDirty, { type: "save-requested" }));
check(
  saveStart.state.status === "saving" &&
    saveStart.state.saveRevision === 2 &&
    saveStart.state.saveBaseUpdatedAt === BASE &&
    saveStart.command?.type === "persist-workshop" &&
    saveStart.command.localRevision === 2 &&
    saveStart.command.expectedUpdatedAt === BASE &&
    Object.isFrozen(saveStart.command),
  "F an accepted save must capture revision and base without carrying draft text."
);

check(
  rejected(apply(saveStart.state, { type: "save-requested" }), "save-in-progress"),
  "G a second save request must not create a concurrent command."
);

const editedDuringSave = accepted(
  apply(saveStart.state, { type: "edited" })
).state;
check(
  editedDuringSave.status === "saving" &&
    editedDuringSave.localRevision === 3 &&
    editedDuringSave.saveRevision === 2,
  "H editing during save must preserve the active captured revision and advance the draft."
);

const lateSuccess = accepted(
  apply(editedDuringSave, {
    type: "save-succeeded",
    saveRevision: 2,
    previousUpdatedAt: BASE,
    nextUpdatedAt: NEXT
  })
).state;
check(
  lateSuccess.status === "dirty" &&
    lateSuccess.localRevision === 3 &&
    lateSuccess.baseUpdatedAt === NEXT,
  "I old success must advance stored base but leave a newer draft dirty."
);

const directSuccess = accepted(
  apply(saving(), {
    type: "save-succeeded",
    saveRevision: 1,
    previousUpdatedAt: BASE,
    nextUpdatedAt: NEXT
  })
).state;
check(
  directSuccess.status === "saved" &&
    directSuccess.localRevision === 1 &&
    directSuccess.baseUpdatedAt === NEXT &&
    !writerPackageWorkshopHasUnsavedDraft(directSuccess),
  "J matching verified success must become saved."
);

const dirtyAfterSaved = dirty(directSuccess);
check(
  dirtyAfterSaved.localRevision === 2 &&
    dirtyAfterSaved.baseUpdatedAt === NEXT,
  "K editing a saved state must become dirty from the verified next base."
);

const unchanged = accepted(
  apply(saving(), {
    type: "save-unchanged",
    saveRevision: 1,
    currentUpdatedAt: BASE
  })
).state;
check(
  unchanged.status === "saved" && unchanged.baseUpdatedAt === BASE,
  "L unchanged persistence must become saved without changing the base revision."
);

const unchangedAfterNewerEdit = accepted(
  apply(editedDuringSave, {
    type: "save-unchanged",
    saveRevision: 2,
    currentUpdatedAt: BASE
  })
).state;
check(
  unchangedAfterNewerEdit.status === "dirty" &&
    unchangedAfterNewerEdit.localRevision === 3 &&
    unchangedAfterNewerEdit.baseUpdatedAt === BASE,
  "M unchanged old save must not mark a newer local revision as saved."
);

const conflict = accepted(
  apply(saving(), {
    type: "save-conflicted",
    saveRevision: 1,
    currentUpdatedAt: NEXT
  })
).state;
check(
  conflict.status === "conflict" &&
    conflict.currentStoredUpdatedAt === NEXT &&
    writerPackageWorkshopHasUnsavedDraft(conflict),
  "N stale storage must become a conflict with the local draft retained."
);

const editedConflict = accepted(apply(conflict, { type: "edited" })).state;
check(
  editedConflict.status === "conflict" && editedConflict.localRevision === 2,
  "O editing during conflict must retain conflict and advance the local revision."
);
check(
  rejected(apply(conflict, { type: "save-requested" }), "not-dirty") &&
    rejected(apply(conflict, { type: "retry-requested" }), "retry-not-available"),
  "P conflict must never auto-overwrite or retry."
);

const failedSafe = accepted(
  apply(saving(), {
    type: "save-failed",
    saveRevision: 1,
    failure: safeFailure()
  })
).state;
if (failedSafe.status !== "failed-safe") {
  throw new Error(`Expected failed-safe, received ${failedSafe.status}.`);
}
check(
  failedSafe.failure.storageState === "not-written" &&
    writerPackageWorkshopHasUnsavedDraft(failedSafe),
  "Q a not-written failure must retain the draft as failed-safe."
);
check(
  rejected(apply(failedSafe, { type: "save-requested" }), "retry-required"),
  "R failed-safe must require an explicit retry rather than automatic saving."
);

const retry = accepted(apply(failedSafe, { type: "retry-requested" }));
check(
  retry.state.status === "saving" &&
    retry.command?.localRevision === 1 &&
    retry.command.expectedUpdatedAt === BASE,
  "S explicit retry must create exactly one fresh save command."
);

const editedFailure = accepted(apply(failedSafe, { type: "edited" })).state;
check(
  editedFailure.status === "failed-safe" &&
    editedFailure.localRevision === 2 &&
    JSON.stringify(editedFailure.failure) === JSON.stringify(failedSafe.failure) &&
    Object.isFrozen(editedFailure.failure),
  "T editing after safe failure must retain failure and require explicit retry."
);

const unsafeFacts = safeFailure({
  stage: "verify",
  writeAttempted: true,
  rollbackAttempted: true,
  storageState: "unknown"
});
const failedUnsafe = accepted(
  apply(saving(), {
    type: "save-failed",
    saveRevision: 1,
    failure: unsafeFacts
  })
).state;
check(
  failedUnsafe.status === "failed-unsafe" &&
    failedUnsafe.failure.storageState === "unknown" &&
    writerPackageWorkshopHasUnsavedDraft(failedUnsafe),
  "U unknown storage state must become failed-unsafe."
);
check(
  rejected(apply(failedUnsafe, { type: "retry-requested" }), "retry-not-available") &&
    rejected(apply(failedUnsafe, { type: "save-requested" }), "not-dirty"),
  "V failed-unsafe must block all retry paths."
);

const forgedSafe = apply(saving(), {
  type: "save-failed",
  saveRevision: 1,
  failure: safeFailure({
    stage: "verify",
    writeAttempted: true,
    rollbackAttempted: true,
    rollbackSucceeded: true,
    storageState: "unknown"
  })
});
check(
  rejected(forgedSafe, "invalid-save-result"),
  "W inconsistent rollback facts must not forge a safe state."
);

check(
  rejected(
    apply(saving(), {
      type: "save-succeeded",
      saveRevision: 2,
      previousUpdatedAt: BASE,
      nextUpdatedAt: NEXT
    }),
    "no-matching-save"
  ),
  "X a mismatched or late result must not change the active save."
);

check(
  rejected(
    apply(saving(), {
      type: "save-succeeded",
      saveRevision: 1,
      previousUpdatedAt: BASE,
      nextUpdatedAt: BASE
    }),
    "invalid-save-result"
  ) &&
    rejected(
      apply(saving(), {
        type: "save-succeeded",
        saveRevision: 1,
        previousUpdatedAt: "different-revision",
        nextUpdatedAt: NEXT
      }),
      "invalid-save-result"
    ),
  "Y success must carry the exact prior revision and a canonical strictly later next revision."
);

const exitActions: readonly WriterPackageWorkshopExitAction[] = [
  "package-switch",
  "layer-switch",
  "library-return",
  "reset",
  "unload"
];
check(
  exitActions.every((action) => {
    const decision = inspectWriterPackageWorkshopExit(dirty(), action);
    return (
      decision.action === action &&
      !decision.allowed &&
      decision.requiresConfirmation &&
      Object.isFrozen(decision)
    );
  }),
  "Z every exit path must require confirmation while a draft is unsaved."
);
check(
  [firstDirty, saving(), conflict, failedSafe, failedUnsafe].every((state) =>
    exitActions.every(
      (action) => inspectWriterPackageWorkshopExit(state, action).requiresConfirmation
    )
  ),
  "AA dirty, saving, conflict, and both failure states must preserve the warning."
);
check(
  [readOnly, clean, directSuccess].every((state) =>
    exitActions.every((action) => {
      const decision = inspectWriterPackageWorkshopExit(state, action);
      return decision.allowed && !decision.requiresConfirmation;
    })
  ),
  "AB read-only, clean, and saved states must allow ordinary exit."
);
check(
  exitActions.every((action) => {
    const decision = inspectWriterPackageWorkshopExit(failedUnsafe, action, true);
    return decision.allowed && !decision.requiresConfirmation;
  }),
  "AC explicit confirmation must be required before discarding even an unsafe failed draft."
);

const overflowState = Object.freeze({
  status: "dirty" as const,
  localRevision: Number.MAX_SAFE_INTEGER,
  baseUpdatedAt: BASE
});
check(
  rejected(apply(overflowState, { type: "edited" }), "revision-overflow"),
  "AD revision overflow must fail closed without reusing a revision."
);

const deterministicInput = saving(dirty(dirty()));
const deterministicEvent = {
  type: "save-succeeded" as const,
  saveRevision: 2,
  previousUpdatedAt: BASE,
  nextUpdatedAt: NEXT
};
const repeatA = accepted(apply(deterministicInput, deterministicEvent));
const repeatB = accepted(apply(deterministicInput, deterministicEvent));
check(
  JSON.stringify(repeatA) === JSON.stringify(repeatB) &&
    repeatA !== repeatB &&
    repeatA.state !== deterministicInput &&
    Object.isFrozen(repeatA) &&
    Object.isFrozen(repeatA.state),
  "AE equivalent transitions must be deterministic, frozen, and non-mutating."
);

const publicStateText = JSON.stringify([
  saveStart,
  conflict,
  failedSafe,
  failedUnsafe
]);
check(
  !publicStateText.includes("workshopText") &&
    !publicStateText.includes("packageId") &&
    !publicStateText.includes("title") &&
    !publicStateText.includes("draft"),
  "AF public state and commands must remain free of Package identity and author content."
);

console.log(
  `WriterPackage workshop autosave state checks: ${passed}/${passed} passed.`
);
