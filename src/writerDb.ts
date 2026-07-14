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
