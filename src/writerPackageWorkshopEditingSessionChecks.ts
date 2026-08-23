import type { WriterPackage } from "./types";
import {
  createWriterPackageWorkshopEditingSession,
  type WriterPackageWorkshopEditingSession,
  type WriterPackageWorkshopEditingSessionDependencies,
  type WriterPackageWorkshopSessionPersistenceInput
} from "./writerPackageWorkshopEditingSession";
import type { WriterPackageWorkshopPersistenceResult } from "./writerPackageWorkshopPersistence";

const BASE = "2026-01-02T08:00:00.000Z";
const NEXT = "2026-01-03T09:10:11.123Z";
const PACKAGE_ID = "synthetic-session-package";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function syntheticPackage(
  overrides: Partial<WriterPackage> = {}
): Readonly<WriterPackage> {
  return Object.freeze({
    id: PACKAGE_ID,
    title: "Synthetic session title",
    sparkText: "Synthetic session spark",
    notes: [],
    workshopText: "Synthetic initial workshop",
    finalText: "Synthetic session final",
    createdAt: BASE,
    updatedAt: BASE,
    packageVersion: 1 as const,
    ...overrides
  });
}

type Counters = {
  ownership: number;
  inspection: number;
  persistence: number;
  now: number;
  release: number;
  lastPersistenceInput?: WriterPackageWorkshopSessionPersistenceInput;
};

function dependencies(
  overrides: Partial<WriterPackageWorkshopEditingSessionDependencies> = {}
): Readonly<{
  dependencies: WriterPackageWorkshopEditingSessionDependencies;
  counters: Counters;
}> {
  const counters: Counters = {
    ownership: 0,
    inspection: 0,
    persistence: 0,
    now: 0,
    release: 0
  };
  const defaults: WriterPackageWorkshopEditingSessionDependencies = {
    hasWriteOwnership() {
      counters.ownership += 1;
      return true;
    },
    releaseWriteOwnership() {
      counters.release += 1;
    },
    inspectEditablePackage() {
      counters.inspection += 1;
      return Object.freeze({
        status: "editable" as const,
        package: syntheticPackage()
      });
    },
    now() {
      counters.now += 1;
      return NEXT;
    },
    persistWorkshopEdit(input) {
      counters.persistence += 1;
      counters.lastPersistenceInput = input;
      return Object.freeze({
        status: "saved" as const,
        package: syntheticPackage({
          workshopText: input.workshopText,
          updatedAt: NEXT
        }),
        previousUpdatedAt: input.expectedUpdatedAt,
        nextUpdatedAt: NEXT
      });
    }
  };
  return Object.freeze({
    dependencies: Object.freeze({ ...defaults, ...overrides }),
    counters
  });
}

function createSession(
  injected: WriterPackageWorkshopEditingSessionDependencies
): WriterPackageWorkshopEditingSession {
  return createWriterPackageWorkshopEditingSession({
    packageId: PACKAGE_ID,
    expectedUpdatedAt: BASE,
    dependencies: injected
  });
}

const openedSetup = dependencies();
const opened = createSession(openedSetup.dependencies);
const openedView = opened.getViewModel();
check(
  openedView.status === "editable" &&
    openedView.workshopText === "Synthetic initial workshop" &&
    openedView.autosaveState.status === "clean" &&
    !openedView.canSave &&
    openedView.writeOwnershipActive &&
    openedSetup.counters.ownership === 1 &&
    openedSetup.counters.inspection === 1 &&
    openedSetup.counters.persistence === 0 &&
    openedSetup.counters.now === 0 &&
    openedSetup.counters.release === 0,
  "A open must inspect once, remain write-free, and create a clean private draft."
);

const unavailableSetup = dependencies({
  hasWriteOwnership() {
    unavailableSetup.counters.ownership += 1;
    return false;
  }
});
const unavailable = createSession(unavailableSetup.dependencies);
const unavailableView = unavailable.getViewModel();
check(
  unavailableView.status === "read-only" &&
    unavailableView.reason === "write-ownership-unavailable" &&
    unavailableSetup.counters.inspection === 0 &&
    unavailableSetup.counters.persistence === 0,
  "B missing ownership must fail read-only before inspection or persistence."
);

const blockedSetup = dependencies({
  inspectEditablePackage() {
    blockedSetup.counters.inspection += 1;
    return Object.freeze({
      status: "blocked" as const,
      reason: "package-not-found" as const
    });
  }
});
const blockedOpen = createSession(blockedSetup.dependencies).getViewModel();
check(
  blockedOpen.status === "read-only" &&
    blockedOpen.reason === "package-not-found" &&
    blockedSetup.counters.release === 1 &&
    blockedSetup.counters.persistence === 0,
  "C blocked inspection must release ownership and remain write-free."
);

const throwingInspectionSetup = dependencies({
  inspectEditablePackage() {
    throwingInspectionSetup.counters.inspection += 1;
    throw new Error("synthetic inspection failure");
  }
});
const throwingInspection = createSession(
  throwingInspectionSetup.dependencies
).getViewModel();
check(
  throwingInspection.status === "read-only" &&
    throwingInspection.reason === "inspection-failed" &&
    throwingInspectionSetup.counters.release === 1,
  "D inspection exception must fail read-only and release ownership."
);

const invalidInputs = [
  syntheticPackage({ packageVersion: 2 as 1 }),
  syntheticPackage({ id: "different-id" }),
  syntheticPackage({ deletedAt: NEXT }),
  syntheticPackage({ updatedAt: NEXT })
];
const invalidReasons = [
  "invalid-package",
  "package-not-found",
  "package-deleted",
  "stale-revision"
] as const;
check(
  invalidInputs.every((writerPackage, index) => {
    const setup = dependencies({
      inspectEditablePackage() {
        return Object.freeze({ status: "editable" as const, package: writerPackage });
      }
    });
    const view = createSession(setup.dependencies).getViewModel();
    return (
      view.status === "read-only" &&
      view.reason === invalidReasons[index] &&
      setup.counters.persistence === 0 &&
      setup.counters.release === 1
    );
  }),
  "E invalid, mismatched, deleted, and stale inspected Packages must stay read-only."
);

const editSetup = dependencies();
const editing = createSession(editSetup.dependencies);
const editResult = editing.editWorkshopText("Synthetic edited workshop");
check(
  editResult.accepted &&
    editResult.view.status === "editable" &&
    editResult.view.workshopText === "Synthetic edited workshop" &&
    editResult.view.autosaveState.status === "dirty" &&
    editResult.view.canSave &&
    editSetup.counters.persistence === 0 &&
    editSetup.counters.now === 0,
  "F edit must update only the private draft and D3 state without effects."
);

const savedAction = editing.requestAutosave();
check(
  savedAction.accepted &&
    savedAction.view.status === "editable" &&
    savedAction.view.autosaveState.status === "saved" &&
    savedAction.view.refresh === "saved" &&
    savedAction.view.workshopText === "Synthetic edited workshop" &&
    editSetup.counters.persistence === 1 &&
    editSetup.counters.now === 1 &&
    editSetup.counters.lastPersistenceInput?.packageId === PACKAGE_ID &&
    editSetup.counters.lastPersistenceInput.expectedUpdatedAt === BASE &&
    editSetup.counters.lastPersistenceInput.workshopText ===
      "Synthetic edited workshop" &&
    editSetup.counters.lastPersistenceInput.now === NEXT,
  "G one accepted autosave must call time and persistence exactly once with captured input."
);

const secondSave = editing.requestAutosave();
check(
  !secondSave.accepted &&
    secondSave.reason === "not-dirty" &&
    editSetup.counters.persistence === 1 &&
    editSetup.counters.now === 1,
  "H save without a new edit must not call persistence again."
);

const unchangedSetup = dependencies({
  persistWorkshopEdit(input) {
    unchangedSetup.counters.persistence += 1;
    return Object.freeze({
      status: "unchanged" as const,
      package: syntheticPackage({ workshopText: input.workshopText })
    });
  }
});
const unchangedSession = createSession(unchangedSetup.dependencies);
unchangedSession.editWorkshopText("Synthetic unchanged draft");
const unchanged = unchangedSession.requestAutosave();
check(
  unchanged.accepted &&
    unchanged.view.status === "editable" &&
    unchanged.view.autosaveState.status === "saved" &&
    unchanged.view.refresh === "unchanged" &&
    unchangedSetup.counters.persistence === 1,
  "I unchanged persistence must become saved and permit current-data refresh."
);

let reentrantSession: WriterPackageWorkshopEditingSession;
const reentrantSetup = dependencies({
  persistWorkshopEdit(input) {
    reentrantSetup.counters.persistence += 1;
    reentrantSession.editWorkshopText("Synthetic newer workshop");
    return Object.freeze({
      status: "saved" as const,
      package: syntheticPackage({
        workshopText: input.workshopText,
        updatedAt: NEXT
      }),
      previousUpdatedAt: BASE,
      nextUpdatedAt: NEXT
    });
  }
});
reentrantSession = createSession(reentrantSetup.dependencies);
reentrantSession.editWorkshopText("Synthetic captured workshop");
const reentrantSave = reentrantSession.requestAutosave();
check(
  reentrantSave.accepted &&
    reentrantSave.view.status === "editable" &&
    reentrantSave.view.autosaveState.status === "dirty" &&
    reentrantSave.view.autosaveState.localRevision === 2 &&
    reentrantSave.view.workshopText === "Synthetic newer workshop" &&
    reentrantSave.view.refresh === "saved" &&
    reentrantSetup.counters.persistence === 1,
  "J edit during persistence must leave the newer private draft dirty after old success."
);

const conflictSetup = dependencies({
  persistWorkshopEdit() {
    conflictSetup.counters.persistence += 1;
    return Object.freeze({
      status: "conflict" as const,
      expectedUpdatedAt: BASE,
      currentUpdatedAt: NEXT
    });
  }
});
const conflictSession = createSession(conflictSetup.dependencies);
conflictSession.editWorkshopText("Synthetic conflict workshop");
const conflict = conflictSession.requestAutosave();
const conflictRetry = conflictSession.retryAutosave();
check(
  conflict.view.status === "editable" &&
    conflict.view.autosaveState.status === "conflict" &&
    !conflict.view.canRetry &&
    !conflictRetry.accepted &&
    conflictRetry.reason === "retry-not-available" &&
    conflictSetup.counters.persistence === 1,
  "K conflict must stop retry and never auto-overwrite."
);

const blockedSaveSetup = dependencies({
  persistWorkshopEdit() {
    blockedSaveSetup.counters.persistence += 1;
    return Object.freeze({
      status: "blocked" as const,
      reason: "package-storage-missing" as const
    });
  }
});
const blockedSaveSession = createSession(blockedSaveSetup.dependencies);
blockedSaveSession.editWorkshopText("Synthetic blocked workshop");
const blockedSave = blockedSaveSession.requestAutosave();
check(
  blockedSave.view.status === "editable" &&
    blockedSave.view.autosaveState.status === "failed-safe" &&
    blockedSave.view.blockedReason === "package-storage-missing" &&
    blockedSave.view.canRetry &&
    blockedSaveSetup.counters.persistence === 1,
  "L D2b blocked result must retain the draft, stable reason, and explicit retry."
);

let safeAttempt = 0;
const safeFailureSetup = dependencies({
  persistWorkshopEdit(input): WriterPackageWorkshopPersistenceResult {
    safeFailureSetup.counters.persistence += 1;
    safeAttempt += 1;
    return safeAttempt === 1
      ? Object.freeze({
          status: "failed" as const,
          stage: "current-read" as const,
          writeAttempted: false,
          rollbackAttempted: false,
          rollbackSucceeded: false,
          storageState: "not-written" as const
        })
      : Object.freeze({
          status: "saved" as const,
          package: syntheticPackage({
            workshopText: input.workshopText,
            updatedAt: NEXT
          }),
          previousUpdatedAt: BASE,
          nextUpdatedAt: NEXT
        });
  }
});
const safeFailureSession = createSession(safeFailureSetup.dependencies);
safeFailureSession.editWorkshopText("Synthetic retry workshop");
const safeFailure = safeFailureSession.requestAutosave();
const safeRetry = safeFailureSession.retryAutosave();
check(
  safeFailure.view.status === "editable" &&
    safeFailure.view.autosaveState.status === "failed-safe" &&
    safeFailure.view.canRetry &&
    safeRetry.accepted &&
    safeRetry.view.status === "editable" &&
    safeRetry.view.autosaveState.status === "saved" &&
    safeFailureSetup.counters.persistence === 2,
  "M safe failure must retain the draft and support one explicit retry."
);

const unsafeSetup = dependencies({
  persistWorkshopEdit() {
    unsafeSetup.counters.persistence += 1;
    return Object.freeze({
      status: "failed" as const,
      stage: "verify" as const,
      writeAttempted: true,
      rollbackAttempted: true,
      rollbackSucceeded: false,
      storageState: "unknown" as const,
      rollbackStage: "verify" as const
    });
  }
});
const unsafeSession = createSession(unsafeSetup.dependencies);
unsafeSession.editWorkshopText("Synthetic unsafe workshop");
const unsafe = unsafeSession.requestAutosave();
const unsafeRetry = unsafeSession.retryAutosave();
check(
  unsafe.view.status === "editable" &&
    unsafe.view.autosaveState.status === "failed-unsafe" &&
    !unsafe.view.canRetry &&
    !unsafeRetry.accepted &&
    unsafeSetup.counters.persistence === 1,
  "N unsafe failure must preserve the draft and block retry."
);

let ownershipCheck = 0;
const lostOwnershipSetup = dependencies({
  hasWriteOwnership() {
    lostOwnershipSetup.counters.ownership += 1;
    ownershipCheck += 1;
    return ownershipCheck === 1;
  }
});
const lostOwnershipSession = createSession(lostOwnershipSetup.dependencies);
lostOwnershipSession.editWorkshopText("Synthetic ownership draft");
const lostOwnership = lostOwnershipSession.requestAutosave();
check(
  lostOwnership.view.status === "editable" &&
    lostOwnership.view.autosaveState.status === "failed-safe" &&
    lostOwnership.view.issue === "write-ownership-lost" &&
    !lostOwnership.view.writeOwnershipActive &&
    lostOwnership.view.workshopText === "Synthetic ownership draft" &&
    lostOwnershipSetup.counters.now === 0 &&
    lostOwnershipSetup.counters.persistence === 0,
  "O lost ownership must block before time or persistence and retain the draft."
);

const timeFailureSetup = dependencies({
  now() {
    timeFailureSetup.counters.now += 1;
    throw new Error("synthetic time failure");
  }
});
const timeFailureSession = createSession(timeFailureSetup.dependencies);
timeFailureSession.editWorkshopText("Synthetic time draft");
const timeFailure = timeFailureSession.requestAutosave();
check(
  timeFailure.view.status === "editable" &&
    timeFailure.view.autosaveState.status === "failed-safe" &&
    timeFailure.view.issue === "time-unavailable" &&
    timeFailure.view.canRetry &&
    timeFailureSetup.counters.persistence === 0,
  "P time failure must be safe, retryable, and pre-persistence."
);

const thrownPersistenceSetup = dependencies({
  persistWorkshopEdit() {
    thrownPersistenceSetup.counters.persistence += 1;
    throw new Error("synthetic persistence escape");
  }
});
const thrownPersistenceSession = createSession(thrownPersistenceSetup.dependencies);
thrownPersistenceSession.editWorkshopText("Synthetic thrown persistence draft");
const thrownPersistence = thrownPersistenceSession.requestAutosave();
check(
  thrownPersistence.view.status === "editable" &&
    thrownPersistence.view.autosaveState.status === "failed-unsafe" &&
    thrownPersistence.view.issue === "persistence-threw" &&
    !thrownPersistence.view.canRetry &&
    thrownPersistenceSetup.counters.persistence === 1,
  "Q escaped persistence exception must fail unsafe and block retry."
);

const invalidResultSetup = dependencies({
  persistWorkshopEdit(input) {
    invalidResultSetup.counters.persistence += 1;
    return Object.freeze({
      status: "saved" as const,
      package: syntheticPackage({
        id: "different-id",
        workshopText: input.workshopText,
        updatedAt: NEXT
      }),
      previousUpdatedAt: BASE,
      nextUpdatedAt: NEXT
    });
  }
});
const invalidResultSession = createSession(invalidResultSetup.dependencies);
invalidResultSession.editWorkshopText("Synthetic invalid result draft");
const invalidResult = invalidResultSession.requestAutosave();
check(
  invalidResult.view.status === "editable" &&
    invalidResult.view.autosaveState.status === "failed-unsafe" &&
    invalidResult.view.issue === "invalid-persistence-result" &&
    invalidResult.view.refresh === "none",
  "R invalid saved Package must never refresh and must fail unsafe."
);

check(
  (["package-switch", "layer-switch", "library-return", "reset", "unload"] as const).every(
    (action) => {
      const setup = dependencies();
      const session = createSession(setup.dependencies);
      session.editWorkshopText("Synthetic exit draft");
      const rejected = session.requestExit(action);
      return (
        !rejected.decision.allowed &&
        rejected.decision.requiresConfirmation &&
        rejected.view.status === "editable" &&
        rejected.view.workshopText === "Synthetic exit draft" &&
        setup.counters.release === 0
      );
    }
  ),
  "S all five unconfirmed exit actions must preserve draft, session, and ownership."
);

const exitSetup = dependencies();
const exitSession = createSession(exitSetup.dependencies);
exitSession.editWorkshopText("Synthetic exit draft");
const confirmedExit = exitSession.requestExit("library-return", true);
check(
  confirmedExit.decision.allowed &&
    confirmedExit.view.status === "closed" &&
    exitSetup.counters.release === 1 &&
    exitSession.getViewModel().status === "closed",
  "T confirmed terminal exit must close the session and release ownership once."
);

const closedEdit = exitSession.editWorkshopText("Synthetic after close");
const closedSave = exitSession.requestAutosave();
check(
  !closedEdit.accepted &&
    closedEdit.reason === "closed" &&
    !closedSave.accepted &&
    closedSave.reason === "closed" &&
    exitSetup.counters.release === 1 &&
    exitSetup.counters.persistence === 0,
  "U closed session must reject later edits/saves and release only once."
);

const layerSetup = dependencies();
const layerSession = createSession(layerSetup.dependencies);
const layerExit = layerSession.requestExit("layer-switch");
check(
  layerExit.decision.allowed &&
    layerExit.view.status === "editable" &&
    layerSetup.counters.release === 0,
  "V clean layer switch must not close the editing session or release ownership."
);

const autosaveStateText =
  savedAction.view.status === "editable"
    ? JSON.stringify(savedAction.view.autosaveState)
    : "";
check(
  !autosaveStateText.includes(PACKAGE_ID) &&
    !autosaveStateText.includes("Synthetic edited workshop") &&
    !autosaveStateText.includes("workshopText") &&
    Object.isFrozen(opened) &&
    Object.isFrozen(openedView) &&
    Object.isFrozen(savedAction) &&
    Object.isFrozen(savedAction.view),
  "W public autosave state must stay text-free and controller outputs must be frozen."
);

console.log(
  `WriterPackage workshop editing session checks: ${passed}/${passed} passed.`
);
