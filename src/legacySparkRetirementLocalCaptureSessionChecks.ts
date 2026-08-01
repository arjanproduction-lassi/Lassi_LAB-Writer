import type { Spark, WriterPackage } from "./types";
import {
  createLegacySparkRetirementLocalCaptureSession,
  type LegacySparkRetirementLocalCaptureCommandResult,
  type LegacySparkRetirementLocalCaptureSession,
  type LegacySparkRetirementLocalCaptureSessionDependencies
} from "./legacySparkRetirementLocalCaptureSession";
import {
  captureLegacySparkRetirementLocalSnapshotFromRaw,
  type LegacySparkRetirementLocalSnapshotResult,
  type LegacySparkRetirementRawStorageValue
} from "./legacySparkRetirementLocalSnapshot";

const CREATED_AT = "2026-07-30T16:00:00.000Z";
const SECOND_CREATED_AT = "2026-07-30T17:00:00.000Z";
const PRIVATE_SPARK_ID = "synthetic-private-c2b1-spark-id";
const PRIVATE_PACKAGE_ID = "synthetic-private-c2b1-package-id";
const PRIVATE_SPARK_TEXT = "Synthetic private c2b1 Spark text";
const PRIVATE_PACKAGE_TEXT = "Synthetic private c2b1 Package text";
const PRIVATE_EXCEPTION_TEXT = "Synthetic private thrown text";

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
    notes: [],
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

type Calls = {
  timestamps: number;
  captures: number;
  createdAtInputs: string[];
  frozenInputs: boolean[];
  writes: number;
};

function makeSession(options: Readonly<{
  createdAt?: string;
  timestampThrows?: boolean;
  capture?: (input: Readonly<{ createdAt: string }>) => LegacySparkRetirementLocalSnapshotResult;
}> = {}): Readonly<{
  session: LegacySparkRetirementLocalCaptureSession;
  calls: Calls;
  dependencies: LegacySparkRetirementLocalCaptureSessionDependencies;
}> {
  const calls: Calls = {
    timestamps: 0,
    captures: 0,
    createdAtInputs: [],
    frozenInputs: [],
    writes: 0
  };
  const dependencies: LegacySparkRetirementLocalCaptureSessionDependencies = Object.freeze({
    createCanonicalTimestamp() {
      calls.timestamps += 1;
      if (options.timestampThrows) throw new Error(PRIVATE_EXCEPTION_TEXT);
      return options.createdAt ?? CREATED_AT;
    },
    captureLocalSnapshot(input) {
      calls.captures += 1;
      calls.createdAtInputs.push(input.createdAt);
      calls.frozenInputs.push(Object.isFrozen(input));
      return options.capture ? options.capture(input) : capturedSnapshot(input.createdAt);
    }
  });
  return Object.freeze({
    session: createLegacySparkRetirementLocalCaptureSession(dependencies),
    calls,
    dependencies
  });
}

function publicJson(session: LegacySparkRetirementLocalCaptureSession): string {
  return JSON.stringify(session.getPublicState());
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

const creation = makeSession();
check(creation.calls.timestamps === 0, "A. creating session does not create timestamp.");
check(creation.calls.captures === 0, "B. creating session does not call capture.");
creation.session.getPublicState();
check(creation.calls.timestamps === 0 && creation.calls.captures === 0, "C. getPublicState is side-effect free before prepare.");

const success = makeSession();
const successResult = success.session.prepareLocalSnapshot();
check(success.calls.timestamps === 1, "D. first prepare creates timestamp exactly once.");
check(success.calls.captures === 1, "E. first prepare calls capture exactly once.");
check(success.calls.createdAtInputs.join("|") === CREATED_AT, "F. createdAt forwards unchanged.");
const internalStatus = success.session.withCapturedSnapshotForInternalUse((snapshot) => snapshot.status);
check(successResult.status === "prepared" && internalStatus === "snapshot-captured", "G. valid snapshot is retained internally.");
const successPublic = success.session.getPublicState();
const successPublicJson = JSON.stringify(successPublic);
check(
  !!successPublic.snapshotSummary &&
    successPublic.snapshotSummary.sparkCount === 1 &&
    successPublic.snapshotSummary.packageCount === 1 &&
    !("sparkIds" in successPublic.snapshotSummary) &&
    !("packageIds" in successPublic.snapshotSummary),
  "H. public state contains only text-free summary counts and statuses."
);
check(
  !successPublicJson.includes(PRIVATE_SPARK_TEXT) &&
    !successPublicJson.includes(PRIVATE_PACKAGE_TEXT) &&
    !successPublicJson.includes(PRIVATE_SPARK_ID) &&
    !successPublicJson.includes(PRIVATE_PACKAGE_ID) &&
    !successPublicJson.includes("raw"),
  "I. public state excludes raw snapshot, text, and IDs."
);
check(successPublic.guideState.status === "drive-reading", "J. guide reaches drive-reading after snapshot-captured.");

const incomplete = makeSession({ capture: () => incompleteSnapshot() });
const incompleteResult = incomplete.session.prepareLocalSnapshot();
check(
  incompleteResult.status === "prepared" &&
    incomplete.session.getPublicState().guideState.status === "incomplete" &&
    JSON.stringify(incomplete.session.getPublicState()).includes("DRAFT_PRESENT"),
  "K. incomplete DRAFT_PRESENT maps to guide incomplete."
);

const invalid = makeSession({ capture: () => invalidSnapshot() });
invalid.session.prepareLocalSnapshot();
check(invalid.session.getPublicState().guideState.status === "invalid", "L. invalid capture result maps to guide invalid.");

const timestampThrow = makeSession({ timestampThrows: true });
const timestampThrowResult = timestampThrow.session.prepareLocalSnapshot();
check(
  timestampThrowResult.status === "prepared" &&
    timestampThrow.session.getPublicState().guideState.status === "invalid" &&
    timestampThrow.session.getPublicState().commandReasons.includes("CREATED_AT_CREATION_FAILED"),
  "M. timestamp factory throw maps to typed invalid state."
);
check(timestampThrow.calls.captures === 0, "N. timestamp factory throw does not call capture.");
check(!JSON.stringify(timestampThrowResult).includes(PRIVATE_EXCEPTION_TEXT), "O. exception text is excluded from result.");

let reentrantResult: LegacySparkRetirementLocalCaptureCommandResult | null = null;
let reentrantSession: LegacySparkRetirementLocalCaptureSession;
let reentrantTimestampCalls = 0;
let reentrantCaptureCalls = 0;
reentrantSession = createLegacySparkRetirementLocalCaptureSession(Object.freeze({
  createCanonicalTimestamp() {
    reentrantTimestampCalls += 1;
    return CREATED_AT;
  },
  captureLocalSnapshot(input) {
    reentrantCaptureCalls += 1;
    reentrantResult = reentrantSession.prepareLocalSnapshot();
    return capturedSnapshot(input.createdAt);
  }
}));
reentrantSession.prepareLocalSnapshot();
const observedReentrant = reentrantResult as LegacySparkRetirementLocalCaptureCommandResult | null;
check(reentrantTimestampCalls === 1 && observedReentrant !== null && observedReentrant.status === "rejected", "P. reentrant prepare starts no second timestamp.");
check(reentrantCaptureCalls === 1 && observedReentrant !== null && observedReentrant.status === "rejected" && observedReentrant.reason === "CAPTURE_ALREADY_IN_PROGRESS", "Q. reentrant prepare starts no second capture.");

const secondAfterSuccess = success.session.prepareLocalSnapshot();
check(secondAfterSuccess.status === "rejected" && secondAfterSuccess.reason === "CAPTURE_ALREADY_ATTEMPTED", "R. second prepare after success is rejected.");
const secondAfterIncomplete = incomplete.session.prepareLocalSnapshot();
check(secondAfterIncomplete.status === "rejected" && secondAfterIncomplete.reason === "CAPTURE_ALREADY_ATTEMPTED", "S. second prepare after incomplete is rejected.");
const secondAfterInvalid = invalid.session.prepareLocalSnapshot();
check(secondAfterInvalid.status === "rejected" && secondAfterInvalid.reason === "CAPTURE_ALREADY_ATTEMPTED", "T. second prepare after invalid is rejected.");
check(invalid.calls.timestamps === 1 && invalid.calls.captures === 1, "U. invalid result does not automatically retry.");

const overwrite = makeSession({
  capture(input) {
    return capturedSnapshot(input.createdAt);
  }
});
overwrite.session.prepareLocalSnapshot();
const firstCapturedAt = overwrite.session.withCapturedSnapshotForInternalUse((snapshot) => snapshot.summary.createdAt);
overwrite.session.prepareLocalSnapshot();
const secondCapturedAt = overwrite.session.withCapturedSnapshotForInternalUse((snapshot) => snapshot.summary.createdAt);
check(firstCapturedAt === CREATED_AT && secondCapturedAt === CREATED_AT && overwrite.calls.captures === 1, "V. successful snapshot is not overwritten.");

success.session.release();
check(success.session.withCapturedSnapshotForInternalUse(() => "still-present") === undefined, "W. release frees internal snapshot reference.");
check(success.session.getPublicState().createdAt === null && !publicJson(success.session).includes(CREATED_AT), "X. release removes createdAt from public state.");
check(success.calls.writes === 0, "Y. release performs no synthetic write.");
const afterRelease = success.session.prepareLocalSnapshot();
check(afterRelease.status === "rejected" && afterRelease.reason === "CAPTURE_SESSION_RELEASED", "Z. prepare after release is rejected.");

const fresh = makeSession({ createdAt: SECOND_CREATED_AT });
fresh.session.prepareLocalSnapshot();
check(fresh.calls.timestamps === 1 && fresh.calls.createdAtInputs[0] === SECOND_CREATED_AT, "AA. new session allows a new explicit attempt.");
check(afterRelease.status === "rejected" && Object.isFrozen(afterRelease) && Object.isFrozen(afterRelease.reasons), "AB. rejected command result is frozen.");
check(Object.isFrozen(fresh.session.getPublicState()), "AC. public state is frozen.");
check(Object.isFrozen(fresh.session.getPublicState().guideState), "AD. nested guide state remains frozen.");
check(Object.isFrozen(fresh.session.getPublicState().snapshotSummary), "AE. summary remains frozen.");
check(Object.isFrozen(timestampThrow.session.getPublicState().commandReasons), "AF. command reasons remain frozen.");

const dependenciesBefore = JSON.stringify(fresh.dependencies);
fresh.session.prepareLocalSnapshot();
check(JSON.stringify(fresh.dependencies) === dependenciesBefore && fresh.calls.frozenInputs.every(Boolean), "AG. dependency inputs are not mutated.");
const beforePublic = JSON.stringify(fresh.session.getPublicState());
fresh.session.getPublicState();
check(JSON.stringify(fresh.session.getPublicState()) === beforePublic && fresh.calls.timestamps === 1 && fresh.calls.captures === 1, "AH. repeated getPublicState is side-effect free.");

const sessionSource = createLegacySparkRetirementLocalCaptureSession.toString();
check(!/Date\.now/.test(sessionSource), "AI. session does not use Date.now.");
check(!/new Date/.test(sessionSource), "AJ. session does not use new Date as clock source.");
check(!/window|localStorage|sessionStorage/.test(sessionSource), "AK. session does not use window/localStorage.");
check(!/legacySparkRetirementBrowserLocalStorageCapture|BrowserLocalStorage/.test(sessionSource), "AL. session does not import production c2a wrapper.");
check(!/React|useEffect|jsx|tsx|App/.test(sessionSource), "AM. session does not use React or App wiring.");
check(!/Drive|fetch|XMLHttpRequest|navigator\.sendBeacon/.test(sessionSource), "AN. session does not use Drive or network.");
check(!/crypto|subtle|digest|Blob|FileReader|createObjectURL|download/.test(sessionSource), "AO. session does not use crypto Blob or download APIs.");
check(!/writer-db-bytes-built|createWriterDbV2|WriterDbV2Bytes|assembly-verified/.test(sessionSource), "AP. session does not create Writer DB bytes.");
check(successResult.status !== ("backup-verified" as string) && !successPublicJson.includes("backup-verified"), "AQ. snapshot-captured is not backup-verified.");
check(!successPublicJson.includes("ready-to-create-tombstones") && !successPublicJson.includes("R3"), "AR. session does not permit R3.");
check(typeof createLegacySparkRetirementLocalCaptureSession === "function", "AS. c2b1 checks are additive to prior retirement checks.");

export const legacySparkRetirementLocalCaptureSessionCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c2b1 local capture session checks: ${passed}/${passed} passed.`);
