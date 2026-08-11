import type { Spark, WriterPackage } from "./types";
import {
  createLegacySparkRetirementMinimalUiCaptureController,
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason,
  type LegacySparkRetirementMinimalUiCaptureCommandResult,
  type LegacySparkRetirementMinimalUiCaptureController,
  type LegacySparkRetirementMinimalUiCaptureControllerDependencies,
  type LegacySparkRetirementMinimalUiCaptureViewModel
} from "./legacySparkRetirementMinimalUiCaptureController";
import {
  createLegacySparkRetirementLocalCaptureSession,
  type LegacySparkRetirementLocalCaptureSession,
  type LegacySparkRetirementLocalCaptureSessionDependencies
} from "./legacySparkRetirementLocalCaptureSession";
import {
  captureLegacySparkRetirementLocalSnapshotFromRaw,
  type LegacySparkRetirementLocalSnapshotResult,
  type LegacySparkRetirementRawStorageValue
} from "./legacySparkRetirementLocalSnapshot";
import { legacySparkRetirementLocalCaptureSessionCheckCount } from "./legacySparkRetirementLocalCaptureSessionChecks";

const CREATED_AT = "2026-07-30T18:00:00.000Z";
const PRIVATE_SPARK_ID = "synthetic-private-c2b2a-spark-id";
const PRIVATE_PACKAGE_ID = "synthetic-private-c2b2a-package-id";
const PRIVATE_NOTE_ID = "synthetic-private-c2b2a-note-id";
const PRIVATE_SPARK_TEXT = "Synthetic private c2b2a Spark text";
const PRIVATE_PACKAGE_TEXT = "Synthetic private c2b2a Package text";
const PRIVATE_NOTE_TEXT = "Synthetic private c2b2a note text";
const PRIVATE_DRAFT_TEXT = "Synthetic private c2b2a draft text";
const PRIVATE_EXCEPTION_TEXT = "Synthetic private c2b2a exception text";

const missing = (): LegacySparkRetirementRawStorageValue => Object.freeze({ status: "missing" });
const present = (value: unknown): LegacySparkRetirementRawStorageValue => Object.freeze({
  status: "present" as const,
  raw: typeof value === "string" ? value : JSON.stringify(value)
});

function spark(createdAt = CREATED_AT): Spark {
  return {
    id: PRIVATE_SPARK_ID,
    text: PRIVATE_SPARK_TEXT,
    createdAt,
    updatedAt: createdAt,
    temperature: "spark",
    tags: ["synthetic"],
    schemaVersion: 1
  };
}

function writerPackage(createdAt = CREATED_AT): WriterPackage {
  return {
    id: PRIVATE_PACKAGE_ID,
    title: PRIVATE_PACKAGE_TEXT,
    sparkText: PRIVATE_SPARK_TEXT,
    notes: [{
      id: PRIVATE_NOTE_ID,
      text: PRIVATE_NOTE_TEXT,
      createdAt,
      updatedAt: createdAt
    }],
    workshopText: PRIVATE_PACKAGE_TEXT,
    finalText: PRIVATE_PACKAGE_TEXT,
    createdAt,
    updatedAt: createdAt,
    packageVersion: 1
  };
}

function capturedSnapshot(createdAt = CREATED_AT): Extract<
  LegacySparkRetirementLocalSnapshotResult,
  { status: "snapshot-captured" }
> {
  const result = captureLegacySparkRetirementLocalSnapshotFromRaw({
    createdAt,
    sparks: present([spark(createdAt)]),
    packages: present([writerPackage(createdAt)]),
    draft: present({ text: "", updatedAt: createdAt, schemaVersion: 1 })
  });
  if (result.status !== "snapshot-captured") {
    throw new Error("Expected synthetic snapshot-captured result.");
  }
  return result;
}

function incompleteSnapshot(): LegacySparkRetirementLocalSnapshotResult {
  return Object.freeze({
    status: "incomplete" as const,
    reasons: Object.freeze(["DRAFT_PRESENT" as const])
  });
}

function invalidSnapshot(): LegacySparkRetirementLocalSnapshotResult {
  return Object.freeze({
    status: "invalid" as const,
    reasons: Object.freeze(["PACKAGE_STORAGE_INVALID" as const])
  });
}

type ControllerCalls = {
  sessions: number;
  prepares: number;
  releases: number;
  publicStates: number;
  timestamps: number;
  captures: number;
  createdAtInputs: string[];
};

function makeController(options: Readonly<{
  createdAt?: string;
  timestampThrows?: boolean;
  capture?: (input: Readonly<{ createdAt: string }>) => LegacySparkRetirementLocalSnapshotResult;
}> = {}): Readonly<{
  controller: LegacySparkRetirementMinimalUiCaptureController;
  calls: ControllerCalls;
  dependencies: LegacySparkRetirementMinimalUiCaptureControllerDependencies;
  createSession: () => LegacySparkRetirementLocalCaptureSession;
}> {
  const calls: ControllerCalls = {
    sessions: 0,
    prepares: 0,
    releases: 0,
    publicStates: 0,
    timestamps: 0,
    captures: 0,
    createdAtInputs: []
  };

  const createSession = (): LegacySparkRetirementLocalCaptureSession => {
    calls.sessions += 1;
    const sessionDependencies: LegacySparkRetirementLocalCaptureSessionDependencies = Object.freeze({
      createCanonicalTimestamp() {
        calls.timestamps += 1;
        if (options.timestampThrows) throw new Error(PRIVATE_EXCEPTION_TEXT);
        return options.createdAt ?? CREATED_AT;
      },
      captureLocalSnapshot(input) {
        calls.captures += 1;
        calls.createdAtInputs.push(input.createdAt);
        return options.capture ? options.capture(input) : capturedSnapshot(input.createdAt);
      }
    });
    const session = createLegacySparkRetirementLocalCaptureSession(sessionDependencies);
    return Object.freeze({
      prepareLocalSnapshot() {
        calls.prepares += 1;
        return session.prepareLocalSnapshot();
      },
      getPublicState() {
        calls.publicStates += 1;
        return session.getPublicState();
      },
      withCapturedSnapshotForInternalUse(operation) {
        return session.withCapturedSnapshotForInternalUse(operation);
      },
      release() {
        calls.releases += 1;
        session.release();
      }
    });
  };

  const dependencies: LegacySparkRetirementMinimalUiCaptureControllerDependencies = Object.freeze({
    createSession
  });
  return Object.freeze({
    controller: createLegacySparkRetirementMinimalUiCaptureController(dependencies),
    calls,
    dependencies,
    createSession
  });
}

function viewJson(viewModel: LegacySparkRetirementMinimalUiCaptureViewModel): string {
  return JSON.stringify(viewModel);
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

const created = makeController();
check(created.calls.prepares === 0, "A. creating controller does not prepare local snapshot.");
check(created.calls.timestamps === 0 && created.calls.captures === 0, "B. creating controller does not create timestamp or capture.");
created.controller.getViewModel();
check(created.calls.prepares === 0 && created.calls.timestamps === 0 && created.calls.captures === 0, "C. getViewModel is side-effect free.");
const initialView = created.controller.getViewModel();
check(initialView.status === "ready", "D. new controller maps idle session to ready.");
check(initialView.primaryActionLabel === "Pripraviť lokálnu zálohu", "E. primary label is the approved local backup label.");

const success = makeController();
const successResult = success.controller.prepareLocalBackup();
check(success.calls.prepares === 1 && success.calls.captures === 1, "F. first prepare delegates exactly once.");

let observedPreparing: LegacySparkRetirementMinimalUiCaptureViewModel | null = null;
let reentrantResult: LegacySparkRetirementMinimalUiCaptureCommandResult | null = null;
let reentrantController: LegacySparkRetirementMinimalUiCaptureController;
const reentrant = makeController({
  capture(input) {
    observedPreparing = reentrantController.getViewModel();
    reentrantResult = reentrantController.prepareLocalBackup();
    return capturedSnapshot(input.createdAt);
  }
});
reentrantController = reentrant.controller;
const reentrantOuter = reentrantController.prepareLocalBackup();
const observedPreparingView = observedPreparing as LegacySparkRetirementMinimalUiCaptureViewModel | null;
const observedReentrantResult = reentrantResult as LegacySparkRetirementMinimalUiCaptureCommandResult | null;
check(
  observedPreparingView !== null &&
    observedPreparingView.status === "preparing" &&
    observedPreparingView.primaryActionDisabled,
  "G. preparing view disables primary action."
);
check(
  observedReentrantResult !== null &&
    observedReentrantResult.status === "rejected" &&
    observedReentrantResult.reason === "UI_COMMAND_ALREADY_IN_PROGRESS" &&
    reentrant.calls.prepares === 1,
  "H. reentrant prepare starts no second command."
);
const doubleClickResult = reentrantController.prepareLocalBackup();
check(
  reentrantOuter.status === "handled" &&
    doubleClickResult.status === "rejected" &&
    reentrant.calls.captures === 1,
  "I. double-click path starts no second capture."
);

const successView = success.controller.getViewModel();
check(successResult.status === "handled" && successView.status === "snapshot-ready", "J. captured snapshot maps to snapshot-ready.");
const incomplete = makeController({ capture: () => incompleteSnapshot() });
incomplete.controller.prepareLocalBackup();
check(incomplete.controller.getViewModel().status === "incomplete", "K. incomplete capture maps to incomplete.");
const invalid = makeController({ capture: () => invalidSnapshot() });
invalid.controller.prepareLocalBackup();
check(invalid.controller.getViewModel().status === "invalid", "L. invalid capture maps to invalid.");

const mappedKeys = [
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("LOCAL_STORAGE_UNAVAILABLE"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("SPARK_STORAGE_READ_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("PACKAGE_STORAGE_READ_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("DRAFT_STORAGE_READ_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("INVALID_CREATED_AT"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("CREATED_AT_CREATION_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("CAPTURE_DEPENDENCY_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("DRAFT_PRESENT"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("SPARK_STORAGE_PARSE_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("SPARK_STORAGE_INVALID"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("DUPLICATE_SPARK_ID"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("PACKAGE_STORAGE_PARSE_FAILED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("PACKAGE_STORAGE_INVALID"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("DUPLICATE_PACKAGE_ID"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("CAPTURE_ALREADY_IN_PROGRESS"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("CAPTURE_ALREADY_ATTEMPTED"),
  legacySparkRetirementMinimalUiCaptureMessageKeyForReason("CAPTURE_SESSION_RELEASED")
];
check(
  mappedKeys.includes("local-storage-unavailable") &&
    mappedKeys.includes("spark-storage-invalid") &&
    mappedKeys.includes("package-storage-invalid") &&
    mappedKeys.includes("capture-session-released") &&
    !JSON.stringify(mappedKeys).includes(PRIVATE_EXCEPTION_TEXT),
  "M. reason mapping is static and text-free."
);

const successJson = viewJson(successView);
check(!("snapshot" in successView) && !successJson.includes("snapshot\":"), "N. view model exposes no raw snapshot.");
check(!successJson.includes("\"raw\"") && !successJson.includes(JSON.stringify([spark()])), "O. view model exposes no raw JSON.");
check(
  !successJson.includes(PRIVATE_SPARK_TEXT) &&
    !successJson.includes(PRIVATE_PACKAGE_TEXT) &&
    !successJson.includes(PRIVATE_NOTE_TEXT) &&
    !successJson.includes(PRIVATE_DRAFT_TEXT) &&
    !successJson.includes(PRIVATE_SPARK_ID) &&
    !successJson.includes(PRIVATE_PACKAGE_ID) &&
    !successJson.includes(PRIVATE_NOTE_ID),
  "P. view model exposes no author text or private IDs."
);
check(!/ArrayBuffer|Uint8Array|byteLength|bytes/i.test(successJson), "Q. view model exposes no bytes.");
check(!("session" in successView) && !("dependencies" in successView), "R. view model exposes no session object or dependency callback.");

const restart = makeController();
restart.controller.prepareLocalBackup();
const restartResult = restart.controller.startOver();
check(restart.calls.releases === 1, "S. startOver releases old session.");
check(restart.calls.sessions === 2, "T. startOver creates exactly one new session.");
check(restart.calls.prepares === 1 && restart.calls.captures === 1, "U. startOver does not capture.");
check(restartResult.status === "handled" && restart.controller.getViewModel().status === "ready", "V. startOver returns ready.");
restart.controller.prepareLocalBackup();
check(restart.calls.prepares === 2 && restart.calls.captures === 2, "W. new capture after startOver requires a new explicit prepare.");

const disposable = makeController();
const firstDispose = disposable.controller.dispose();
check(disposable.calls.releases === 1, "X. dispose releases active session.");
disposable.controller.dispose();
check(disposable.calls.releases === 1, "Y. dispose is idempotent.");
check(firstDispose.viewModel.status === "released" && disposable.controller.getViewModel().status === "released", "Z. disposed controller maps to released.");
const prepareAfterDispose = disposable.controller.prepareLocalBackup();
check(prepareAfterDispose.status === "rejected" && prepareAfterDispose.reason === "UI_CONTROLLER_RELEASED", "AA. prepare after dispose is rejected.");
const startOverAfterDispose = disposable.controller.startOver();
check(
  startOverAfterDispose.status === "rejected" &&
    startOverAfterDispose.reason === "UI_CONTROLLER_RELEASED" &&
    disposable.calls.sessions === 1 &&
    disposable.calls.captures === 0,
  "AB. startOver after dispose starts nothing."
);
check(Object.isFrozen(successResult) && Object.isFrozen(prepareAfterDispose), "AC. command results are frozen.");
check(Object.isFrozen(successView), "AD. view model is frozen.");
check(
  Object.isFrozen(successView.reasonCodes) &&
    Object.isFrozen(successView.counts) &&
    Object.isFrozen(successView.counts?.sparks) &&
    Object.isFrozen(successView.storageStatuses),
  "AE. nested reasons counts and status metadata are frozen."
);
const dependenciesBefore = created.dependencies.createSession;
created.controller.prepareLocalBackup();
check(Object.isFrozen(created.dependencies) && created.dependencies.createSession === dependenciesBefore, "AF. dependency object is not mutated.");

const controllerSource = `${createLegacySparkRetirementMinimalUiCaptureController.toString()} ${legacySparkRetirementMinimalUiCaptureMessageKeyForReason.toString()}`;
check(!/Date\.now/.test(controllerSource), "AG. controller does not use Date.now.");
check(!/new Date/.test(controllerSource), "AH. controller does not use new Date.");
check(!/window|localStorage|sessionStorage/.test(controllerSource), "AI. controller does not use browser storage globals.");
check(!/legacySparkRetirementBrowserLocalStorageCapture|BrowserLocalStorage/.test(controllerSource), "AJ. controller does not import production c2a wrapper.");
check(!/React|useEffect|jsx|tsx|App/.test(controllerSource), "AK. controller does not use React or App wiring.");
check(success.calls.timestamps === 1 && success.calls.createdAtInputs[0] === CREATED_AT, "AL. controller delegates timestamp only through explicit prepare.");
check(!/Drive|fetch|XMLHttpRequest|sendBeacon/.test(controllerSource), "AM. controller does not use Drive or network.");
check(!/crypto|subtle|digest|Blob|FileReader|createObjectURL|download/.test(controllerSource), "AN. controller does not use crypto Blob or download APIs.");
check(!/WriterDbV2Bytes|createWriterDb|writer-db-bytes-built|assembly-verified/.test(controllerSource), "AO. controller does not create Writer DB bytes.");
check(successView.status === "snapshot-ready" && successView.guideStatus === "drive-reading", "AP. snapshot-ready is not backup-verified.");
check(!successJson.includes("ready-to-create-tombstones") && !successJson.includes("R3"), "AQ. controller does not permit R3.");
check(legacySparkRetirementLocalCaptureSessionCheckCount === 45, "AR. c2b1 checks remain preserved.");

export const legacySparkRetirementMinimalUiCaptureControllerCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c2b2a minimal UI controller checks: ${passed}/${passed} passed.`);
