import type { Spark, WriterPackage } from "./types";
import {
  captureLegacySparkRetirementBrowserLocalStorageSnapshot,
  captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies,
  type LegacySparkRetirementBrowserLocalStorageDependencies,
  type LegacySparkRetirementBrowserStorage
} from "./legacySparkRetirementBrowserLocalStorageCapture";
import {
  LEGACY_SPARK_RETIREMENT_DRAFT_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_PACKAGE_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_SPARK_STORAGE_KEY
} from "./legacySparkRetirementLocalStorageCapture";
import type { LegacySparkRetirementLocalSnapshotResult } from "./legacySparkRetirementLocalSnapshot";

const CREATED_AT = "2026-07-30T14:00:00.000Z";
const KEYS = [
  LEGACY_SPARK_RETIREMENT_SPARK_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_PACKAGE_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_DRAFT_STORAGE_KEY
] as const;

function spark(): Spark {
  return {
    id: "synthetic-browser-spark",
    text: "Synthetic browser Spark text",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    temperature: "spark",
    tags: ["synthetic"],
    schemaVersion: 1
  };
}

function writerPackage(): WriterPackage {
  return {
    id: "synthetic-browser-package",
    title: "Synthetic browser Package title",
    sparkText: "Synthetic package source",
    notes: [],
    workshopText: "Synthetic workshop",
    finalText: "Synthetic final",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    packageVersion: 1
  };
}

function hasReason(result: LegacySparkRetirementLocalSnapshotResult, reason: string): boolean {
  return result.status !== "snapshot-captured" && result.reasons.includes(reason as never);
}

type FakeOptions = Readonly<{
  values?: Readonly<Record<string, string | null>>;
  throwAt?: string;
}>;

function fakeStorage(options: FakeOptions = {}, calls: string[] = []): LegacySparkRetirementBrowserStorage {
  return Object.freeze({
    getItem(key: string) {
      calls.push(key);
      if (key === options.throwAt) throw new Error(`private storage exception ${key}`);
      return options.values && Object.prototype.hasOwnProperty.call(options.values, key)
        ? options.values[key]
        : null;
    }
  });
}

function capture(
  options: FakeOptions = {},
  calls: string[] = [],
  getterCalls = { count: 0 }
) {
  const storage = fakeStorage(options, calls);
  const dependencies: LegacySparkRetirementBrowserLocalStorageDependencies = Object.freeze({
    getLocalStorage() {
      getterCalls.count += 1;
      return storage;
    }
  });
  return {
    result: captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(
      Object.freeze({ createdAt: CREATED_AT }),
      dependencies
    ),
    dependencies,
    getterCalls,
    storage,
    calls
  };
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

let lazyCalls = 0;
const lazyDependencies: LegacySparkRetirementBrowserLocalStorageDependencies = Object.freeze({
  getLocalStorage() {
    lazyCalls += 1;
    return fakeStorage();
  }
});
check(lazyCalls === 0, "A. creating injected dependencies does not acquire storage.");
const lazyFunction = captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies;
check(lazyCalls === 0 && typeof lazyFunction === "function", "A. obtaining function reference does not acquire storage.");
const lazyResult = lazyFunction({ createdAt: CREATED_AT }, lazyDependencies);
check(lazyCalls === 1 && lazyResult.status === "snapshot-captured", "B. acquisition starts only at capture.");

const allMissing = capture();
check(allMissing.getterCalls.count === 1, "C. getLocalStorage called exactly once.");
check(allMissing.result.status === "snapshot-captured", "E. three null values follow c1 snapshot contract.");
check(allMissing.calls.join("|") === KEYS.join("|"), "O. Spark Package Draft order preserved.");
check(allMissing.calls.length === 3 && new Set(allMissing.calls).size === 3, "P. every key read once.");
check(allMissing.calls.every((key) => KEYS.includes(key as typeof KEYS[number])), "Q. no other key read.");

const validValues = {
  [KEYS[0]]: JSON.stringify([spark()]),
  [KEYS[1]]: JSON.stringify([writerPackage()]),
  [KEYS[2]]: JSON.stringify({ text: "", updatedAt: CREATED_AT, schemaVersion: 1 })
};
const validCalls: string[] = [];
const valid = capture({ values: validValues }, validCalls);
check(valid.result.status === "snapshot-captured" && valid.result.summary.sparkCount === 1 && valid.result.summary.packageCount === 1, "F. valid synthetic records capture.");
check(validCalls.length === 3, "D. same retained storage handles all reads.");

const thrownText = "private getter exception and author text";
const throwingDependencies: LegacySparkRetirementBrowserLocalStorageDependencies = Object.freeze({
  getLocalStorage() { throw new Error(thrownText); }
});
const getterFailure = captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(
  { createdAt: "invalid" }, throwingDependencies
);
check(hasReason(getterFailure, "LOCAL_STORAGE_UNAVAILABLE"), "G. getter throw is unavailable.");
check(!JSON.stringify(getterFailure).includes(thrownText), "J. unavailable excludes exception text.");
check(!hasReason(getterFailure, "INVALID_CREATED_AT"), "K. c1 not called when storage unavailable.");
for (const candidate of [null, undefined]) {
  check(hasReason(captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(
    { createdAt: CREATED_AT }, { getLocalStorage: () => candidate }
  ), "LOCAL_STORAGE_UNAVAILABLE"), "H. null or undefined storage unavailable.");
}
const missingGetItem = captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(
  { createdAt: CREATED_AT },
  { getLocalStorage: () => ({} as LegacySparkRetirementBrowserStorage) }
);
check(hasReason(missingGetItem, "LOCAL_STORAGE_UNAVAILABLE"), "I. missing getItem unavailable.");

const sparkFailure = capture({ throwAt: KEYS[0] }).result;
check(hasReason(sparkFailure, "SPARK_STORAGE_READ_FAILED"), "L. Spark getItem throw stays c1 reason.");
const packageFailure = capture({ throwAt: KEYS[1] }).result;
check(hasReason(packageFailure, "PACKAGE_STORAGE_READ_FAILED"), "M. Package getItem throw stays c1 reason.");
const draftFailure = capture({ throwAt: KEYS[2] }).result;
check(hasReason(draftFailure, "DRAFT_STORAGE_READ_FAILED"), "N. Draft getItem throw stays c1 reason.");
check(!JSON.stringify(packageFailure).includes("private storage exception"), "Read errors exclude exception text.");

const guardedAccesses: string[] = [];
const guardedStorage = new Proxy(fakeStorage({}, guardedAccesses), {
  get(target, property, receiver) {
    if (property !== "getItem") throw new Error(`Unexpected storage API ${String(property)}`);
    return Reflect.get(target, property, receiver);
  }
});
const guarded = captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(
  { createdAt: CREATED_AT }, { getLocalStorage: () => guardedStorage }
);
check(guarded.status === "snapshot-captured", "R/S/T/U/V. no length key or write API accessed.");

const emptyRaw = capture({ values: { [KEYS[0]]: "" } }).result;
check(hasReason(emptyRaw, "SPARK_STORAGE_PARSE_FAILED"), "W. empty string remains present for c1 parser.");
const whitespace = " \r\n\t ";
const whitespaceRaw = capture({ values: { [KEYS[1]]: whitespace } }).result;
check(hasReason(whitespaceRaw, "PACKAGE_STORAGE_PARSE_FAILED"), "X. whitespace remains present for c1 parser.");
const explicitTime = capture({ values: { [KEYS[0]]: JSON.stringify([spark()]) } }).result;
check(explicitTime.status === "snapshot-captured" && explicitTime.summary.createdAt === CREATED_AT, "Y. createdAt forwarded unchanged.");

check(Object.isFrozen(getterFailure), "AB. unavailable result frozen.");
check(getterFailure.status === "invalid" && Object.isFrozen(getterFailure.reasons), "AC. unavailable reasons frozen.");
const mutableInput = { createdAt: CREATED_AT };
const beforeInput = JSON.stringify(mutableInput);
const immutableRun = capture();
captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies(mutableInput, immutableRun.dependencies);
check(JSON.stringify(mutableInput) === beforeInput, "AD. input not mutated.");
check(Object.isFrozen(immutableRun.dependencies), "AE. dependencies remain frozen.");

const nonBrowserResult = captureLegacySparkRetirementBrowserLocalStorageSnapshot({ createdAt: CREATED_AT });
check(hasReason(nonBrowserResult, "LOCAL_STORAGE_UNAVAILABLE"), "Public wrapper is safe in nonbrowser check runtime.");
check(typeof captureLegacySparkRetirementBrowserLocalStorageSnapshot === "function", "AK. public browser export exists.");
check(allMissing.result.status !== ("backup-verified" as string), "AL. snapshot is not backup-verified.");
check(!JSON.stringify(allMissing.result).includes("ready-to-create-tombstones"), "AM. wrapper grants no R3.");

const injectedSource = captureLegacySparkRetirementBrowserLocalStorageSnapshotWithDependencies.toString();
const browserSource = captureLegacySparkRetirementBrowserLocalStorageSnapshot.toString();
check(!/Date\.now|new Date|performance\.now/.test(injectedSource + browserSource), "Z/AA. no clock source.");
check(!/writer-db-bytes-built|createWriterDbV2|assembly-verified/.test(injectedSource + browserSource), "AF. no Writer DB bytes.");
check(!/Drive|fetch|crypto|TextEncoder|TextDecoder/.test(injectedSource + browserSource), "AG. no Drive network or crypto.");
check(!/Blob|FileReader|createObjectURL|download/.test(injectedSource + browserSource), "AH. no file or download.");
check(!/React|useEffect|App/.test(injectedSource + browserSource), "AI. no App UI wiring.");
check(!/setItem|removeItem|clear\(|addEventListener|setTimeout|setInterval|serviceWorker|console\./.test(injectedSource + browserSource), "Source has no write automatic event timer worker or logging.");
check(/window\.localStorage/.test(browserSource) && !/window\.localStorage/.test(injectedSource), "AJ. browser access exists only in lazy public function body.");

export const legacySparkRetirementBrowserLocalStorageCaptureCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c2a browser local storage checks: ${passed}/${passed} passed.`);
