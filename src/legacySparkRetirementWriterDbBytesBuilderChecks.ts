import type { Spark, WriterPackage, WriterPackageNote } from "./types";
import { verifyLegacySparkRetirementWriterDbV2Backup } from "./legacySparkRetirementWriterDbBackupVerifier";
import {
  captureLegacySparkRetirementLocalSnapshotFromRaw,
  type LegacySparkRetirementLocalSnapshotInput,
  type LegacySparkRetirementLocalSnapshotResult,
  type LegacySparkRetirementRawStorageValue
} from "./legacySparkRetirementLocalSnapshot";
import {
  buildLegacySparkRetirementWriterDbV2Bytes,
  type LegacySparkRetirementWriterDbV2BytesResult
} from "./legacySparkRetirementWriterDbBytesBuilder";

const CREATED_AT = "2026-07-30T12:00:00.000Z";
const missing = (): LegacySparkRetirementRawStorageValue => ({ status: "missing" });
const present = (value: unknown): LegacySparkRetirementRawStorageValue => ({ status: "present", raw: JSON.stringify(value) });
function spark(overrides: Partial<Spark> = {}): Spark {
  return { id: "spark-a", text: "Synthetic Spark text", createdAt: CREATED_AT, updatedAt: CREATED_AT, temperature: "spark", tags: ["synthetic"], schemaVersion: 1, ...overrides };
}
function note(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return { id: "note-a", text: "Synthetic note text", createdAt: CREATED_AT, updatedAt: CREATED_AT, ...overrides };
}
function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return { id: "package-a", title: "Synthetic title", sparkText: "Synthetic package spark", notes: [], workshopText: "Synthetic workshop", finalText: "Synthetic final", createdAt: CREATED_AT, updatedAt: CREATED_AT, packageVersion: 1, ...overrides };
}
function snapshot(overrides: Partial<LegacySparkRetirementLocalSnapshotInput> = {}) {
  return captureLegacySparkRetirementLocalSnapshotFromRaw({ createdAt: CREATED_AT, sparks: missing(), packages: missing(), draft: missing(), ...overrides });
}
function asciiEncode(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text, (character) => character.charCodeAt(0)));
}
function asciiDecode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}
function build(snapshotResult: LegacySparkRetirementLocalSnapshotResult, encodeUtf8 = asciiEncode) {
  return buildLegacySparkRetirementWriterDbV2Bytes(snapshotResult, { encodeUtf8 });
}
function hasReason(result: LegacySparkRetirementWriterDbV2BytesResult, reason: string) {
  return result.status === "invalid" && result.reasons.includes(reason as never);
}
let passed = 0;
function check(condition: boolean, message: string) { if (!condition) throw new Error(message); passed += 1; }

const missingResult = snapshot();
const emptyBuilt = build(missingResult);
check(emptyBuilt.status === "writer-db-bytes-built", "Missing collections build an empty v2 DB.");
if (emptyBuilt.status !== "writer-db-bytes-built") throw new Error("Expected bytes.");
const emptyJson = asciiDecode(emptyBuilt.artifact.copyWriterDbV2Bytes());
const emptyPayload = JSON.parse(emptyJson);
check(emptyPayload.schemaVersion === 2 && emptyPayload.app === "LassiLAB Writer", "Exact Writer DB v2 envelope reused.");
check(emptyPayload.sparkCount === 0 && emptyPayload.packageCount === 0, "Empty counts match.");
check(Array.isArray(emptyPayload.sparks) && Array.isArray(emptyPayload.packages), "Empty arrays present.");
const storedEmptySnapshot = snapshot({ sparks: present([]), packages: present([]) });
const storedEmptyBuilt = build(storedEmptySnapshot);
check(storedEmptyBuilt.status === "writer-db-bytes-built", "Stored empty arrays build.");
check(storedEmptyBuilt.status === "writer-db-bytes-built" && asciiDecode(storedEmptyBuilt.artifact.copyWriterDbV2Bytes()) === emptyJson, "Missing and stored empty produce equal DB collections.");
check(missingResult.status === "snapshot-captured" && storedEmptySnapshot.status === "snapshot-captured" && missingResult.snapshot.sparkStorage.status !== storedEmptySnapshot.snapshot.sparkStorage.status, "Builder does not merge snapshot storage metadata.");

const contentSnapshot = snapshot({
  sparks: present([spark({ id: "z" }), spark({ id: "a", deletedAt: CREATED_AT })]),
  packages: present([
    writerPackage({ id: "z", legacy: { source: "spark", stage: "notes" }, notes: [note(), note({ id: "deleted-note", deletedAt: CREATED_AT })] }),
    writerPackage({ id: "a", deletedAt: CREATED_AT })
  ])
});
let encodedText = "";
const contentBuilt = build(contentSnapshot, (text) => { encodedText = text; return asciiEncode(text); });
check(contentBuilt.status === "writer-db-bytes-built", "Content snapshot builds.");
if (contentBuilt.status !== "writer-db-bytes-built") throw new Error("Expected content bytes.");
const payload = JSON.parse(encodedText);
check(payload.exportedAt === CREATED_AT, "exportedAt comes exactly from snapshot.");
check(payload.schemaVersion === 2, "schemaVersion is exactly 2.");
check(payload.sparkCount === 2 && payload.packageCount === 2, "Counts derive from arrays.");
check(payload.sparks.map((item: Spark) => item.id).join(",") === "z,a", "Spark order preserved.");
check(payload.packages.map((item: WriterPackage) => item.id).join(",") === "z,a", "Package order preserved.");
check(payload.sparks[1].deletedAt === CREATED_AT, "Spark tombstone preserved.");
check(payload.packages[1].deletedAt === CREATED_AT, "Package tombstone preserved.");
check(payload.packages[0].notes.length === 2 && payload.packages[0].notes[1].deletedAt === CREATED_AT, "Notes and deleted notes preserved.");
check(payload.packages[0].legacy.source === "spark" && payload.packages[0].legacy.stage === "notes", "Legacy metadata preserved.");
check(payload.sparks[0].createdAt === CREATED_AT && payload.packages[0].updatedAt === CREATED_AT, "Timestamps preserved.");
check(encodedText.includes("\n  \"app\"") && encodedText.includes("\n    {"), "JSON uses two-space pretty print.");
check(!encodedText.endsWith("\n") && !encodedText.endsWith("\r"), "JSON has no trailing newline.");
check(asciiDecode(contentBuilt.artifact.copyWriterDbV2Bytes()) === encodedText, "Encoder receives exact returned JSON.");
check(verifyLegacySparkRetirementWriterDbV2Backup(encodedText).status === "structure-verified", "R2.2 accepts generated JSON.");

const deterministicAgain = build(contentSnapshot);
check(deterministicAgain.status === "writer-db-bytes-built" && asciiDecode(deterministicAgain.artifact.copyWriterDbV2Bytes()) === encodedText, "Same snapshot produces deterministic JSON and bytes.");
check(contentBuilt.artifact.summary.schemaVersion === 2 && contentBuilt.artifact.summary.exportedAt === CREATED_AT, "Summary schema/time correct.");
check(contentBuilt.artifact.summary.sparkCount === 2 && contentBuilt.artifact.summary.packageCount === 2, "Summary counts correct.");
check(contentBuilt.artifact.summary.byteLength === contentBuilt.artifact.copyWriterDbV2Bytes().byteLength, "Summary byteLength correct.");

const throwingEncoder = build(missingResult, () => { throw new Error("private encoder failure"); });
check(hasReason(throwingEncoder, "UTF8_ENCODE_FAILED"), "Encoder throw becomes typed invalid.");
const invalidEncoder = buildLegacySparkRetirementWriterDbV2Bytes(missingResult, { encodeUtf8: (() => "bad") as unknown as (text: string) => Uint8Array });
check(hasReason(invalidEncoder, "WRITER_DB_BYTES_INVALID"), "Invalid encoder type becomes typed invalid.");
const incompleteSnapshot = snapshot({ draft: { status: "present", raw: JSON.stringify({ text: "private draft", updatedAt: CREATED_AT, schemaVersion: 1 }) } });
check(hasReason(build(incompleteSnapshot), "SNAPSHOT_NOT_CAPTURED"), "Only captured snapshots are accepted.");
const forgedSnapshot = { status: "snapshot-captured", get snapshot() { throw new Error("private snapshot failure"); }, summary: {} } as unknown as LegacySparkRetirementLocalSnapshotResult;
check(hasReason(build(forgedSnapshot), "WRITER_DB_EXPORT_FAILED"), "Export failure is typed without exception text.");

const mutableEncoded = asciiEncode(emptyJson);
const copiedArtifact = build(missingResult, () => mutableEncoded);
check(copiedArtifact.status === "writer-db-bytes-built", "Mutable encoder bytes accepted through copy boundary.");
if (copiedArtifact.status !== "writer-db-bytes-built") throw new Error("Expected copied bytes.");
mutableEncoded.fill(0);
check(asciiDecode(copiedArtifact.artifact.copyWriterDbV2Bytes()) === emptyJson, "Later encoder-buffer mutation cannot affect artifact.");
const copyA = copiedArtifact.artifact.copyWriterDbV2Bytes();
const copyB = copiedArtifact.artifact.copyWriterDbV2Bytes();
check(copyA !== copyB && copyA.buffer !== copyB.buffer, "Each byte request returns a new copy.");
copyA.fill(0);
check(asciiDecode(copiedArtifact.artifact.copyWriterDbV2Bytes()) === emptyJson, "Returned-copy mutation cannot affect future copies.");

const snapshotBefore = JSON.stringify(contentSnapshot);
build(contentSnapshot);
check(JSON.stringify(contentSnapshot) === snapshotBefore, "Builder does not mutate snapshot result.");
const publicJson = JSON.stringify(contentBuilt);
check(!publicJson.includes(encodedText) && !publicJson.includes("Synthetic Spark text"), "Result excludes JSON and Spark text.");
check(!publicJson.includes("Synthetic title") && !publicJson.includes("Synthetic note text"), "Result excludes Package and note text.");
check(!publicJson.includes("private encoder failure") && !publicJson.includes("private snapshot failure"), "Result excludes exception text.");
check(Object.isFrozen(contentBuilt) && Object.isFrozen(contentBuilt.artifact), "Result and artifact frozen.");
check(Object.isFrozen(contentBuilt.artifact.summary), "Summary frozen.");
check(throwingEncoder.status === "invalid" && Object.isFrozen(throwingEncoder) && Object.isFrozen(throwingEncoder.reasons), "Invalid result and reasons frozen.");
check(contentBuilt.status !== ("backup-verified" as string) && contentBuilt.status !== ("assembly-verified" as string), "Bytes-built is not a stronger status.");
check(contentBuilt.nextAllowedStep === "provide-writer-db-bytes-to-backup-assembly", "Only assembly handoff is allowed.");
check(!publicJson.includes("ready-to-create-tombstones") && !publicJson.includes("completed"), "Builder permits no R3.");

const sourceText = buildLegacySparkRetirementWriterDbV2Bytes.toString();
check(!/localStorage|sessionStorage|window|document/.test(sourceText), "No storage/browser access.");
check(!/TextEncoder|crypto|subtle|digest/.test(sourceText), "No direct encoder or crypto.");
check(!/fetch|googleDrive|driveJsonRequest/.test(sourceText), "No Drive/network.");
check(!/Blob|FileReader|createObjectURL|React/.test(sourceText), "No Blob/download/UI.");
check(!/setItem|removeItem|writeFile|unlink/.test(sourceText), "No writes.");
check(!/console\./.test(sourceText), "No logging.");

export const legacySparkRetirementWriterDbBytesBuilderCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3b Writer DB bytes checks: ${passed}/${passed} passed.`);
