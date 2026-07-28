import {
  buildLegacySparkBackupFileNames,
  buildLegacySparkRetirementBackupPlan,
  type BuildLegacySparkRetirementBackupPlanInput
} from "./legacySparkRetirementBackupPlan";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function validInput(
  overrides: Partial<BuildLegacySparkRetirementBackupPlanInput> = {}
): BuildLegacySparkRetirementBackupPlanInput {
  return {
    createdAt: "2026-07-28T12:34:56.000Z",
    writerDbSchemaVersion: 2,
    writerDbSparks: { total: 3, live: 2, tombstones: 1 },
    writerDbPackages: { total: 2, live: 1, tombstones: 1 },
    noteCount: 4,
    deletedNoteCount: 1,
    packageIds: ["package-z", "package-a"],
    drive: {
      status: "required",
      schemaVersion: 1,
      sparks: { total: 2, live: 1, tombstones: 1 }
    },
    ...overrides
  };
}

const names = buildLegacySparkBackupFileNames("2026-07-28T12:34:56.000Z");
check(names.writerDbV2 === "LassiLAB_Writer_pre-retirement_DBv2_2026-07-28_12-34-56Z.json", "Writer DB filename must be stable.");
check(names.driveV1Raw === "LassiLAB_Writer_pre-retirement_DriveV1_2026-07-28_12-34-56Z.json", "Drive filename must be stable.");
check(names.manifest === "LassiLAB_Writer_pre-retirement_manifest_2026-07-28_12-34-56Z.json", "Manifest filename must be stable.");
check([names.writerDbV2, names.driveV1Raw, names.manifest].every((name) => name.includes(names.timestampToken)), "All filenames must share one timestamp token.");
check([names.writerDbV2, names.driveV1Raw, names.manifest].every((name) => /^[A-Za-z0-9_.-]+$/.test(name)), "Filenames must be Windows-safe ASCII.");

let invalidTimestampFailed = false;
try {
  buildLegacySparkBackupFileNames("2026-07-28T12:34:56Z");
} catch {
  invalidTimestampFailed = true;
}
check(invalidTimestampFailed, "Unsupported timestamp precision must fail rather than be repaired.");
check(!buildLegacySparkRetirementBackupPlan(validInput({ createdAt: "invalid" })).ok, "Invalid createdAt must return a typed invalid result.");

const input = validInput();
const inputBefore = JSON.stringify(input);
const result = buildLegacySparkRetirementBackupPlan(input);
if (!result.ok) throw new Error("Artificial valid input must create a plan.");
const { plan } = result;

check(plan.artifacts.some((artifact) => artifact.kind === "writer-db-v2"), "Writer DB artifact must be required.");
check(plan.artifacts.some((artifact) => artifact.kind === "manifest"), "Manifest artifact must be required.");
check(plan.artifacts.some((artifact) => artifact.kind === "drive-v1-raw"), "Required Drive must create a raw Drive artifact.");
check(plan.artifacts.every((artifact) => artifact.required), "Every planned artifact must be required.");
check(plan.manifest.writerDbV2.schemaVersion === 2, "Writer DB schema must be exactly 2.");
check(plan.manifest.driveV1.schemaVersion === 1, "Required Drive schema must be exactly 1.");
check(plan.manifest.writerDbV2.sparkCount === 3 && plan.manifest.writerDbV2.liveSparkCount + plan.manifest.writerDbV2.sparkTombstoneCount === 3, "Writer DB Spark counts must remain consistent.");
check(plan.manifest.writerDbV2.packageCount === 2 && plan.manifest.writerDbV2.livePackageCount + plan.manifest.writerDbV2.packageTombstoneCount === 2, "Writer DB Package counts must remain consistent.");
check(plan.manifest.writerDbV2.noteCount === 4 && plan.manifest.writerDbV2.deletedNoteCount === 1, "Note counts must be preserved.");
check(plan.manifest.packageBaseline.packageIds.join(",") === "package-a,package-z", "Package IDs must use deterministic code-unit order.");
check(plan.manifest.writerDbV2.rawSha256 === null && plan.manifest.writerDbV2.semanticSparkSha256 === null && plan.manifest.writerDbV2.semanticPackageSha256 === null, "R2.1 Writer DB hashes must be null placeholders.");
check(plan.manifest.driveV1.rawSha256 === null && plan.manifest.packageBaseline.semanticSha256 === null && plan.manifest.packageBaseline.rawStorageSha256 === null, "R2.1 Drive and Package hashes must be null placeholders.");
check(plan.status === "planned" && plan.manifest.verificationStatus === "planned", "The highest R2.1 status must be planned.");
check(plan.nextAllowedStep === "verify-backup", "The only next allowed step must be verify-backup.");
check(!JSON.stringify(plan).includes("ready-to-delete") && !JSON.stringify(plan).includes("ready-to-create-tombstones"), "The plan must expose no destructive readiness state.");
check(JSON.stringify(input) === inputBefore, "Plan construction must not mutate input metadata.");

const planJson = JSON.stringify(plan);
check(!planJson.includes("Spark author text"), "Manifest must contain no Spark text.");
check(!planJson.includes("Package author text"), "Manifest must contain no Package text.");
check(!planJson.includes("Note author text"), "Manifest must contain no note text.");
check(!planJson.includes("OAuth") && !planJson.includes("raw Drive content"), "Manifest must contain no OAuth or raw Drive content.");
check(Object.isFrozen(plan) && Object.isFrozen(plan.artifacts) && Object.isFrozen(plan.manifest), "Plan, artifacts, and manifest must be frozen.");
check(plan.artifacts.every(Object.isFrozen), "Every artifact plan must be frozen.");
check(Object.isFrozen(plan.manifest.writerDbV2) && Object.isFrozen(plan.manifest.driveV1), "Manifest artifact metadata must be frozen.");
check(Object.isFrozen(plan.manifest.packageBaseline) && Object.isFrozen(plan.manifest.packageBaseline.packageIds), "Package baseline and IDs must be frozen.");

const mutableIds = ["b", "a"];
const detachedResult = buildLegacySparkRetirementBackupPlan(validInput({ packageIds: mutableIds }));
if (!detachedResult.ok) throw new Error("Mutable artificial IDs must be valid input.");
mutableIds.push("later-mutation");
check(detachedResult.plan.manifest.packageBaseline.packageIds.join(",") === "a,b", "Later input-array mutation must not change the manifest.");
check(JSON.stringify(plan) === JSON.stringify(buildLegacySparkRetirementBackupPlan(input).ok ? (buildLegacySparkRetirementBackupPlan(input) as { ok: true; plan: typeof plan }).plan : null), "Repeated calls must be deterministic.");

const notApplicableResult = buildLegacySparkRetirementBackupPlan(validInput({ drive: { status: "not-applicable" } }));
if (!notApplicableResult.ok) throw new Error("Drive not-applicable must be a valid plan.");
check(!notApplicableResult.plan.artifacts.some((artifact) => artifact.kind === "drive-v1-raw"), "Drive not-applicable must not create a Drive artifact.");
check(notApplicableResult.plan.manifest.driveV1.status === "not-applicable", "Drive not-applicable must remain explicit.");
check(notApplicableResult.plan.manifest.driveV1.fileName === null && notApplicableResult.plan.manifest.driveV1.rawSha256 === null, "Drive not-applicable must have no filename or hash.");

function hasReason(candidate: BuildLegacySparkRetirementBackupPlanInput, reason: string) {
  const invalid = buildLegacySparkRetirementBackupPlan(candidate);
  return !invalid.ok && invalid.reasons.includes(reason as never);
}

check(hasReason(validInput({ writerDbSparks: { total: 3, live: 1, tombstones: 1 } }), "SPARK_COUNT_MISMATCH"), "Spark count mismatch must block planning.");
check(hasReason(validInput({ writerDbPackages: { total: 2, live: 2, tombstones: 1 } }), "PACKAGE_COUNT_MISMATCH"), "Package count mismatch must block planning.");
check(hasReason(validInput({ noteCount: 1, deletedNoteCount: 2 }), "NOTE_COUNT_MISMATCH"), "Deleted-note overflow must block planning.");
check(hasReason(validInput({ packageIds: ["duplicate", "duplicate"] }), "DUPLICATE_PACKAGE_ID"), "Duplicate Package IDs must block planning.");
check(hasReason(validInput({ noteCount: -1 }), "INVALID_COUNT"), "Negative counts must block planning.");
check(hasReason(validInput({ noteCount: 1.5 }), "INVALID_COUNT"), "Fractional counts must block planning.");
check(hasReason(validInput({ drive: { status: "required", schemaVersion: 1, sparks: { total: 1, live: 1, tombstones: 1 } } }), "DRIVE_METADATA_MISMATCH"), "Drive count mismatch must block planning.");

const sourceText = `${buildLegacySparkRetirementBackupPlan.toString()}${buildLegacySparkBackupFileNames.toString()}`;
check(!/crypto|subtle|digest/i.test(sourceText), "R2.1 implementation must not use crypto.");
check(!/localStorage|sessionStorage|window|document/.test(sourceText), "R2.1 implementation must not use browser storage or globals.");
check(!/fetch|googleDrive|driveJsonRequest/.test(sourceText), "R2.1 implementation must not use network or Drive APIs.");
check(!/writeFile|createWriteStream|download|Blob/.test(sourceText), "R2.1 implementation must expose no file creation or download API.");
check(!/Date\.now|new Date\(\)/.test(sourceText), "R2.1 implementation must not obtain the current time.");

export const legacySparkRetirementBackupPlanCheckCount = passed;
console.log(`Legacy Spark retirement R2.1 backup plan checks: ${passed}/${passed} passed.`);
