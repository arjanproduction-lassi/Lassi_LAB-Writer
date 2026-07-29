import type { WriterPackage } from "./types";
import { parseWriterDbJson } from "./writerDb";
import {
  buildLegacySparkBackupFileNames,
  type LegacySparkBackupVerificationReason
} from "./legacySparkRetirementBackupPlan";
import {
  verifyLegacySparkRetirementWriterDbV2Backup,
  type WriterDbV2BackupVerificationSummary
} from "./legacySparkRetirementWriterDbBackupVerifier";
import {
  verifyLegacySparkRetirementDriveV1Backup,
  type DriveV1BackupVerificationSummary
} from "./legacySparkRetirementDriveV1BackupVerifier";
import {
  buildLegacySparkRetirementPackageBaseline,
  type LegacySparkRetirementPackageBaseline,
  type LegacySparkRetirementSha256Hasher
} from "./legacySparkRetirementPackageBaseline";

export type LegacySparkRetirementDriveBytesSource =
  | Readonly<{ sourceStatus: "present"; bytes: Uint8Array }>
  | Readonly<{ sourceStatus: "not-applicable" }>
  | Readonly<{ sourceStatus: "required-but-missing" }>;

export type LegacySparkRetirementBackupAssemblyDependencies = Readonly<{
  createWriterDbV2BackupBytes: () => Promise<Uint8Array>;
  readDriveV1BackupBytes: () => Promise<LegacySparkRetirementDriveBytesSource>;
  readCurrentWriterPackages: () => Promise<readonly WriterPackage[]>;
  readRawPackageStorageBytes?: () => Promise<Uint8Array | null>;
  decodeUtf8Strict: (bytes: Uint8Array) => string | Promise<string>;
  sha256Bytes: (bytes: Uint8Array) => string | Promise<string>;
  sha256CanonicalUtf8: LegacySparkRetirementSha256Hasher;
}>;

export type LegacySparkRetirementBackupAssemblyInput = Readonly<{
  createdAt: string;
}>;

type AssemblyDriveManifest =
  | Readonly<{
      status: "present";
      fileName: string;
      schemaVersion: 1;
      rawSha256: string;
      sparkCount: number;
      liveSparkCount: number;
      sparkTombstoneCount: number;
    }>
  | Readonly<{
      status: "not-applicable";
      fileName: null;
      schemaVersion: null;
      rawSha256: null;
      sparkCount: null;
      liveSparkCount: null;
      sparkTombstoneCount: null;
    }>;

export type LegacySparkRetirementBackupAssemblyManifest = Readonly<{
  backupVersion: 1;
  purpose: "legacy-spark-retirement-r2";
  createdAt: string;
  fileName: string;
  verificationStatus: "assembly-verified";
  writerDbV2: Readonly<{
    fileName: string;
    schemaVersion: 2;
    rawSha256: string;
    sparkCount: number;
    liveSparkCount: number;
    sparkTombstoneCount: number;
    packageCount: number;
    livePackageCount: number;
    packageTombstoneCount: number;
    noteCount: number;
    deletedNoteCount: number;
    semanticPackageSha256: string;
  }>;
  driveV1: AssemblyDriveManifest;
  packageBaseline: LegacySparkRetirementPackageBaseline;
}>;

export type LegacySparkRetirementBackupAssemblyResult =
  | Readonly<{
      status: "assembly-verified";
      manifest: LegacySparkRetirementBackupAssemblyManifest;
      nextAllowedStep: "present-backup-download";
    }>
  | Readonly<{
      status: "incomplete" | "invalid";
      reasons: readonly LegacySparkBackupVerificationReason[];
    }>;

const SHA256_HEX = /^[0-9a-f]{64}$/;

function failed(
  status: "incomplete" | "invalid",
  reasons: readonly LegacySparkBackupVerificationReason[]
): LegacySparkRetirementBackupAssemblyResult {
  return Object.freeze({
    status,
    reasons: Object.freeze([...new Set(reasons)])
  });
}

async function hashBytes(
  bytes: Uint8Array,
  hasher: LegacySparkRetirementBackupAssemblyDependencies["sha256Bytes"],
  failureReason: LegacySparkBackupVerificationReason
): Promise<string | LegacySparkRetirementBackupAssemblyResult> {
  let hash: unknown;
  try {
    hash = await hasher(new Uint8Array(bytes));
  } catch {
    return failed("invalid", [failureReason]);
  }
  return typeof hash === "string" && SHA256_HEX.test(hash)
    ? hash
    : failed("invalid", [failureReason]);
}

function baselinesMatch(
  current: LegacySparkRetirementPackageBaseline,
  backup: LegacySparkRetirementPackageBaseline
): boolean {
  return current.packageCount === backup.packageCount &&
    current.packageLiveCount === backup.packageLiveCount &&
    current.packageTombstoneCount === backup.packageTombstoneCount &&
    current.noteCount === backup.noteCount &&
    current.deletedNoteCount === backup.deletedNoteCount &&
    current.semanticPackageSha256 === backup.semanticPackageSha256 &&
    current.packageIds.length === backup.packageIds.length &&
    current.packageIds.every((id, index) => id === backup.packageIds[index]);
}

function freezeDriveManifest(
  summary: DriveV1BackupVerificationSummary,
  fileName: string,
  rawSha256: string
): AssemblyDriveManifest {
  return Object.freeze({
    status: "present" as const,
    fileName,
    schemaVersion: 1 as const,
    rawSha256,
    sparkCount: summary.sparkCount,
    liveSparkCount: summary.sparkLiveCount,
    sparkTombstoneCount: summary.sparkTombstoneCount
  });
}

export async function assembleLegacySparkRetirementBackup(
  input: LegacySparkRetirementBackupAssemblyInput,
  dependencies: LegacySparkRetirementBackupAssemblyDependencies
): Promise<LegacySparkRetirementBackupAssemblyResult> {
  let fileNames;
  try {
    fileNames = buildLegacySparkBackupFileNames(input.createdAt);
  } catch {
    return failed("invalid", ["INVALID_CREATED_AT"]);
  }

  let writerSource: Uint8Array;
  try {
    writerSource = await dependencies.createWriterDbV2BackupBytes();
  } catch {
    return failed("invalid", ["WRITER_DB_READ_FAILED"]);
  }
  if (!(writerSource instanceof Uint8Array)) {
    return failed("invalid", ["WRITER_DB_READ_FAILED"]);
  }
  const writerBytes = new Uint8Array(writerSource);
  let writerJson: string;
  try {
    writerJson = await dependencies.decodeUtf8Strict(new Uint8Array(writerBytes));
  } catch {
    return failed("invalid", ["WRITER_DB_UTF8_DECODE_FAILED"]);
  }
  if (typeof writerJson !== "string") {
    return failed("invalid", ["WRITER_DB_UTF8_DECODE_FAILED"]);
  }
  const writerVerification = verifyLegacySparkRetirementWriterDbV2Backup(writerJson);
  if (writerVerification.status !== "structure-verified") {
    return failed("invalid", writerVerification.reasons);
  }
  const parsedWriter = parseWriterDbJson(writerJson);
  if (!parsedWriter.ok || parsedWriter.db.schemaVersion !== 2) {
    return failed("invalid", ["WRITER_DB_CONTENT_INVALID"]);
  }
  const writerHash = await hashBytes(writerBytes, dependencies.sha256Bytes, "WRITER_DB_RAW_HASH_FAILED");
  if (typeof writerHash !== "string") return writerHash;

  let currentPackages: readonly WriterPackage[];
  try {
    const supplied = await dependencies.readCurrentWriterPackages();
    currentPackages = [...supplied];
  } catch {
    return failed("invalid", ["PACKAGE_READ_FAILED"]);
  }

  let rawStorageSha256: string | null = null;
  if (dependencies.readRawPackageStorageBytes) {
    let rawSource: Uint8Array | null;
    try {
      rawSource = await dependencies.readRawPackageStorageBytes();
    } catch {
      return failed("invalid", ["PACKAGE_READ_FAILED"]);
    }
    if (rawSource !== null) {
      if (!(rawSource instanceof Uint8Array)) return failed("invalid", ["PACKAGE_READ_FAILED"]);
      const rawHash = await hashBytes(new Uint8Array(rawSource), dependencies.sha256Bytes, "PACKAGE_RAW_HASH_FAILED");
      if (typeof rawHash !== "string") return rawHash;
      rawStorageSha256 = rawHash;
    }
  }

  const currentBaselineResult = await buildLegacySparkRetirementPackageBaseline({
    packages: currentPackages,
    hashCanonicalUtf8Sha256: dependencies.sha256CanonicalUtf8,
    rawStorageSha256
  });
  if (currentBaselineResult.status !== "baseline-built") {
    return failed("invalid", currentBaselineResult.reasons);
  }
  const backupBaselineResult = await buildLegacySparkRetirementPackageBaseline({
    packages: parsedWriter.db.packages,
    hashCanonicalUtf8Sha256: dependencies.sha256CanonicalUtf8,
    rawStorageSha256: null
  });
  if (backupBaselineResult.status !== "baseline-built") {
    return failed("invalid", backupBaselineResult.reasons);
  }
  if (!baselinesMatch(currentBaselineResult.baseline, backupBaselineResult.baseline)) {
    return failed("invalid", ["PACKAGE_BASELINE_MISMATCH"]);
  }

  let driveSource: LegacySparkRetirementDriveBytesSource;
  try {
    driveSource = await dependencies.readDriveV1BackupBytes();
  } catch {
    return failed("invalid", ["DRIVE_READ_FAILED"]);
  }
  if (driveSource.sourceStatus === "required-but-missing") {
    return failed("incomplete", ["DRIVE_BACKUP_MISSING"]);
  }

  let driveManifest: AssemblyDriveManifest;
  if (driveSource.sourceStatus === "not-applicable") {
    driveManifest = Object.freeze({
      status: "not-applicable" as const,
      fileName: null,
      schemaVersion: null,
      rawSha256: null,
      sparkCount: null,
      liveSparkCount: null,
      sparkTombstoneCount: null
    });
  } else {
    if (!(driveSource.bytes instanceof Uint8Array)) return failed("invalid", ["DRIVE_READ_FAILED"]);
    const driveBytes = new Uint8Array(driveSource.bytes);
    let driveJson: string;
    try {
      driveJson = await dependencies.decodeUtf8Strict(new Uint8Array(driveBytes));
    } catch {
      return failed("invalid", ["DRIVE_UTF8_DECODE_FAILED"]);
    }
    if (typeof driveJson !== "string") return failed("invalid", ["DRIVE_UTF8_DECODE_FAILED"]);
    const driveVerification = verifyLegacySparkRetirementDriveV1Backup({ sourceStatus: "present", rawJson: driveJson });
    if (driveVerification.status !== "structure-verified") {
      return failed("invalid", driveVerification.status === "invalid" ? driveVerification.reasons : ["DRIVE_CONTENT_INVALID"]);
    }
    const driveHash = await hashBytes(driveBytes, dependencies.sha256Bytes, "DRIVE_RAW_HASH_FAILED");
    if (typeof driveHash !== "string") return driveHash;
    driveManifest = freezeDriveManifest(driveVerification.summary, fileNames.driveV1Raw, driveHash);
  }

  const summary: WriterDbV2BackupVerificationSummary = writerVerification.summary;
  const writerDbV2 = Object.freeze({
    fileName: fileNames.writerDbV2,
    schemaVersion: 2 as const,
    rawSha256: writerHash,
    sparkCount: summary.sparkCount,
    liveSparkCount: summary.sparkLiveCount,
    sparkTombstoneCount: summary.sparkTombstoneCount,
    packageCount: summary.packageCount,
    livePackageCount: summary.packageLiveCount,
    packageTombstoneCount: summary.packageTombstoneCount,
    noteCount: summary.noteCount,
    deletedNoteCount: summary.deletedNoteCount,
    semanticPackageSha256: currentBaselineResult.baseline.semanticPackageSha256
  });
  const manifest: LegacySparkRetirementBackupAssemblyManifest = Object.freeze({
    backupVersion: 1 as const,
    purpose: "legacy-spark-retirement-r2" as const,
    createdAt: input.createdAt,
    fileName: fileNames.manifest,
    verificationStatus: "assembly-verified" as const,
    writerDbV2,
    driveV1: driveManifest,
    packageBaseline: currentBaselineResult.baseline
  });
  return Object.freeze({
    status: "assembly-verified" as const,
    manifest,
    nextAllowedStep: "present-backup-download" as const
  });
}
