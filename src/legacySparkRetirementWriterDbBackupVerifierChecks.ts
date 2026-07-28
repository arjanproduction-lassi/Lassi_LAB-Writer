import type { Spark, WriterPackage } from "./types";
import type { WriterDbV2 } from "./writerDb";
import { verifyLegacySparkRetirementWriterDbV2Backup } from "./legacySparkRetirementWriterDbBackupVerifier";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function spark(overrides: Partial<Spark> = {}): Spark {
  return {
    id: "synthetic-spark",
    text: "Synthetic Spark author text must not enter verification output.",
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    temperature: "spark",
    tags: ["synthetic"],
    schemaVersion: 1,
    ...overrides
  };
}

function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "synthetic-package",
    title: "Synthetic Package title",
    sparkText: "Synthetic Package spark text",
    notes: [],
    workshopText: "Synthetic workshop text",
    finalText: "Synthetic final text",
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

function db(overrides: Partial<WriterDbV2> = {}): WriterDbV2 {
  const sparks = overrides.sparks ?? [];
  const packages = overrides.packages ?? [];
  return {
    app: "LassiLAB Writer",
    schemaVersion: 2,
    exportedAt: "2026-07-28T12:00:00.000Z",
    sparkCount: sparks.length,
    packageCount: packages.length,
    sparks,
    packages,
    ...overrides
  };
}

function verify(value: unknown) {
  return verifyLegacySparkRetirementWriterDbV2Backup(JSON.stringify(value));
}

function hasReason(value: unknown, reason: string) {
  const result = verify(value);
  return result.status === "invalid" && result.reasons.includes(reason as never);
}

const empty = verify(db());
check(empty.status === "structure-verified", "A valid empty Writer DB v2 must verify structurally.");
if (empty.status !== "structure-verified") throw new Error("Expected empty verified summary.");
check(empty.summary.sparkCount === 0 && empty.summary.packageCount === 0, "Empty summary counts must be zero.");

const liveSpark = verify(db({ sparks: [spark()] }));
check(liveSpark.status === "structure-verified" && liveSpark.summary.sparkLiveCount === 1, "A live Spark must be counted.");
const sparkTombstone = verify(db({ sparks: [spark({ deletedAt: "2026-07-28T11:00:00.000Z" })] }));
check(sparkTombstone.status === "structure-verified" && sparkTombstone.summary.sparkTombstoneCount === 1 && sparkTombstone.summary.sparkLiveCount === 0, "A Spark tombstone must be preserved and counted.");

const livePackage = verify(db({ packages: [writerPackage()] }));
check(livePackage.status === "structure-verified" && livePackage.summary.packageLiveCount === 1, "A live Package must be counted.");
const packageTombstone = verify(db({ packages: [writerPackage({ deletedAt: "2026-07-28T11:00:00.000Z" })] }));
check(packageTombstone.status === "structure-verified" && packageTombstone.summary.packageTombstoneCount === 1 && packageTombstone.summary.packageLiveCount === 0, "A Package tombstone must be preserved and counted.");

const notes = verify(db({ packages: [writerPackage({ notes: [
  { id: "live-note", text: "Synthetic live note text", createdAt: "2026-07-28T10:00:00.000Z", updatedAt: "2026-07-28T10:00:00.000Z" },
  { id: "deleted-note", text: "Synthetic deleted note text", createdAt: "2026-07-28T10:00:00.000Z", updatedAt: "2026-07-28T11:00:00.000Z", deletedAt: "2026-07-28T11:00:00.000Z" }
] })] }));
check(notes.status === "structure-verified" && notes.summary.noteCount === 2, "All notes including deleted notes must be counted.");
check(notes.status === "structure-verified" && notes.summary.deletedNoteCount === 1, "Deleted notes must be counted separately.");

const malformed = verifyLegacySparkRetirementWriterDbV2Backup("{not-json");
check(malformed.status === "invalid" && malformed.reasons.includes("WRITER_DB_PARSE_FAILED"), "Malformed JSON must return WRITER_DB_PARSE_FAILED.");
check(hasReason({ ...db(), app: "Wrong App" }, "WRITER_DB_APP_MISMATCH"), "Wrong app must be rejected.");
check(hasReason({ app: "LassiLAB Writer", schemaVersion: 1, exportedAt: "2026-07-28T12:00:00.000Z", sparkCount: 0, sparks: [] }, "WRITER_DB_SCHEMA_MISMATCH"), "Writer DB v1 must not verify as an R2 v2 artifact.");
check(hasReason({ ...db(), schemaVersion: 99 }, "WRITER_DB_SCHEMA_MISMATCH"), "Unknown schema versions must be rejected.");
check(hasReason({ ...db(), sparks: undefined }, "WRITER_DB_CONTENT_INVALID"), "Missing sparks must be rejected.");
check(hasReason({ ...db(), packages: undefined }, "WRITER_DB_CONTENT_INVALID"), "Missing packages must be rejected.");
check(hasReason(db({ sparks: [{ ...spark(), text: 7 } as unknown as Spark] }), "WRITER_DB_CONTENT_INVALID"), "Invalid Spark records must be rejected by the existing parser.");
check(hasReason(db({ packages: [{ ...writerPackage(), packageVersion: 2 } as unknown as WriterPackage] }), "WRITER_DB_CONTENT_INVALID"), "Invalid WriterPackages must be rejected by the existing parser.");
check(hasReason(db({ sparks: [spark()], sparkCount: 0 }), "WRITER_DB_COUNT_MISMATCH"), "Spark count mismatch must be rejected.");
check(hasReason(db({ packages: [writerPackage()], packageCount: 0 }), "WRITER_DB_COUNT_MISMATCH"), "Package count mismatch must be rejected.");
check(hasReason({ ...db(), sparkCount: -1 }, "WRITER_DB_COUNT_MISMATCH"), "Invalid declared Spark count must be rejected.");
check(hasReason({ ...db(), packageCount: 1.5 }, "WRITER_DB_COUNT_MISMATCH"), "Invalid declared Package count must be rejected.");
check(hasReason(db({ sparks: [spark({ id: "duplicate" }), spark({ id: "duplicate" })] }), "DUPLICATE_SPARK_ID"), "Duplicate Spark IDs must be rejected without deduplication.");
check(hasReason(db({ packages: [writerPackage({ id: "duplicate" }), writerPackage({ id: "duplicate" })] }), "DUPLICATE_PACKAGE_ID"), "Duplicate Package IDs must be rejected without deduplication.");

const proto = verify(db({ sparks: [spark({ id: "__proto__" })], packages: [writerPackage({ id: "__proto__" })] }));
check(proto.status === "structure-verified" && proto.summary.sparkIds[0] === "__proto__" && proto.summary.packageIds[0] === "__proto__", "__proto__ must remain a safe cross-model data ID.");

const textFree = verify(db({ sparks: [spark()], packages: [writerPackage({ notes: [{ id: "note", text: "Synthetic secret note", createdAt: "2026-07-28T10:00:00.000Z", updatedAt: "2026-07-28T10:00:00.000Z" }] })] }));
const textFreeJson = JSON.stringify(textFree);
check(!textFreeJson.includes("Synthetic Spark author text"), "Verification output must not expose Spark text.");
check(!textFreeJson.includes("Synthetic Package title") && !textFreeJson.includes("Synthetic Package spark text"), "Verification output must not expose Package title or text.");
check(!textFreeJson.includes("Synthetic workshop text") && !textFreeJson.includes("Synthetic final text"), "Verification output must not expose Package layers.");
check(!textFreeJson.includes("Synthetic secret note"), "Verification output must not expose note text.");

check(hasReason({ ...db(), exportedAt: "not-a-date" }, "WRITER_DB_CONTENT_INVALID"), "Invalid exportedAt must be rejected by the existing parser.");
check(hasReason(db({ sparks: [spark({ updatedAt: "not-a-date" })] }), "WRITER_DB_CONTENT_INVALID"), "Invalid Spark timestamp must be rejected by the existing parser.");
check(hasReason(db({ packages: [writerPackage({ notes: [{ id: "note", text: "Synthetic", createdAt: "bad", updatedAt: "2026-07-28T10:00:00.000Z" }] })] }), "WRITER_DB_CONTENT_INVALID"), "Invalid note timestamp must be rejected by the existing parser.");

const sorted = verify(db({
  sparks: [spark({ id: "z" }), spark({ id: "a" })],
  packages: [writerPackage({ id: "z" }), writerPackage({ id: "a" })]
}));
check(sorted.status === "structure-verified" && sorted.summary.sparkIds.join(",") === "a,z" && sorted.summary.packageIds.join(",") === "a,z", "Summary IDs must use deterministic code-unit ordering.");
check(sorted.status === "structure-verified" && Object.isFrozen(sorted) && Object.isFrozen(sorted.summary), "Verified wrapper and summary must be frozen.");
check(sorted.status === "structure-verified" && Object.isFrozen(sorted.summary.sparkIds) && Object.isFrozen(sorted.summary.packageIds), "Summary ID arrays must be frozen.");
check(Object.isFrozen(malformed) && malformed.status === "invalid" && Object.isFrozen(malformed.reasons), "Invalid wrapper and reasons must be frozen.");
check(JSON.stringify(sorted) === JSON.stringify(verify(db({ sparks: [spark({ id: "z" }), spark({ id: "a" })], packages: [writerPackage({ id: "z" }), writerPackage({ id: "a" })] }))), "Repeated verification must be deterministic.");

const artifactStatus = textFree.status;
check(artifactStatus === "structure-verified" && artifactStatus !== ("backup-verified" as string), "Artifact structure verification must not imply overall backup-verified.");
check(!textFreeJson.includes("ready-to-delete") && !textFreeJson.includes("ready-to-create-tombstones"), "Verifier must expose no destructive readiness state.");

const sourceText = verifyLegacySparkRetirementWriterDbV2Backup.toString();
check(!/crypto|subtle|digest/i.test(sourceText), "R2.2 verifier must not use crypto.");
check(!/localStorage|sessionStorage|window|document/.test(sourceText), "R2.2 verifier must not use browser storage or globals.");
check(!/fetch|googleDrive|driveJsonRequest/.test(sourceText), "R2.2 verifier must not use network or Drive APIs.");
check(!/writeFile|createWriteStream|download|Blob/.test(sourceText), "R2.2 verifier must not write or create files.");
check(!/Date\.now|new Date\(\)/.test(sourceText), "R2.2 verifier must not obtain the current time.");
check(!/console\.|eval\(/.test(sourceText), "R2.2 verifier must not log raw JSON or use eval.");

export const legacySparkRetirementWriterDbBackupVerifierCheckCount = passed;
console.log(`Legacy Spark retirement R2.2 Writer DB verifier checks: ${passed}/${passed} passed.`);
