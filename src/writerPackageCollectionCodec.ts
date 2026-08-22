import type {
  SparkStage,
  WriterPackage,
  WriterPackageLegacyMetadata,
  WriterPackageNote
} from "./types";

export type WriterPackageCollectionFailureReason =
  | "malformed-json"
  | "package-storage-not-array"
  | "unsupported-package-shape"
  | "unsupported-package-version"
  | "invalid-package"
  | "duplicate-package-id";

export type WriterPackageCollectionValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      reason: Exclude<WriterPackageCollectionFailureReason, "malformed-json">;
    }>;

export type WriterPackageCollectionParseResult =
  | Readonly<{
      ok: true;
      packages: readonly Readonly<WriterPackage>[];
    }>
  | Readonly<{
      ok: false;
      reason: WriterPackageCollectionFailureReason;
    }>;

export type WriterPackageCollectionSerializeResult =
  | Readonly<{
      ok: true;
      raw: string;
    }>
  | Readonly<{
      ok: false;
      reason: Exclude<
        WriterPackageCollectionFailureReason,
        "malformed-json" | "package-storage-not-array"
      >;
    }>;

const WRITER_PACKAGE_VERSION = 1;
const SPARK_STAGES = new Set<SparkStage>(["spark", "notes", "workshop", "final"]);
const PACKAGE_REQUIRED_KEYS = Object.freeze([
  "id",
  "title",
  "sparkText",
  "notes",
  "workshopText",
  "finalText",
  "createdAt",
  "updatedAt",
  "packageVersion"
]);
const PACKAGE_OPTIONAL_KEYS = Object.freeze(["deletedAt", "legacy"]);
const NOTE_REQUIRED_KEYS = Object.freeze(["id", "text", "createdAt", "updatedAt"]);
const NOTE_OPTIONAL_KEYS = Object.freeze(["deletedAt"]);
const LEGACY_REQUIRED_KEYS = Object.freeze(["source"]);
const LEGACY_OPTIONAL_KEYS = Object.freeze(["stage"]);

function failure<TReason extends WriterPackageCollectionFailureReason>(
  reason: TReason
): Readonly<{ ok: false; reason: TReason }> {
  return Object.freeze({ ok: false as const, reason });
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isWriterPackageNote(value: unknown): value is WriterPackageNote {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.text === "string" &&
    isValidDateString(value.createdAt) &&
    isValidDateString(value.updatedAt) &&
    (value.deletedAt === undefined || isValidDateString(value.deletedAt))
  );
}

function isWriterPackageLegacyMetadata(
  value: unknown
): value is WriterPackageLegacyMetadata {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.source === "spark" &&
    (value.stage === undefined || SPARK_STAGES.has(value.stage as SparkStage))
  );
}

function isWriterPackage(value: unknown): value is WriterPackage {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.title === "string" &&
    typeof value.sparkText === "string" &&
    Array.isArray(value.notes) &&
    value.notes.every(isWriterPackageNote) &&
    typeof value.workshopText === "string" &&
    typeof value.finalText === "string" &&
    isValidDateString(value.createdAt) &&
    isValidDateString(value.updatedAt) &&
    (value.deletedAt === undefined || isValidDateString(value.deletedAt)) &&
    value.packageVersion === WRITER_PACKAGE_VERSION &&
    (value.legacy === undefined || isWriterPackageLegacyMetadata(value.legacy))
  );
}

function hasCanonicalKeys(
  value: object,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[]
): boolean {
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  if (
    Reflect.ownKeys(value).some(
      (key) => typeof key !== "string" || !allowedKeys.has(key)
    )
  ) {
    return false;
  }

  if (requiredKeys.some((key) => !hasOwn(value, key))) {
    return false;
  }

  return optionalKeys.every(
    (key) => !hasOwn(value, key) || (value as Record<string, unknown>)[key] !== undefined
  );
}

function hasCanonicalPackageShape(writerPackage: WriterPackage): boolean {
  if (
    !hasCanonicalKeys(
      writerPackage,
      PACKAGE_REQUIRED_KEYS,
      PACKAGE_OPTIONAL_KEYS
    )
  ) {
    return false;
  }

  for (const note of writerPackage.notes) {
    if (!hasCanonicalKeys(note, NOTE_REQUIRED_KEYS, NOTE_OPTIONAL_KEYS)) {
      return false;
    }
  }

  return (
    writerPackage.legacy === undefined ||
    hasCanonicalKeys(
      writerPackage.legacy,
      LEGACY_REQUIRED_KEYS,
      LEGACY_OPTIONAL_KEYS
    )
  );
}

export function validateWriterPackageCollectionCompatibility(
  value: unknown
): WriterPackageCollectionValidationResult {
  if (!Array.isArray(value)) {
    return failure("package-storage-not-array");
  }

  const packageIds = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const candidate = value[index];
    if (
      isObject(candidate) &&
      hasOwn(candidate, "packageVersion") &&
      candidate.packageVersion !== WRITER_PACKAGE_VERSION
    ) {
      return failure("unsupported-package-version");
    }

    if (!isWriterPackage(candidate)) {
      return failure("invalid-package");
    }

    if (packageIds.has(candidate.id)) {
      return failure("duplicate-package-id");
    }
    packageIds.add(candidate.id);
  }

  return Object.freeze({ ok: true as const });
}

function validateWriterPackageCollectionStrict(
  value: unknown
): WriterPackageCollectionValidationResult {
  const compatibility = validateWriterPackageCollectionCompatibility(value);
  if (!compatibility.ok) {
    return compatibility;
  }

  for (const writerPackage of value as WriterPackage[]) {
    if (!hasCanonicalPackageShape(writerPackage)) {
      return failure("unsupported-package-shape");
    }
  }

  return Object.freeze({ ok: true as const });
}

function cloneAndFreezeNote(
  note: Readonly<WriterPackageNote>
): WriterPackageNote {
  return Object.freeze({ ...note });
}

function cloneAndFreezePackage(
  writerPackage: Readonly<WriterPackage>
): WriterPackage {
  const notes = Object.freeze(
    writerPackage.notes.map(cloneAndFreezeNote)
  ) as WriterPackageNote[];
  const legacy = writerPackage.legacy
    ? Object.freeze({ ...writerPackage.legacy })
    : undefined;

  return Object.freeze({
    ...writerPackage,
    notes,
    ...(legacy ? { legacy } : {})
  });
}

export function cloneAndFreezeWriterPackageCollection(
  packages: readonly Readonly<WriterPackage>[]
): readonly Readonly<WriterPackage>[] {
  return Object.freeze(packages.map(cloneAndFreezePackage));
}

function canonicalNote(note: Readonly<WriterPackageNote>): WriterPackageNote {
  return {
    id: note.id,
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    ...(note.deletedAt !== undefined ? { deletedAt: note.deletedAt } : {})
  };
}

function canonicalPackage(
  writerPackage: Readonly<WriterPackage>
): WriterPackage {
  return {
    id: writerPackage.id,
    title: writerPackage.title,
    sparkText: writerPackage.sparkText,
    notes: writerPackage.notes.map(canonicalNote),
    workshopText: writerPackage.workshopText,
    finalText: writerPackage.finalText,
    createdAt: writerPackage.createdAt,
    updatedAt: writerPackage.updatedAt,
    ...(writerPackage.deletedAt !== undefined
      ? { deletedAt: writerPackage.deletedAt }
      : {}),
    packageVersion: writerPackage.packageVersion,
    ...(writerPackage.legacy
      ? {
          legacy: {
            source: writerPackage.legacy.source,
            ...(writerPackage.legacy.stage !== undefined
              ? { stage: writerPackage.legacy.stage }
              : {})
          }
        }
      : {})
  };
}

export function parseWriterPackageCollectionJsonStrict(
  raw: string
): WriterPackageCollectionParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure("malformed-json");
  }

  const validation = validateWriterPackageCollectionStrict(parsed);
  if (!validation.ok) {
    return validation;
  }

  return Object.freeze({
    ok: true as const,
    packages: cloneAndFreezeWriterPackageCollection(parsed as WriterPackage[])
  });
}

export function serializeWriterPackageCollection(
  packages: readonly Readonly<WriterPackage>[]
): WriterPackageCollectionSerializeResult {
  const validation = validateWriterPackageCollectionStrict(packages);
  if (!validation.ok) {
    switch (validation.reason) {
      case "package-storage-not-array":
        return failure("invalid-package");
      case "unsupported-package-shape":
      case "unsupported-package-version":
      case "invalid-package":
      case "duplicate-package-id":
        return failure(validation.reason);
    }
  }

  try {
    return Object.freeze({
      ok: true as const,
      raw: JSON.stringify(packages.map(canonicalPackage))
    });
  } catch {
    return failure("invalid-package");
  }
}
