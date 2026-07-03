import type { Spark, SparkInput } from "./types";

const STORAGE_KEY = "lassilab-writer:v0.1:sparks";
const SCHEMA_VERSION = 1;

function readRawSparks(): Spark[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSpark) : [];
  } catch {
    return [];
  }
}

function writeRawSparks(sparks: Spark[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sparks));
}

function isSpark(value: unknown): value is Spark {
  if (!value || typeof value !== "object") {
    return false;
  }

  const spark = value as Partial<Spark>;
  return (
    typeof spark.id === "string" &&
    typeof spark.text === "string" &&
    typeof spark.createdAt === "string" &&
    typeof spark.updatedAt === "string" &&
    spark.schemaVersion === SCHEMA_VERSION
  );
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function listSparks(): Spark[] {
  return readRawSparks().sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
}

export function getSpark(id: string): Spark | undefined {
  return readRawSparks().find((spark) => spark.id === id);
}

export function saveSpark(input: SparkInput): Spark {
  const now = new Date().toISOString();
  const sparks = readRawSparks();
  const existing = input.id ? sparks.find((spark) => spark.id === input.id) : undefined;

  const saved: Spark = {
    id: existing?.id ?? createId(),
    title: input.title?.trim() || undefined,
    text: input.text.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    temperature: "spark",
    tags: existing?.tags ?? [],
    schemaVersion: SCHEMA_VERSION
  };

  const next = existing
    ? sparks.map((spark) => (spark.id === saved.id ? saved : spark))
    : [saved, ...sparks];

  writeRawSparks(next);
  return saved;
}
