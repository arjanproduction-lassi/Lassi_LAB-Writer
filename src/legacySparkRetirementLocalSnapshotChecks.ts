import type { Spark, WriterPackage, WriterPackageNote } from "./types";
import {
  captureLegacySparkRetirementLocalSnapshotFromRaw,
  type LegacySparkRetirementLocalSnapshotInput,
  type LegacySparkRetirementLocalSnapshotResult,
  type LegacySparkRetirementRawStorageValue
} from "./legacySparkRetirementLocalSnapshot";

const CREATED_AT = "2026-07-30T10:00:00.000Z";
const missing = (): LegacySparkRetirementRawStorageValue => ({ status: "missing" });
const present = (value: unknown): LegacySparkRetirementRawStorageValue => ({ status: "present", raw: typeof value === "string" ? value : JSON.stringify(value) });
function spark(overrides: Partial<Spark> = {}): Spark {
  return { id: "spark-a", text: "Synthetic Spark text", createdAt: CREATED_AT, updatedAt: CREATED_AT, temperature: "spark", tags: ["synthetic"], schemaVersion: 1, ...overrides };
}
function note(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return { id: "note-a", text: "Synthetic note text", createdAt: CREATED_AT, updatedAt: CREATED_AT, ...overrides };
}
function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return { id: "package-a", title: "Synthetic title", sparkText: "Synthetic package spark", notes: [], workshopText: "Synthetic workshop", finalText: "Synthetic final", createdAt: CREATED_AT, updatedAt: CREATED_AT, packageVersion: 1, ...overrides };
}
function input(overrides: Partial<LegacySparkRetirementLocalSnapshotInput> = {}): LegacySparkRetirementLocalSnapshotInput {
  return { createdAt: CREATED_AT, sparks: missing(), packages: missing(), draft: missing(), ...overrides };
}
function hasReason(result: LegacySparkRetirementLocalSnapshotResult, reason: string) {
  return result.status !== "snapshot-captured" && result.reasons.includes(reason as never);
}
let passed = 0;
function check(condition: boolean, message: string) { if (!condition) throw new Error(message); passed += 1; }

const bothMissing = captureLegacySparkRetirementLocalSnapshotFromRaw(input());
check(bothMissing.status === "snapshot-captured", "Missing collection keys are valid historical states.");
if (bothMissing.status !== "snapshot-captured") throw new Error("Expected snapshot.");
check(bothMissing.summary.sparkCount === 0 && bothMissing.summary.packageCount === 0, "Missing collections have zero counts.");
check(bothMissing.snapshot.sparkStorage.status === "missing" && bothMissing.snapshot.sparkStorage.raw === null, "Missing Spark metadata retained.");
check(bothMissing.snapshot.packageStorage.status === "missing" && bothMissing.snapshot.packageStorage.raw === null, "Missing Package metadata retained.");
const emptySparks = captureLegacySparkRetirementLocalSnapshotFromRaw(input({ sparks: present([]) }));
check(emptySparks.status === "snapshot-captured" && emptySparks.summary.sparkCount === 0, "Stored empty Sparks valid.");
check(emptySparks.status === "snapshot-captured" && emptySparks.snapshot.sparkStorage.status === "present" && emptySparks.snapshot.sparkStorage.raw === "[]", "Missing and stored empty Sparks differ.");
const emptyPackages = captureLegacySparkRetirementLocalSnapshotFromRaw(input({ packages: present([]) }));
check(emptyPackages.status === "snapshot-captured" && emptyPackages.summary.packageCount === 0, "Stored empty Packages valid.");
check(emptyPackages.status === "snapshot-captured" && emptyPackages.snapshot.packageStorage.status === "present" && emptyPackages.snapshot.packageStorage.raw === "[]", "Missing and stored empty Packages differ.");

const sparkMix = captureLegacySparkRetirementLocalSnapshotFromRaw(input({ sparks: present([spark({ id: "z" }), spark({ id: "a", deletedAt: CREATED_AT })]) }));
check(sparkMix.status === "snapshot-captured" && sparkMix.summary.sparkCount === 2, "Sparks retained.");
check(sparkMix.status === "snapshot-captured" && sparkMix.summary.sparkLiveCount === 1 && sparkMix.summary.sparkTombstoneCount === 1, "Spark tombstone counted.");
check(sparkMix.status === "snapshot-captured" && sparkMix.snapshot.sparks[1].deletedAt === CREATED_AT, "Spark tombstone not filtered.");
check(sparkMix.status === "snapshot-captured" && sparkMix.snapshot.sparks.map((item) => item.id).join(",") === "z,a", "Spark storage order retained.");
check(sparkMix.status === "snapshot-captured" && sparkMix.summary.sparkIds.join(",") === "a,z", "Spark summary IDs sorted.");

const tombstonePackage = writerPackage({ id: "z", deletedAt: CREATED_AT, notes: [note(), note({ id: "deleted-note", deletedAt: CREATED_AT })] });
const packageMix = captureLegacySparkRetirementLocalSnapshotFromRaw(input({ packages: present([tombstonePackage, writerPackage({ id: "a" })]) }));
check(packageMix.status === "snapshot-captured" && packageMix.summary.packageCount === 2, "Packages retained.");
check(packageMix.status === "snapshot-captured" && packageMix.summary.packageLiveCount === 1 && packageMix.summary.packageTombstoneCount === 1, "Package tombstone counted.");
check(packageMix.status === "snapshot-captured" && packageMix.summary.noteCount === 2 && packageMix.summary.deletedNoteCount === 1, "Notes and deleted notes counted.");
check(packageMix.status === "snapshot-captured" && packageMix.snapshot.packages[0].notes[1].deletedAt === CREATED_AT, "Deleted note retained.");
check(packageMix.status === "snapshot-captured" && packageMix.snapshot.packages.map((item) => item.id).join(",") === "z,a", "Package storage order retained.");
check(packageMix.status === "snapshot-captured" && packageMix.summary.packageIds.join(",") === "a,z", "Package summary IDs sorted.");

const invalidCases: Array<[LegacySparkRetirementLocalSnapshotInput, string, string]> = [
  [input({ sparks: present("{") }), "SPARK_STORAGE_PARSE_FAILED", "Damaged Spark JSON"],
  [input({ sparks: present({}) }), "SPARK_STORAGE_INVALID", "Spark top-level object"],
  [input({ sparks: present([{ ...spark(), text: 7 }]) }), "SPARK_STORAGE_INVALID", "Invalid Spark"],
  [input({ sparks: present([spark(), spark()]) }), "DUPLICATE_SPARK_ID", "Duplicate Spark"],
  [input({ packages: present("{") }), "PACKAGE_STORAGE_PARSE_FAILED", "Damaged Package JSON"],
  [input({ packages: present({}) }), "PACKAGE_STORAGE_INVALID", "Package top-level object"],
  [input({ packages: present([{ ...writerPackage(), title: 7 }]) }), "PACKAGE_STORAGE_INVALID", "Invalid Package"],
  [input({ packages: present([writerPackage(), writerPackage()]) }), "DUPLICATE_PACKAGE_ID", "Duplicate Package"]
];
for (const [candidate, reason, label] of invalidCases) check(hasReason(captureLegacySparkRetirementLocalSnapshotFromRaw(candidate), reason), `${label} blocks.`);

check(bothMissing.snapshot.draftStorage.status === "missing" && !bothMissing.summary.draftPresent, "Missing draft valid.");
const emptyDraft = captureLegacySparkRetirementLocalSnapshotFromRaw(input({ draft: present({ text: "   ", updatedAt: CREATED_AT, schemaVersion: 1 }) }));
check(emptyDraft.status === "snapshot-captured" && !emptyDraft.summary.draftPresent, "Blank draft valid.");
const privateDraft = "Private unsaved synthetic draft";
const draftPresent = captureLegacySparkRetirementLocalSnapshotFromRaw(input({ draft: present({ text: privateDraft, updatedAt: CREATED_AT, schemaVersion: 1 }) }));
check(draftPresent.status === "incomplete" && hasReason(draftPresent, "DRAFT_PRESENT"), "Non-empty draft incomplete.");
check(!JSON.stringify(draftPresent).includes(privateDraft), "Draft text excluded from failure.");
check(hasReason(captureLegacySparkRetirementLocalSnapshotFromRaw(input({ draft: present("{") })), "DRAFT_STORAGE_PARSE_FAILED"), "Damaged draft blocks.");
check(hasReason(captureLegacySparkRetirementLocalSnapshotFromRaw(input({ draft: present({ text: "", updatedAt: "bad", schemaVersion: 1 }) })), "DRAFT_STORAGE_INVALID"), "Invalid draft blocks.");

const summaryJson = JSON.stringify(packageMix.status === "snapshot-captured" ? packageMix.summary : null);
for (const privateValue of ["Synthetic Spark text", "Synthetic title", "Synthetic package spark", "Synthetic note text", "Synthetic workshop", "Synthetic final"]) {
  check(!summaryJson.includes(privateValue), "Public summary excludes creative text.");
}
check(!summaryJson.includes("raw") && !summaryJson.includes("OAuth") && !summaryJson.includes("Drive"), "Summary excludes raw/account data.");
check(bothMissing.summary.createdAt === CREATED_AT, "Canonical createdAt retained.");
check(hasReason(captureLegacySparkRetirementLocalSnapshotFromRaw(input({ createdAt: "2026-07-30T10:00:00Z" })), "INVALID_CREATED_AT"), "Noncanonical createdAt rejected.");
check(hasReason(captureLegacySparkRetirementLocalSnapshotFromRaw(input({ createdAt: "invalid" })), "INVALID_CREATED_AT"), "Invalid createdAt rejected.");

check(Object.isFrozen(bothMissing) && Object.isFrozen(bothMissing.snapshot) && Object.isFrozen(bothMissing.summary), "Result snapshot summary frozen.");
check(packageMix.status === "snapshot-captured" && Object.isFrozen(packageMix.snapshot.sparks) && Object.isFrozen(packageMix.snapshot.packages), "Collection arrays frozen.");
check(packageMix.status === "snapshot-captured" && Object.isFrozen(packageMix.snapshot.packages[0]) && Object.isFrozen(packageMix.snapshot.packages[0].notes) && Object.isFrozen(packageMix.snapshot.packages[0].notes[0]), "Nested Package data frozen.");
check(Object.isFrozen(bothMissing.summary.sparkIds) && Object.isFrozen(bothMissing.summary.packageIds), "ID arrays frozen.");
check(Object.isFrozen(bothMissing.snapshot.sparkStorage) && Object.isFrozen(bothMissing.snapshot.packageStorage) && Object.isFrozen(bothMissing.snapshot.draftStorage), "Storage metadata frozen.");
check(draftPresent.status === "incomplete" && Object.isFrozen(draftPresent) && Object.isFrozen(draftPresent.reasons), "Failure reasons frozen.");

const mutableValue: LegacySparkRetirementRawStorageValue = { status: "present", raw: JSON.stringify([spark()]) };
const mutableInput = input({ sparks: mutableValue });
const before = JSON.stringify(mutableInput);
const detached = captureLegacySparkRetirementLocalSnapshotFromRaw(mutableInput);
check(JSON.stringify(mutableInput) === before, "Input not mutated.");
(mutableValue as { status: "present"; raw: string }).raw = "[]";
check(detached.status === "snapshot-captured" && detached.summary.sparkCount === 1 && detached.snapshot.sparkStorage.raw !== "[]", "Later wrapper mutation detached.");
check(JSON.stringify(captureLegacySparkRetirementLocalSnapshotFromRaw(input({ sparks: present([spark()]) }))) === JSON.stringify(captureLegacySparkRetirementLocalSnapshotFromRaw(input({ sparks: present([spark()]) }))), "Repeated capture deterministic.");
check(bothMissing.status !== ("backup-verified" as string), "Snapshot is not backup-verified.");
check(!JSON.stringify(bothMissing.summary).includes("ready-to-create-tombstones"), "Snapshot permits no R3.");

const sourceText = captureLegacySparkRetirementLocalSnapshotFromRaw.toString();
check(!/localStorage|sessionStorage|window|document/.test(sourceText), "No storage/browser read.");
check(!/TextEncoder|TextDecoder|crypto|subtle|digest/.test(sourceText), "No bytes/crypto.");
check(!/fetch|googleDrive|driveJsonRequest/.test(sourceText), "No network/Drive.");
check(!/Blob|FileReader|createObjectURL|React/.test(sourceText), "No file/UI.");
check(!/setItem|removeItem|clear\(/.test(sourceText), "No writes.");
check(!/Date\.now|new Date\(\)/.test(sourceText), "No current time.");
check(!/console\./.test(sourceText), "No logging.");

export const legacySparkRetirementLocalSnapshotCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3a local snapshot checks: ${passed}/${passed} passed.`);
