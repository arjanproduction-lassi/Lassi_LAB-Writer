import type { Spark, SparkStage, WriterPackage } from "./types";
import { isWriterPackage } from "./writerPackageStorage";

export const WRITER_DB_APP_NAME = "LassiLAB Writer";
export const WRITER_DB_V1_SCHEMA_VERSION = 1;
export const WRITER_DB_V2_SCHEMA_VERSION = 2;

const SPARK_SCHEMA_VERSION = 1;
const SPARK_STAGES = new Set<SparkStage>(["spark", "notes", "workshop", "final"]);

export interface WriterDbV1 {
  app: typeof WRITER_DB_APP_NAME;
  schemaVersion: typeof WRITER_DB_V1_SCHEMA_VERSION;
  exportedAt: string;
  sparkCount: number;
  sparks: Spark[];
}

export interface WriterDbV2 {
  app: typeof WRITER_DB_APP_NAME;
  schemaVersion: typeof WRITER_DB_V2_SCHEMA_VERSION;
  exportedAt: string;
  sparkCount: number;
  packageCount: number;
  sparks: Spark[];
  packages: WriterPackage[];
}

export type WriterDb = WriterDbV1 | WriterDbV2;

export type WriterDbParseResult =
  | { ok: true; db: WriterDb }
  | { ok: false; error: string };

export interface ImportCollectionPreview {
  mode: "merge" | "untouched";
  incoming: number;
  create: number;
  update: number;
  unchanged: number;
  ignoredOlder: number;
  tombstones: number;
}

export type WriterDbImportWarning =
  | { code: "v1-packages-untouched"; message: string }
  | {
      code: "count-mismatch";
      collection: "sparks" | "packages";
      declared: number;
      actual: number;
      message: string;
    }
  | { code: "cross-model-id-overlap"; count: number; message: string }
  | {
      code: "contains-tombstones";
      sparks: number;
      packages: number;
      message: string;
    }
  | { code: "empty-import"; message: string };

export type WriterDbImportBlockingIssue = {
  code: "duplicate-spark-id" | "duplicate-package-id";
  count: number;
  message: string;
};

export interface WriterDbImportPreview {
  schemaVersion: typeof WRITER_DB_V1_SCHEMA_VERSION | typeof WRITER_DB_V2_SCHEMA_VERSION;
  status: "ready" | "blocked";
  source: {
    declaredSparkCount: number;
    actualSparkCount: number;
    declaredPackageCount: number | null;
    actualPackageCount: number;
  };
  sparks: ImportCollectionPreview;
  packages: ImportCollectionPreview;
  warnings: WriterDbImportWarning[];
  blockingIssues: WriterDbImportBlockingIssue[];
}

export interface WriterDbImportInput {
  incoming: WriterDb;
  localSparks: readonly Spark[];
  localPackages: readonly WriterPackage[];
}

export type WriterDbInMemoryMergeResult =
  | {
      ok: true;
      sparks: Spark[];
      packages: WriterPackage[];
      preview: WriterDbImportPreview;
    }
  | {
      ok: false;
      preview: WriterDbImportPreview;
      error: string;
    };

type WriterDbV2PayloadInput = {
  sparks: Spark[];
  packages: WriterPackage[];
  exportedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isSparkStage(value: unknown): value is SparkStage {
  return typeof value === "string" && SPARK_STAGES.has(value as SparkStage);
}

function isSpark(value: unknown): value is Spark {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    (value.title === undefined || typeof value.title === "string") &&
    typeof value.text === "string" &&
    isValidDateString(value.createdAt) &&
    isValidDateString(value.updatedAt) &&
    (value.deletedAt === undefined || isValidDateString(value.deletedAt)) &&
    (value.stage === undefined || isSparkStage(value.stage)) &&
    value.temperature === "spark" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    value.schemaVersion === SPARK_SCHEMA_VERSION
  );
}

function validateSparks(value: unknown): { ok: true; sparks: Spark[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Writer DB musi obsahovat pole sparks." };
  }

  const sparks: Spark[] = [];

  for (const [index, candidate] of value.entries()) {
    if (!isSpark(candidate)) {
      return { ok: false, error: `Neplatny Spark zaznam na indexe ${index}.` };
    }

    sparks.push(candidate);
  }

  return { ok: true, sparks };
}

function validatePackages(
  value: unknown
): { ok: true; packages: WriterPackage[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Writer DB v2 musi obsahovat pole packages." };
  }

  const packages: WriterPackage[] = [];

  for (const [index, candidate] of value.entries()) {
    if (!isWriterPackage(candidate)) {
      return { ok: false, error: `Neplatny WriterPackage zaznam na indexe ${index}.` };
    }

    packages.push(candidate);
  }

  return { ok: true, packages };
}

export function createWriterDbV2Payload(input: WriterDbV2PayloadInput): WriterDbV2 {
  const sparks = [...input.sparks];
  const packages = [...input.packages];

  return {
    app: WRITER_DB_APP_NAME,
    schemaVersion: WRITER_DB_V2_SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    sparkCount: sparks.length,
    packageCount: packages.length,
    sparks,
    packages
  };
}

type PreviewRecord = {
  id: string;
  updatedAt: string;
  deletedAt?: string;
};

function previewCollection<T extends PreviewRecord>(
  incoming: readonly T[],
  local: readonly T[]
): ImportCollectionPreview {
  const localById = new Map(local.map((item) => [item.id, item]));
  const preview: ImportCollectionPreview = {
    mode: "merge",
    incoming: incoming.length,
    create: 0,
    update: 0,
    unchanged: 0,
    ignoredOlder: 0,
    tombstones: 0
  };

  for (const candidate of incoming) {
    if (candidate.deletedAt !== undefined) {
      preview.tombstones += 1;
    }

    const existing = localById.get(candidate.id);
    if (!existing) {
      preview.create += 1;
      continue;
    }

    const incomingUpdatedAt = Date.parse(candidate.updatedAt);
    const localUpdatedAt = Date.parse(existing.updatedAt);

    if (incomingUpdatedAt > localUpdatedAt) {
      preview.update += 1;
    } else if (incomingUpdatedAt === localUpdatedAt) {
      preview.unchanged += 1;
    } else {
      preview.ignoredOlder += 1;
    }
  }

  return preview;
}

function createUntouchedPreview(): ImportCollectionPreview {
  return {
    mode: "untouched",
    incoming: 0,
    create: 0,
    update: 0,
    unchanged: 0,
    ignoredOlder: 0,
    tombstones: 0
  };
}

function countDistinctDuplicateIds(records: readonly PreviewRecord[]) {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const record of records) {
    if (seen.has(record.id)) {
      duplicateIds.add(record.id);
    } else {
      seen.add(record.id);
    }
  }

  return duplicateIds.size;
}

export function previewWriterDbImport(input: WriterDbImportInput): WriterDbImportPreview {
  const { incoming, localSparks, localPackages } = input;
  const incomingPackages = incoming.schemaVersion === WRITER_DB_V2_SCHEMA_VERSION
    ? incoming.packages
    : [];
  const sparks = previewCollection(incoming.sparks, localSparks);
  const packages = incoming.schemaVersion === WRITER_DB_V2_SCHEMA_VERSION
    ? previewCollection(incomingPackages, localPackages)
    : createUntouchedPreview();
  const warnings: WriterDbImportWarning[] = [];
  const blockingIssues: WriterDbImportBlockingIssue[] = [];

  if (incoming.schemaVersion === WRITER_DB_V1_SCHEMA_VERSION) {
    warnings.push({
      code: "v1-packages-untouched",
      message: "Writer DB v1 neobsahuje WriterPackages; lokalne baliky zostanu nedotknute."
    });
  }

  if (incoming.sparkCount !== incoming.sparks.length) {
    warnings.push({
      code: "count-mismatch",
      collection: "sparks",
      declared: incoming.sparkCount,
      actual: incoming.sparks.length,
      message: "Deklarovany sparkCount nesedi s poctom Sparks."
    });
  }

  if (
    incoming.schemaVersion === WRITER_DB_V2_SCHEMA_VERSION &&
    incoming.packageCount !== incoming.packages.length
  ) {
    warnings.push({
      code: "count-mismatch",
      collection: "packages",
      declared: incoming.packageCount,
      actual: incoming.packages.length,
      message: "Deklarovany packageCount nesedi s poctom WriterPackages."
    });
  }

  const sparkIds = new Set(localSparks.map((spark) => spark.id));
  for (const spark of incoming.sparks) {
    sparkIds.add(spark.id);
  }

  const packageIds = new Set(localPackages.map((writerPackage) => writerPackage.id));
  for (const writerPackage of incomingPackages) {
    packageIds.add(writerPackage.id);
  }

  let crossModelIdCount = 0;
  for (const id of sparkIds) {
    if (packageIds.has(id)) {
      crossModelIdCount += 1;
    }
  }

  if (crossModelIdCount > 0) {
    warnings.push({
      code: "cross-model-id-overlap",
      count: crossModelIdCount,
      message: "Rovnake id existuje medzi Sparks a WriterPackages."
    });
  }

  if (sparks.tombstones > 0 || packages.tombstones > 0) {
    warnings.push({
      code: "contains-tombstones",
      sparks: sparks.tombstones,
      packages: packages.tombstones,
      message: "Import obsahuje tombstone zaznamy."
    });
  }

  if (incoming.sparks.length === 0 && incomingPackages.length === 0) {
    warnings.push({
      code: "empty-import",
      message: "Import neobsahuje ziadne Sparks ani WriterPackages."
    });
  }

  const duplicateSparkIdCount = countDistinctDuplicateIds(incoming.sparks);
  if (duplicateSparkIdCount > 0) {
    blockingIssues.push({
      code: "duplicate-spark-id",
      count: duplicateSparkIdCount,
      message: "Incoming Sparks obsahuju duplicitne id."
    });
  }

  const duplicatePackageIdCount = countDistinctDuplicateIds(incomingPackages);
  if (duplicatePackageIdCount > 0) {
    blockingIssues.push({
      code: "duplicate-package-id",
      count: duplicatePackageIdCount,
      message: "Incoming WriterPackages obsahuju duplicitne id."
    });
  }

  return {
    schemaVersion: incoming.schemaVersion,
    status: blockingIssues.length > 0 ? "blocked" : "ready",
    source: {
      declaredSparkCount: incoming.sparkCount,
      actualSparkCount: incoming.sparks.length,
      declaredPackageCount: incoming.schemaVersion === WRITER_DB_V2_SCHEMA_VERSION
        ? incoming.packageCount
        : null,
      actualPackageCount: incomingPackages.length
    },
    sparks,
    packages,
    warnings,
    blockingIssues
  };
}

function cloneSpark(spark: Spark): Spark {
  return {
    ...spark,
    tags: [...spark.tags]
  };
}

function cloneWriterPackage(writerPackage: WriterPackage): WriterPackage {
  return {
    ...writerPackage,
    notes: writerPackage.notes.map((note) => ({ ...note })),
    ...(writerPackage.legacy ? { legacy: { ...writerPackage.legacy } } : {})
  };
}

function mergeCollection<T extends PreviewRecord>(
  incoming: readonly T[],
  local: readonly T[],
  clone: (record: T) => T
): T[] {
  const merged = local.map(clone);
  const indexById = new Map<string, number>();

  for (const [index, record] of local.entries()) {
    indexById.set(record.id, index);
  }

  for (const candidate of incoming) {
    const existingIndex = indexById.get(candidate.id);
    if (existingIndex === undefined) {
      indexById.set(candidate.id, merged.length);
      merged.push(clone(candidate));
      continue;
    }

    const existing = merged[existingIndex];
    if (Date.parse(candidate.updatedAt) > Date.parse(existing.updatedAt)) {
      merged[existingIndex] = clone(candidate);
    }
  }

  return merged;
}

function validateMergeResult(
  sparks: readonly Spark[],
  packages: readonly WriterPackage[]
): string | undefined {
  const sparkResult = validateSparks(sparks);
  if (!sparkResult.ok) {
    return `Neplatny Spark vo vysledku merge: ${sparkResult.error}`;
  }

  const packageResult = validatePackages(packages);
  if (!packageResult.ok) {
    return `Neplatny WriterPackage vo vysledku merge: ${packageResult.error}`;
  }

  if (countDistinctDuplicateIds(sparks) > 0) {
    return "Vysledok merge obsahuje duplicitne Spark id.";
  }

  if (countDistinctDuplicateIds(packages) > 0) {
    return "Vysledok merge obsahuje duplicitne WriterPackage id.";
  }

  return undefined;
}

export function mergeWriterDbInMemory(
  input: WriterDbImportInput
): WriterDbInMemoryMergeResult {
  const preview = previewWriterDbImport(input);
  if (preview.status === "blocked") {
    return {
      ok: false,
      preview,
      error: "Import preview je blokovany a merge sa nevykonal."
    };
  }

  const sparks = mergeCollection(input.incoming.sparks, input.localSparks, cloneSpark);
  const packages = input.incoming.schemaVersion === WRITER_DB_V2_SCHEMA_VERSION
    ? mergeCollection(input.incoming.packages, input.localPackages, cloneWriterPackage)
    : input.localPackages.map(cloneWriterPackage);
  const validationError = validateMergeResult(sparks, packages);

  if (validationError) {
    return {
      ok: false,
      preview,
      error: validationError
    };
  }

  return {
    ok: true,
    sparks,
    packages,
    preview
  };
}

export function parseWriterDbPayload(value: unknown): WriterDbParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Writer DB payload musi byt objekt." };
  }

  if (value.app !== WRITER_DB_APP_NAME) {
    return { ok: false, error: "Neplatna aplikacia Writer DB." };
  }

  if (value.schemaVersion !== WRITER_DB_V1_SCHEMA_VERSION && value.schemaVersion !== WRITER_DB_V2_SCHEMA_VERSION) {
    return { ok: false, error: "Nepodporovana verzia Writer DB." };
  }

  if (!isValidDateString(value.exportedAt)) {
    return { ok: false, error: "Writer DB ma neplatny exportedAt." };
  }

  if (!isNonNegativeInteger(value.sparkCount)) {
    return { ok: false, error: "Writer DB ma neplatny sparkCount." };
  }

  const sparkResult = validateSparks(value.sparks);
  if (!sparkResult.ok) {
    return sparkResult;
  }

  if (value.schemaVersion === WRITER_DB_V1_SCHEMA_VERSION) {
    return {
      ok: true,
      db: {
        app: WRITER_DB_APP_NAME,
        schemaVersion: WRITER_DB_V1_SCHEMA_VERSION,
        exportedAt: value.exportedAt,
        sparkCount: value.sparkCount,
        sparks: sparkResult.sparks
      }
    };
  }

  if (!isNonNegativeInteger(value.packageCount)) {
    return { ok: false, error: "Writer DB v2 ma neplatny packageCount." };
  }

  const packageResult = validatePackages(value.packages);
  if (!packageResult.ok) {
    return packageResult;
  }

  return {
    ok: true,
    db: {
      app: WRITER_DB_APP_NAME,
      schemaVersion: WRITER_DB_V2_SCHEMA_VERSION,
      exportedAt: value.exportedAt,
      sparkCount: value.sparkCount,
      packageCount: value.packageCount,
      sparks: sparkResult.sparks,
      packages: packageResult.packages
    }
  };
}

export function parseWriterDbJson(jsonText: string): WriterDbParseResult {
  try {
    return parseWriterDbPayload(JSON.parse(jsonText));
  } catch {
    return { ok: false, error: "Neplatny JSON Writer DB." };
  }
}
