import type { Spark, WriterPackage } from "./types";
import { createWriterDbV2Payload } from "./writerDb";
import type { LegacySparkBackupVerificationReason } from "./legacySparkRetirementBackupPlan";
import type {
  LegacySparkRetirementLocalSnapshot,
  LegacySparkRetirementLocalSnapshotResult
} from "./legacySparkRetirementLocalSnapshot";
import { verifyLegacySparkRetirementWriterDbV2Backup } from "./legacySparkRetirementWriterDbBackupVerifier";

export type LegacySparkRetirementWriterDbBytesBuilderDependencies = Readonly<{
  encodeUtf8: (text: string) => Uint8Array;
}>;

export type LegacySparkRetirementWriterDbV2BytesSummary = Readonly<{
  schemaVersion: 2;
  exportedAt: string;
  byteLength: number;
  sparkCount: number;
  packageCount: number;
}>;

export type LegacySparkRetirementWriterDbV2BytesArtifact = Readonly<{
  summary: LegacySparkRetirementWriterDbV2BytesSummary;
  copyWriterDbV2Bytes: () => Uint8Array;
}>;

export type LegacySparkRetirementWriterDbV2BytesResult =
  | Readonly<{
      status: "writer-db-bytes-built";
      artifact: LegacySparkRetirementWriterDbV2BytesArtifact;
      nextAllowedStep: "provide-writer-db-bytes-to-backup-assembly";
    }>
  | Readonly<{
      status: "invalid";
      reasons: readonly LegacySparkBackupVerificationReason[];
    }>;

function invalid(
  reason: LegacySparkBackupVerificationReason
): LegacySparkRetirementWriterDbV2BytesResult {
  return Object.freeze({ status: "invalid" as const, reasons: Object.freeze([reason]) });
}

function cloneSpark(spark: Readonly<Spark>): Spark {
  return { ...spark, tags: [...spark.tags] };
}

function clonePackage(writerPackage: Readonly<WriterPackage>): WriterPackage {
  return {
    ...writerPackage,
    notes: writerPackage.notes.map((note) => ({ ...note })),
    ...(writerPackage.legacy ? { legacy: { ...writerPackage.legacy } } : {})
  };
}

export function buildLegacySparkRetirementWriterDbV2Bytes(
  snapshotResult: LegacySparkRetirementLocalSnapshotResult,
  dependencies: LegacySparkRetirementWriterDbBytesBuilderDependencies
): LegacySparkRetirementWriterDbV2BytesResult {
  if (snapshotResult.status !== "snapshot-captured") {
    return invalid("SNAPSHOT_NOT_CAPTURED");
  }

  let snapshot: LegacySparkRetirementLocalSnapshot;
  let jsonText: string;
  try {
    snapshot = snapshotResult.snapshot;
    const payload = createWriterDbV2Payload({
      sparks: snapshot.sparks.map(cloneSpark),
      packages: snapshot.packages.map(clonePackage),
      exportedAt: snapshot.createdAt
    });
    jsonText = JSON.stringify(payload, null, 2);
  } catch {
    return invalid("WRITER_DB_EXPORT_FAILED");
  }

  const verification = verifyLegacySparkRetirementWriterDbV2Backup(jsonText);
  if (verification.status !== "structure-verified") {
    return invalid("WRITER_DB_STRUCTURE_INVALID");
  }

  let encoded: Uint8Array;
  try {
    encoded = dependencies.encodeUtf8(jsonText);
  } catch {
    return invalid("UTF8_ENCODE_FAILED");
  }
  if (!(encoded instanceof Uint8Array)) return invalid("WRITER_DB_BYTES_INVALID");

  const internalBytes = new Uint8Array(encoded);
  const summary: LegacySparkRetirementWriterDbV2BytesSummary = Object.freeze({
    schemaVersion: 2 as const,
    exportedAt: snapshot.createdAt,
    byteLength: internalBytes.byteLength,
    sparkCount: snapshot.sparks.length,
    packageCount: snapshot.packages.length
  });
  const artifact: LegacySparkRetirementWriterDbV2BytesArtifact = Object.freeze({
    summary,
    copyWriterDbV2Bytes: () => new Uint8Array(internalBytes)
  });
  return Object.freeze({
    status: "writer-db-bytes-built" as const,
    artifact,
    nextAllowedStep: "provide-writer-db-bytes-to-backup-assembly" as const
  });
}
