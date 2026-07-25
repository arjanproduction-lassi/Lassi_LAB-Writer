import type { Spark, WriterDbExport, WriterPackage } from "./types";
import type { WriterDbV2 } from "./writerDb";

export type LegacySparkInventorySourceKind =
  | "local-device"
  | "google-drive"
  | "imported-backup";

export type LegacySparkInventorySource = Readonly<{
  sourceId: string;
  sourceKind: LegacySparkInventorySourceKind;
  sparks: readonly Spark[];
}>;

export type LegacySparkInventorySourceSummary = Readonly<{
  sourceId: string;
  sourceKind: LegacySparkInventorySourceKind;
  sparkCount: number;
  liveSparkCount: number;
  tombstoneCount: number;
}>;

export type LegacySparkInventoryIdSummary = Readonly<{
  id: string;
  latestUpdatedAt: string;
  liveSourceIds: readonly string[];
  tombstoneSourceIds: readonly string[];
}>;

export type LegacySparkRetirementInventory = Readonly<{
  status: "ready-for-backup";
  sources: readonly LegacySparkInventorySourceSummary[];
  sparkIds: readonly LegacySparkInventoryIdSummary[];
  uniqueSparkIds: readonly string[];
  liveSparkCount: number;
  tombstoneCount: number;
  packageCount: number;
  draftPresent: boolean;
  resurrectionRisk: boolean;
}>;

export type BuildLegacySparkRetirementInventoryInput = Readonly<{
  sources: readonly LegacySparkInventorySource[];
  packages: readonly WriterPackage[];
  draftPresent: boolean;
}>;

type MutableIdSummary = {
  latestUpdatedAt: string;
  latestUpdatedAtMs: number;
  liveSourceIds: string[];
  tombstoneSourceIds: string[];
};

function assertNonEmptySourceId(sourceId: string) {
  if (sourceId.trim().length === 0) {
    throw new Error("Legacy Spark inventory sourceId must not be empty.");
  }
}

function copySource(
  sourceId: string,
  sourceKind: LegacySparkInventorySourceKind,
  sparks: readonly Spark[]
): LegacySparkInventorySource {
  assertNonEmptySourceId(sourceId);
  return Object.freeze({
    sourceId,
    sourceKind,
    sparks: Object.freeze([...sparks])
  });
}

export function createLocalLegacySparkInventorySource(
  sourceId: string,
  sparks: readonly Spark[]
): LegacySparkInventorySource {
  return copySource(sourceId, "local-device", sparks);
}

export function createGoogleDriveLegacySparkInventorySource(
  sourceId: string,
  db: WriterDbExport
): LegacySparkInventorySource {
  return copySource(sourceId, "google-drive", db.sparks);
}

export function createWriterDbV2BackupLegacySparkInventorySource(
  sourceId: string,
  db: WriterDbV2
): LegacySparkInventorySource {
  return copySource(sourceId, "imported-backup", db.sparks);
}

export function buildLegacySparkRetirementInventory(
  input: BuildLegacySparkRetirementInventoryInput
): LegacySparkRetirementInventory {
  const sourceIds = new Set<string>();
  const packageIds = new Set<string>();
  const bySparkId = new Map<string, MutableIdSummary>();
  const sources: LegacySparkInventorySourceSummary[] = [];

  for (const writerPackage of input.packages) {
    if (packageIds.has(writerPackage.id)) {
      throw new Error(`Duplicate WriterPackage id in retirement inventory: ${writerPackage.id}`);
    }
    packageIds.add(writerPackage.id);
  }

  for (const source of input.sources) {
    assertNonEmptySourceId(source.sourceId);
    if (sourceIds.has(source.sourceId)) {
      throw new Error(`Duplicate retirement inventory sourceId: ${source.sourceId}`);
    }
    sourceIds.add(source.sourceId);

    const sparkIdsInSource = new Set<string>();
    let liveSparkCount = 0;
    let tombstoneCount = 0;

    for (const spark of source.sparks) {
      if (sparkIdsInSource.has(spark.id)) {
        throw new Error(
          `Duplicate Spark id ${spark.id} in retirement inventory source ${source.sourceId}`
        );
      }
      sparkIdsInSource.add(spark.id);

      if (spark.deletedAt === undefined) {
        liveSparkCount += 1;
      } else {
        tombstoneCount += 1;
      }

      const updatedAtMs = Date.parse(spark.updatedAt);
      const existing = bySparkId.get(spark.id);
      if (!existing) {
        bySparkId.set(spark.id, {
          latestUpdatedAt: spark.updatedAt,
          latestUpdatedAtMs: updatedAtMs,
          liveSourceIds: spark.deletedAt === undefined ? [source.sourceId] : [],
          tombstoneSourceIds: spark.deletedAt === undefined ? [] : [source.sourceId]
        });
        continue;
      }

      if (updatedAtMs > existing.latestUpdatedAtMs) {
        existing.latestUpdatedAt = spark.updatedAt;
        existing.latestUpdatedAtMs = updatedAtMs;
      }
      if (spark.deletedAt === undefined) {
        existing.liveSourceIds.push(source.sourceId);
      } else {
        existing.tombstoneSourceIds.push(source.sourceId);
      }
    }

    sources.push(Object.freeze({
      sourceId: source.sourceId,
      sourceKind: source.sourceKind,
      sparkCount: source.sparks.length,
      liveSparkCount,
      tombstoneCount
    }));
  }

  const uniqueSparkIds = [...bySparkId.keys()].sort((a, b) => a.localeCompare(b));
  const sparkIds = uniqueSparkIds.map((id) => {
    const summary = bySparkId.get(id);
    if (!summary) {
      throw new Error(`Missing retirement inventory summary for Spark id: ${id}`);
    }
    return Object.freeze({
      id,
      latestUpdatedAt: summary.latestUpdatedAt,
      liveSourceIds: Object.freeze([...summary.liveSourceIds]),
      tombstoneSourceIds: Object.freeze([...summary.tombstoneSourceIds])
    });
  });
  const liveSparkCount = sparkIds.filter((summary) => summary.liveSourceIds.length > 0).length;
  const tombstoneCount = sparkIds.filter(
    (summary) => summary.tombstoneSourceIds.length > 0
  ).length;

  return Object.freeze({
    status: "ready-for-backup" as const,
    sources: Object.freeze(sources),
    sparkIds: Object.freeze(sparkIds),
    uniqueSparkIds: Object.freeze(uniqueSparkIds),
    liveSparkCount,
    tombstoneCount,
    packageCount: input.packages.length,
    draftPresent: input.draftPresent,
    resurrectionRisk: liveSparkCount > 0
  });
}
