import type { Spark, WriterDbExport } from "./types";
import { verifyLegacySparkRetirementDriveV1Backup } from "./legacySparkRetirementDriveV1BackupVerifier";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function spark(overrides: Partial<Spark> = {}): Spark {
  return {
    id: "synthetic-drive-spark",
    text: "Synthetic Drive Spark author text must not enter output.",
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    temperature: "spark",
    tags: ["synthetic"],
    schemaVersion: 1,
    ...overrides
  };
}

function db(overrides: Partial<WriterDbExport> = {}): WriterDbExport {
  const sparks = overrides.sparks ?? [];
  return {
    app: "LassiLAB Writer",
    schemaVersion: 1,
    exportedAt: "2026-07-28T12:00:00.000Z",
    sparkCount: sparks.length,
    sparks,
    ...overrides
  };
}

function present(value: unknown) {
  return verifyLegacySparkRetirementDriveV1Backup({
    sourceStatus: "present",
    rawJson: JSON.stringify(value)
  });
}

function hasReason(value: unknown, reason: string) {
  const result = present(value);
  return result.status === "invalid" && result.reasons.includes(reason as never);
}

const notApplicable = verifyLegacySparkRetirementDriveV1Backup({ sourceStatus: "not-applicable" });
check(notApplicable.status === "not-applicable", "Drive not-applicable must require an explicit typed input.");
check(Object.keys(notApplicable).join(",") === "status", "Drive not-applicable must expose no filename, hash, or summary.");

const missing = verifyLegacySparkRetirementDriveV1Backup({ sourceStatus: "required-but-missing" });
check(missing.status === "invalid" && missing.reasons.includes("DRIVE_BACKUP_MISSING"), "Required missing Drive backup must be invalid.");

const empty = present(db());
check(empty.status === "structure-verified", "A valid empty Drive v1 backup must verify structurally.");
if (empty.status !== "structure-verified") throw new Error("Expected empty Drive summary.");
check(empty.summary.sparkCount === 0 && empty.summary.sparkLiveCount === 0 && empty.summary.sparkTombstoneCount === 0, "Empty Drive counts must be zero.");

const live = present(db({ sparks: [spark()] }));
check(live.status === "structure-verified" && live.summary.sparkLiveCount === 1, "A live Drive Spark must be counted.");
const tombstone = present(db({ sparks: [spark({ deletedAt: "2026-07-28T11:00:00.000Z" })] }));
check(tombstone.status === "structure-verified" && tombstone.summary.sparkTombstoneCount === 1 && tombstone.summary.sparkLiveCount === 0, "A Drive Spark tombstone must be preserved and counted.");
const mixed = present(db({ sparks: [spark({ id: "live" }), spark({ id: "deleted", deletedAt: "2026-07-28T11:00:00.000Z" })] }));
check(mixed.status === "structure-verified" && mixed.summary.sparkCount === 2 && mixed.summary.sparkLiveCount === 1 && mixed.summary.sparkTombstoneCount === 1, "Live and tombstone counts must add to total.");

const malformed = verifyLegacySparkRetirementDriveV1Backup({ sourceStatus: "present", rawJson: "{not-json" });
check(malformed.status === "invalid" && malformed.reasons.includes("DRIVE_PARSE_FAILED"), "Malformed Drive JSON must return DRIVE_PARSE_FAILED.");
check(hasReason({ ...db(), app: "Wrong App" }, "DRIVE_APP_MISMATCH"), "Wrong Drive app must be rejected.");
check(hasReason({ ...db(), schemaVersion: 2 }, "DRIVE_SCHEMA_MISMATCH"), "Writer DB v2 must not verify as Drive v1.");
check(hasReason({ ...db(), schemaVersion: 99 }, "DRIVE_SCHEMA_MISMATCH"), "Unknown Drive schemas must be rejected.");
check(hasReason({ ...db(), sparks: undefined }, "DRIVE_CONTENT_INVALID"), "Missing Drive sparks must be rejected.");
check(hasReason(db({ sparks: [{ ...spark(), temperature: "wrong" } as unknown as Spark] }), "DRIVE_CONTENT_INVALID"), "Invalid Drive Sparks must be rejected by the existing parser.");
check(hasReason(db({ sparks: [spark()], sparkCount: 0 }), "DRIVE_COUNT_MISMATCH"), "Drive count mismatch must be rejected.");
check(hasReason({ ...db(), sparkCount: -1 }, "DRIVE_COUNT_MISMATCH"), "Negative Drive count must be rejected.");
check(hasReason({ ...db(), sparkCount: 1.5 }, "DRIVE_COUNT_MISMATCH"), "Fractional Drive count must be rejected.");
check(hasReason(db({ sparks: [spark({ id: "duplicate" }), spark({ id: "duplicate" })] }), "DUPLICATE_SPARK_ID"), "Duplicate Drive Spark IDs must be rejected without merge or deduplication.");

const proto = present(db({ sparks: [spark({ id: "__proto__" })] }));
check(proto.status === "structure-verified" && proto.summary.sparkIds[0] === "__proto__", "__proto__ must remain a safe Drive Spark ID.");
check(hasReason({ ...db(), exportedAt: "not-a-date" }, "DRIVE_CONTENT_INVALID"), "Invalid Drive exportedAt must be rejected.");
check(hasReason(db({ sparks: [spark({ createdAt: "not-a-date" })] }), "DRIVE_CONTENT_INVALID"), "Invalid Drive Spark timestamps must be rejected.");
check(hasReason(db({ sparks: [spark({ deletedAt: "not-a-date" })] }), "DRIVE_CONTENT_INVALID"), "Invalid Drive tombstone timestamps must be rejected.");

const privateRaw = JSON.stringify({
  ...db({ sparks: [spark()] }),
  oauthToken: "synthetic-oauth-token",
  fileId: "synthetic-drive-file-id"
});
const textFree = verifyLegacySparkRetirementDriveV1Backup({ sourceStatus: "present", rawJson: privateRaw });
const textFreeJson = JSON.stringify(textFree);
check(!textFreeJson.includes("Synthetic Drive Spark author text"), "Drive result must not expose Spark text.");
check(!textFreeJson.includes(privateRaw), "Drive result must not expose or reproduce raw JSON.");
check(!textFreeJson.includes("synthetic-oauth-token") && !textFreeJson.includes("synthetic-drive-file-id"), "Drive result must not expose OAuth or file ID data.");

const sorted = present(db({ sparks: [spark({ id: "z" }), spark({ id: "a" })] }));
check(sorted.status === "structure-verified" && sorted.summary.sparkIds.join(",") === "a,z", "Drive Spark IDs must use deterministic code-unit ordering.");
check(sorted.status === "structure-verified" && sorted.summary.exportedAt === "2026-07-28T12:00:00.000Z", "Validated exportedAt may be preserved as safe metadata.");
check(Object.isFrozen(notApplicable), "Not-applicable result must be frozen.");
check(sorted.status === "structure-verified" && Object.isFrozen(sorted) && Object.isFrozen(sorted.summary), "Verified Drive wrapper and summary must be frozen.");
check(sorted.status === "structure-verified" && Object.isFrozen(sorted.summary.sparkIds), "Drive Spark IDs must be frozen.");
check(malformed.status === "invalid" && Object.isFrozen(malformed) && Object.isFrozen(malformed.reasons), "Invalid Drive wrapper and reasons must be frozen.");
check(JSON.stringify(sorted) === JSON.stringify(present(db({ sparks: [spark({ id: "z" }), spark({ id: "a" })] }))), "Repeated Drive verification must be deterministic.");

check(textFree.status === "structure-verified" && textFree.status !== ("raw-hash-verified" as string), "Drive structure verification must not imply raw-hash verification.");
check(textFree.status === "structure-verified" && textFree.status !== ("backup-verified" as string), "Drive structure verification must not imply overall backup-verified.");
check(!textFreeJson.includes("ready-to-create-tombstones") && !textFreeJson.includes("ready-to-delete"), "Drive verifier must expose no destructive readiness state.");

const sourceText = verifyLegacySparkRetirementDriveV1Backup.toString();
check(!/crypto|subtle|digest/i.test(sourceText), "R2.3 verifier must not use crypto.");
check(!/localStorage|sessionStorage|window|document/.test(sourceText), "R2.3 verifier must not use browser storage or globals.");
check(!/fetch|googleDrive|driveJsonRequest|syncGoogleDrive|upload/i.test(sourceText), "R2.3 verifier must not use Drive, sync, network, or upload APIs.");
check(!/writeFile|createWriteStream|download|Blob/.test(sourceText), "R2.3 verifier must not write or create files.");
check(!/merge|newest/i.test(sourceText), "R2.3 verifier must not merge or apply newest-wins logic.");
check(!/Date\.now|new Date\(\)/.test(sourceText), "R2.3 verifier must not obtain the current time.");
check(!/console\.|eval\(/.test(sourceText), "R2.3 verifier must not log raw JSON or use eval.");

export const legacySparkRetirementDriveV1BackupVerifierCheckCount = passed;
console.log(`Legacy Spark retirement R2.3 Drive v1 verifier checks: ${passed}/${passed} passed.`);
