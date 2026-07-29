import type { Spark, WriterPackage, WriterPackageNote } from "./types";
import {
  assembleLegacySparkRetirementBackup,
  type LegacySparkRetirementBackupAssemblyDependencies,
  type LegacySparkRetirementBackupAssemblyResult,
  type LegacySparkRetirementDriveBytesSource
} from "./legacySparkRetirementBackupAssembly";

const CREATED_AT = "2026-07-28T12:34:56.000Z";

function note(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return { id: "note-a", text: "Synthetic note", createdAt: CREATED_AT, updatedAt: CREATED_AT, ...overrides };
}

function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "package-a", title: "Synthetic title", sparkText: "Synthetic spark",
    notes: [note()], workshopText: "Synthetic workshop", finalText: "Synthetic final",
    createdAt: CREATED_AT, updatedAt: CREATED_AT, packageVersion: 1, ...overrides
  };
}

function spark(overrides: Partial<Spark> = {}): Spark {
  return {
    id: "spark-a", text: "Synthetic Spark content", createdAt: CREATED_AT,
    updatedAt: CREATED_AT, temperature: "spark", tags: ["synthetic"], schemaVersion: 1,
    ...overrides
  };
}

function writerJson(packages: readonly WriterPackage[] = [writerPackage()]): string {
  return JSON.stringify({
    app: "LassiLAB Writer", schemaVersion: 2, exportedAt: CREATED_AT,
    sparkCount: 1, packageCount: packages.length, sparks: [spark()], packages
  });
}

function driveJson(): string {
  return JSON.stringify({
    app: "LassiLAB Writer", schemaVersion: 1, exportedAt: CREATED_AT,
    sparkCount: 1, sparks: [spark({ id: "drive-spark" })]
  });
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function fakeHashText(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return Array.from({ length: 8 }, (_, index) =>
    ((value + Math.imul(index + 1, 0x9e3779b1)) >>> 0).toString(16).padStart(8, "0")
  ).join("");
}

function fakeHashBytes(bytes: Uint8Array): string {
  return fakeHashText(Array.from(bytes).join(","));
}

function dependencies(
  overrides: Partial<LegacySparkRetirementBackupAssemblyDependencies> = {}
): LegacySparkRetirementBackupAssemblyDependencies {
  return {
    createWriterDbV2BackupBytes: async () => encode(writerJson()),
    readDriveV1BackupBytes: async () => ({ sourceStatus: "not-applicable" }),
    readCurrentWriterPackages: async () => [writerPackage()],
    decodeUtf8Strict: (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    sha256Bytes: fakeHashBytes,
    sha256CanonicalUtf8: fakeHashText,
    ...overrides
  };
}

function hasReason(result: LegacySparkRetirementBackupAssemblyResult, reason: string): boolean {
  return result.status !== "assembly-verified" && result.reasons.includes(reason as never);
}

async function runChecks(): Promise<number> {
  let passed = 0;
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
    passed += 1;
  };
  const assemble = (overrides: Partial<LegacySparkRetirementBackupAssemblyDependencies> = {}) =>
    assembleLegacySparkRetirementBackup({ createdAt: CREATED_AT }, dependencies(overrides));

  const noDrive = await assemble();
  check(noDrive.status === "assembly-verified", "Valid Writer DB with Drive not-applicable verifies.");
  if (noDrive.status !== "assembly-verified") throw new Error("Expected assembly success.");
  check(noDrive.manifest.driveV1.status === "not-applicable", "Drive not-applicable remains explicit.");
  check(noDrive.manifest.driveV1.fileName === null && noDrive.manifest.driveV1.rawSha256 === null, "Drive not-applicable has no filename/hash.");
  check(noDrive.manifest.driveV1.sparkCount === null, "Drive not-applicable has no summary.");

  const present = await assemble({ readDriveV1BackupBytes: async () => ({ sourceStatus: "present", bytes: encode(driveJson()) }) });
  check(present.status === "assembly-verified", "Valid present Drive verifies.");
  if (present.status !== "assembly-verified") throw new Error("Expected Drive success.");
  check(present.manifest.driveV1.status === "present" && present.manifest.driveV1.schemaVersion === 1, "Drive structure summary retained.");
  check(present.manifest.driveV1.rawSha256 === fakeHashBytes(encode(driveJson())), "Drive hash uses exact bytes.");
  check(present.manifest.writerDbV2.rawSha256 === fakeHashBytes(encode(writerJson())), "Writer hash uses exact bytes.");

  const missing = await assemble({ readDriveV1BackupBytes: async () => ({ sourceStatus: "required-but-missing" }) });
  check(missing.status === "incomplete" && hasReason(missing, "DRIVE_BACKUP_MISSING"), "Required missing Drive is incomplete.");
  check(hasReason(await assemble({ createWriterDbV2BackupBytes: async () => encode("invalid") }), "WRITER_DB_PARSE_FAILED"), "Invalid Writer DB is invalid.");
  check(hasReason(await assemble({ readDriveV1BackupBytes: async () => ({ sourceStatus: "present", bytes: encode("invalid") }) }), "DRIVE_PARSE_FAILED"), "Invalid Drive is invalid.");
  check(hasReason(await assemble({ createWriterDbV2BackupBytes: async () => { throw new Error("private writer error"); } }), "WRITER_DB_READ_FAILED"), "Writer read throw typed.");
  check(hasReason(await assemble({ readDriveV1BackupBytes: async () => { throw new Error("private drive error"); } }), "DRIVE_READ_FAILED"), "Drive read throw typed.");
  check(hasReason(await assemble({ readCurrentWriterPackages: async () => { throw new Error("private package error"); } }), "PACKAGE_READ_FAILED"), "Package read throw typed.");

  check(hasReason(await assemble({ decodeUtf8Strict: () => { throw new Error("private decode error"); } }), "WRITER_DB_UTF8_DECODE_FAILED"), "Writer decode throw typed.");
  let decodeCalls = 0;
  check(hasReason(await assemble({
    readDriveV1BackupBytes: async () => ({ sourceStatus: "present", bytes: encode(driveJson()) }),
    decodeUtf8Strict: (bytes) => { decodeCalls += 1; if (decodeCalls === 2) throw new Error("private drive decode"); return new TextDecoder().decode(bytes); }
  }), "DRIVE_UTF8_DECODE_FAILED"), "Drive decode throw typed.");

  check(hasReason(await assemble({ sha256Bytes: () => { throw new Error("private byte hash"); } }), "WRITER_DB_RAW_HASH_FAILED"), "Byte hasher throw typed.");
  check(hasReason(await assemble({ sha256Bytes: () => Promise.reject(new Error("private reject")) }), "WRITER_DB_RAW_HASH_FAILED"), "Rejected byte hash typed.");
  check(hasReason(await assemble({ sha256Bytes: () => "INVALID" }), "WRITER_DB_RAW_HASH_FAILED"), "Invalid raw hash typed.");
  check(hasReason(await assemble({ sha256CanonicalUtf8: () => { throw new Error("private canonical"); } }), "PACKAGE_SEMANTIC_HASH_FAILED"), "Canonical throw typed.");
  check(hasReason(await assemble({ sha256CanonicalUtf8: () => Promise.reject(new Error("private canonical reject")) }), "PACKAGE_SEMANTIC_HASH_FAILED"), "Canonical reject typed.");
  check(hasReason(await assemble({ sha256CanonicalUtf8: async () => "INVALID" }), "PACKAGE_SEMANTIC_HASH_INVALID"), "Invalid canonical hash typed.");

  check(noDrive.manifest.packageBaseline.semanticPackageSha256 === noDrive.manifest.writerDbV2.semanticPackageSha256, "Current and backup baselines match.");
  check(hasReason(await assemble({ readCurrentWriterPackages: async () => [writerPackage({ title: "changed" })] }), "PACKAGE_BASELINE_MISMATCH"), "Package text mutation mismatches.");
  check(hasReason(await assemble({ readCurrentWriterPackages: async () => [writerPackage({ notes: [note({ text: "changed" })] })] }), "PACKAGE_BASELINE_MISMATCH"), "Note mutation mismatches.");
  check(hasReason(await assemble({ readCurrentWriterPackages: async () => [writerPackage({ deletedAt: CREATED_AT })] }), "PACKAGE_BASELINE_MISMATCH"), "Package tombstone mutation mismatches.");
  check(hasReason(await assemble({ readCurrentWriterPackages: async () => [writerPackage({ id: "other" })] }), "PACKAGE_BASELINE_MISMATCH"), "Package ID mismatch detected.");
  const twoPackages = [writerPackage({ id: "a" }), writerPackage({ id: "b" })];
  const reordered = await assemble({
    createWriterDbV2BackupBytes: async () => encode(writerJson(twoPackages)),
    readCurrentWriterPackages: async () => [...twoPackages].reverse()
  });
  check(reordered.status === "assembly-verified", "Package input order does not mismatch.");
  const orderedNotes = writerPackage({ notes: [note({ id: "a" }), note({ id: "b" })] });
  check(hasReason(await assemble({
    createWriterDbV2BackupBytes: async () => encode(writerJson([orderedNotes])),
    readCurrentWriterPackages: async () => [writerPackage({ notes: [note({ id: "b" }), note({ id: "a" })] })]
  }), "PACKAGE_BASELINE_MISMATCH"), "Note order mismatch detected.");

  const rawPackageBytes = encode("exact synthetic raw package storage");
  const withRaw = await assemble({ readRawPackageStorageBytes: async () => rawPackageBytes });
  check(withRaw.status === "assembly-verified" && withRaw.manifest.packageBaseline.rawStorageSha256 === fakeHashBytes(rawPackageBytes), "Raw Package bytes create exact hash.");
  const nullRaw = await assemble({ readRawPackageStorageBytes: async () => null });
  check(nullRaw.status === "assembly-verified" && nullRaw.manifest.packageBaseline.rawStorageSha256 === null, "Null raw Package bytes are valid.");
  check(hasReason(await assemble({ readRawPackageStorageBytes: async () => { throw new Error("private raw read"); } }), "PACKAGE_READ_FAILED"), "Raw Package read throw typed.");

  const writerOriginal = encode(writerJson());
  const expectedWriterHash = fakeHashBytes(writerOriginal);
  let writerHashSawCopy = false;
  const copiedWriter = await assemble({
    createWriterDbV2BackupBytes: async () => writerOriginal,
    sha256Bytes: async (bytes) => {
      if (!writerHashSawCopy) {
        writerHashSawCopy = bytes !== writerOriginal;
        writerOriginal.fill(0);
        await Promise.resolve();
      }
      return fakeHashBytes(bytes);
    }
  });
  check(writerHashSawCopy, "Writer bytes are copied before hashing.");
  check(copiedWriter.status === "assembly-verified" && copiedWriter.manifest.writerDbV2.rawSha256 === expectedWriterHash, "Original Writer mutation cannot affect copied hash.");

  const driveOriginal = encode(driveJson());
  const expectedDriveHash = fakeHashBytes(driveOriginal);
  let driveHashSawCopy = false;
  const copiedDrive = await assemble({
    readDriveV1BackupBytes: async () => ({ sourceStatus: "present", bytes: driveOriginal }),
    sha256Bytes: async (bytes) => {
      if (bytes.length === driveOriginal.length && !driveHashSawCopy) {
        driveHashSawCopy = bytes !== driveOriginal;
        driveOriginal.fill(0);
      }
      return fakeHashBytes(bytes);
    }
  });
  check(driveHashSawCopy, "Drive bytes are copied before hashing.");
  check(copiedDrive.status === "assembly-verified" && copiedDrive.manifest.driveV1.status === "present" && copiedDrive.manifest.driveV1.rawSha256 === expectedDriveHash, "Original Drive mutation cannot affect copied hash.");

  const json = JSON.stringify(present);
  check(!json.includes("Synthetic title") && !json.includes("Synthetic Spark content"), "Manifest is text-free.");
  check(!json.includes("Synthetic note") && !json.includes("Synthetic workshop"), "Manifest excludes Package/note text.");
  check(!json.includes(writerJson()) && !json.includes(driveJson()), "Result excludes raw JSON.");
  check(!json.includes("bytes") && !json.includes("canonicalUtf8Text"), "Result excludes bytes and canonical text.");
  check(!json.includes("private writer error") && !json.includes("private canonical"), "Result excludes exception text.");
  check(noDrive.status === "assembly-verified" && noDrive.status !== ("backup-verified" as string), "assembly-verified is not backup-verified.");
  check(noDrive.nextAllowedStep === "present-backup-download", "Only download presentation is next.");
  check(!json.includes("ready-to-create-tombstones") && !json.includes("ready-to-delete") && !json.includes("completed"), "Assembly permits no R3/destructive state.");
  check(Object.isFrozen(noDrive) && Object.isFrozen(noDrive.manifest) && Object.isFrozen(noDrive.manifest.writerDbV2), "Result and manifest are frozen.");
  check(Object.isFrozen(noDrive.manifest.driveV1) && Object.isFrozen(noDrive.manifest.packageBaseline) && Object.isFrozen(noDrive.manifest.packageBaseline.packageIds), "Nested manifest is frozen.");
  check(Object.isFrozen(missing) && missing.status === "incomplete" && Object.isFrozen(missing.reasons), "Failure reasons are frozen.");
  check(JSON.stringify(await assemble()) === JSON.stringify(await assemble()), "Repeated assembly is deterministic.");

  const sourceText = assembleLegacySparkRetirementBackup.toString();
  check(!/localStorage|sessionStorage|setItem|removeItem/.test(sourceText), "Assembly has no storage runtime.");
  check(!/fetch|googleDrive|driveJsonRequest|upload/.test(sourceText), "Assembly has no Drive/network runtime.");
  check(!/crypto|subtle|digest|node:crypto/.test(sourceText), "Assembly imports no crypto.");
  check(!/Blob|URL\.createObjectURL|document|React|anchor\.click/.test(sourceText), "Assembly has no UI/browser download.");
  check(!/writeFile|createWriteStream|unlink|rmSync/.test(sourceText), "Assembly writes nothing.");
  check(!/Date\.now|new Date\(\)/.test(sourceText), "Assembly obtains no current time.");
  check(!/console\./.test(sourceText), "Assembly logs nothing.");

  console.log(`Legacy Spark retirement R2.5 backup assembly checks: ${passed}/${passed} passed.`);
  return passed;
}

export const legacySparkRetirementBackupAssemblyCheckCount = runChecks();
