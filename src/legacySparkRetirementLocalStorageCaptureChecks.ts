import type { Spark, WriterPackage } from "./types";
import {
  captureLegacySparkRetirementLocalStorageSnapshot,
  LEGACY_SPARK_RETIREMENT_DRAFT_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_PACKAGE_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_SPARK_STORAGE_KEY,
  type LegacySparkRetirementLocalStorageCaptureDependencies
} from "./legacySparkRetirementLocalStorageCapture";
import type { LegacySparkRetirementLocalSnapshotResult } from "./legacySparkRetirementLocalSnapshot";

const CREATED_AT = "2026-07-30T12:00:00.000Z";
const KEYS = [
  LEGACY_SPARK_RETIREMENT_SPARK_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_PACKAGE_STORAGE_KEY,
  LEGACY_SPARK_RETIREMENT_DRAFT_STORAGE_KEY
] as const;

function spark(): Spark {
  return {
    id: "synthetic-spark",
    text: "Synthetic private Spark",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    temperature: "spark",
    tags: ["synthetic"],
    schemaVersion: 1
  };
}

function writerPackage(): WriterPackage {
  return {
    id: "synthetic-package",
    title: "Synthetic private Package",
    sparkText: "Synthetic source",
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

function capture(
  values: Readonly<Record<string, string | null>> = {},
  throwAt?: string,
  calls: string[] = []
) {
  const dependencies: LegacySparkRetirementLocalStorageCaptureDependencies = Object.freeze({
    readStorageValue(key: string) {
      calls.push(key);
      if (key === throwAt) throw new Error(`private exception at ${key}`);
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    }
  });
  return {
    result: captureLegacySparkRetirementLocalStorageSnapshot(
      Object.freeze({ createdAt: CREATED_AT }),
      dependencies
    ),
    dependencies,
    calls
  };
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

const missing = capture();
check(missing.result.status === "snapshot-captured", "A. all missing captures a snapshot.");
if (missing.result.status !== "snapshot-captured") throw new Error("Expected snapshot.");
check(missing.result.snapshot.sparkStorage.status === "missing", "R. null Spark maps to missing.");
check(missing.result.snapshot.packageStorage.status === "missing", "R. null Package maps to missing.");
check(missing.result.snapshot.draftStorage.status === "missing", "R. null Draft maps to missing.");

const sparkRaw = JSON.stringify([spark()]);
const sparksOnly = capture({ [KEYS[0]]: sparkRaw });
check(sparksOnly.result.status === "snapshot-captured" && sparksOnly.result.summary.sparkCount === 1, "B. Spark present captures.");
check(sparksOnly.result.status === "snapshot-captured" && sparksOnly.result.snapshot.sparkStorage.raw === sparkRaw, "S. Spark string maps to exact present raw.");

const packagesEmpty = capture({ [KEYS[1]]: "[]" });
check(packagesEmpty.result.status === "snapshot-captured" && packagesEmpty.result.snapshot.packageStorage.status === "present", "C. Package [] is present.");
check(packagesEmpty.result.status === "snapshot-captured" && packagesEmpty.result.snapshot.packageStorage.raw === "[]", "C. Package [] stays exact.");

const blankDraftRaw = JSON.stringify({ text: "", updatedAt: CREATED_AT, schemaVersion: 1 });
check(capture({ [KEYS[2]]: blankDraftRaw }).result.status === "snapshot-captured", "D. empty draft captures.");
const privateDraft = "Synthetic private draft";
const nonEmptyDraft = capture({ [KEYS[2]]: JSON.stringify({ text: privateDraft, updatedAt: CREATED_AT, schemaVersion: 1 }) }).result;
check(nonEmptyDraft.status === "incomplete" && hasReason(nonEmptyDraft, "DRAFT_PRESENT"), "E. non-empty draft is incomplete.");

const emptyRaw = capture({ [KEYS[0]]: "" }).result;
check(hasReason(emptyRaw, "SPARK_STORAGE_PARSE_FAILED"), "F/T/V. empty string stays present and reaches parser.");
const whitespace = " \r\n\t ";
const whitespaceRaw = capture({ [KEYS[1]]: whitespace }).result;
check(hasReason(whitespaceRaw, "PACKAGE_STORAGE_PARSE_FAILED"), "G/U/V. whitespace stays exact and reaches parser.");

const sparkCalls: string[] = [];
const sparkFailure = capture({}, KEYS[0], sparkCalls).result;
check(hasReason(sparkFailure, "SPARK_STORAGE_READ_FAILED"), "H. Spark throw is typed invalid.");
check(sparkCalls.join("|") === KEYS[0], "K. Spark throw stops later reads.");
const packageCalls: string[] = [];
const packageFailure = capture({ [KEYS[0]]: sparkRaw }, KEYS[1], packageCalls).result;
check(hasReason(packageFailure, "PACKAGE_STORAGE_READ_FAILED"), "I. Package throw is typed invalid.");
check(packageCalls.join("|") === `${KEYS[0]}|${KEYS[1]}`, "L. Package throw stops Draft read.");
const draftCalls: string[] = [];
const draftFailure = capture({ [KEYS[0]]: sparkRaw, [KEYS[1]]: "[]" }, KEYS[2], draftCalls).result;
check(hasReason(draftFailure, "DRAFT_STORAGE_READ_FAILED"), "J. Draft throw is typed invalid.");
check(draftCalls.join("|") === KEYS.join("|"), "J. Draft failure follows fixed order.");
check(!JSON.stringify(packageFailure).includes("Synthetic private Spark"), "M/AC. read error returns no partial raw snapshot.");
check(hasReason(capture({}, KEYS[0]).result, "SPARK_STORAGE_READ_FAILED"), "N. parser is not called after read failure.");

check(missing.calls.join("|") === KEYS.join("|"), "P. order is Spark then Package then Draft.");
check(missing.calls.length === 3 && new Set(missing.calls).size === 3, "O. each key read exactly once.");
check(missing.calls.every((key) => KEYS.includes(key as typeof KEYS[number])), "Q. no other key is read.");
const damagedBeforeFinalRead: string[] = [];
const damagedSpark = capture({ [KEYS[0]]: "{" }, undefined, damagedBeforeFinalRead).result;
check(damagedBeforeFinalRead.length === 3 && hasReason(damagedSpark, "SPARK_STORAGE_PARSE_FAILED"), "All reads finish before parsing.");

const explicitTime = capture({ [KEYS[0]]: sparkRaw }).result;
check(explicitTime.status === "snapshot-captured" && explicitTime.summary.createdAt === CREATED_AT, "W. createdAt passes unchanged.");
const invalidTime = captureLegacySparkRetirementLocalStorageSnapshot(
  { createdAt: "invalid" }, { readStorageValue: () => null }
);
check(hasReason(invalidTime, "INVALID_CREATED_AT"), "X. R2.6.3a rejects invalid createdAt.");
check(hasReason(damagedSpark, "SPARK_STORAGE_PARSE_FAILED"), "Y. damaged Spark is rejected by R2.6.3a.");
check(hasReason(capture({ [KEYS[1]]: "{" }).result, "PACKAGE_STORAGE_PARSE_FAILED"), "Z. damaged Package is rejected by R2.6.3a.");
check(hasReason(capture({ [KEYS[2]]: "{" }).result, "DRAFT_STORAGE_PARSE_FAILED"), "AA. draft parse failure is preserved.");
check(!JSON.stringify(sparkFailure).includes("private exception"), "AB. exception text is excluded.");

const mutableInput = { createdAt: CREATED_AT };
const inputBefore = JSON.stringify(mutableInput);
const dependencyCapture = capture();
captureLegacySparkRetirementLocalStorageSnapshot(mutableInput, dependencyCapture.dependencies);
check(JSON.stringify(mutableInput) === inputBefore, "AD. input is not mutated.");
check(Object.isFrozen(dependencyCapture.dependencies), "AE. dependencies remain frozen and unmodified.");
check(Object.isFrozen(sparkFailure), "AF. read-error result is frozen.");
check(sparkFailure.status === "invalid" && Object.isFrozen(sparkFailure.reasons), "AG. read-error reasons are frozen.");
check(Object.isFrozen(missing.result) && Object.isFrozen(missing.result.snapshot), "AH. successful snapshot stays frozen.");
check(JSON.stringify(capture({ [KEYS[0]]: sparkRaw }).result) === JSON.stringify(capture({ [KEYS[0]]: sparkRaw }).result), "AI. repeated fake capture is deterministic.");

const packagesRaw = JSON.stringify([writerPackage()]);
const complete = capture({ [KEYS[0]]: sparkRaw, [KEYS[1]]: packagesRaw }).result;
check(complete.status === "snapshot-captured" && complete.summary.packageCount === 1, "Successful result transparently preserves R2.6.3a snapshot.");
check(complete.status !== ("backup-verified" as string), "AN. snapshot is not backup-verified.");
check(complete.status !== ("writer-db-bytes-built" as string) && complete.status !== ("assembly-verified" as string), "Result introduces no later-phase success state.");

const sourceText = captureLegacySparkRetirementLocalStorageSnapshot.toString();
check(!/globalThis|localStorage|sessionStorage/.test(sourceText), "AJ. no real storage global.");
check(!/window|document|React/.test(sourceText), "AK. no window/document/UI.");
check(!/setItem|removeItem|clear\(/.test(sourceText), "AL. no storage write API.");
check(!/Drive|fetch|crypto|TextEncoder|TextDecoder|Blob|FileReader|createObjectURL/.test(sourceText), "AM. no Drive/network/crypto/file API.");
check(!/Date\.now|new Date|console\./.test(sourceText), "No clock or logging side effect.");

export const legacySparkRetirementLocalStorageCaptureCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c1 local storage capture checks: ${passed}/${passed} passed.`);
