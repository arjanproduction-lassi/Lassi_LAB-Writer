import type {
  SparkStage,
  WriterPackage,
  WriterPackageLegacyMetadata,
  WriterPackageNote
} from "./types";

export type PlanWriterPackageWorkshopEditInput = Readonly<{
  packages: readonly Readonly<WriterPackage>[];
  packageId: string;
  expectedUpdatedAt: string;
  workshopText: string;
  now: string;
}>;

export type WriterPackageWorkshopEditBlockedReason =
  | "invalid-package-collection"
  | "duplicate-package-id"
  | "package-not-found"
  | "package-deleted"
  | "stale-revision"
  | "invalid-now";

export type WriterPackageWorkshopEditPlan =
  | Readonly<{
      status: "ready";
      packages: readonly Readonly<WriterPackage>[];
      updatedPackage: Readonly<WriterPackage>;
      previousUpdatedAt: string;
      nextUpdatedAt: string;
    }>
  | Readonly<{
      status: "unchanged";
      package: Readonly<WriterPackage>;
    }>
  | Readonly<{
      status: "blocked";
      reason: WriterPackageWorkshopEditBlockedReason;
    }>;

const WRITER_PACKAGE_VERSION = 1;
const MAX_DATE_MS = 8_640_000_000_000_000;
const SPARK_STAGES = new Set<SparkStage>(["spark", "notes", "workshop", "final"]);

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isWriterPackageNote(value: unknown): value is WriterPackageNote {
  if (!value || typeof value !== "object") {
    return false;
  }

  const note = value as Partial<WriterPackageNote>;
  return (
    typeof note.id === "string" &&
    note.id.trim().length > 0 &&
    typeof note.text === "string" &&
    isValidDateString(note.createdAt) &&
    isValidDateString(note.updatedAt) &&
    (note.deletedAt === undefined || isValidDateString(note.deletedAt))
  );
}

function isWriterPackageLegacyMetadata(
  value: unknown
): value is WriterPackageLegacyMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const legacy = value as Partial<WriterPackageLegacyMetadata>;
  return (
    legacy.source === "spark" &&
    (legacy.stage === undefined || SPARK_STAGES.has(legacy.stage))
  );
}

function isWriterPackage(value: unknown): value is WriterPackage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const writerPackage = value as Partial<WriterPackage>;
  return (
    typeof writerPackage.id === "string" &&
    writerPackage.id.trim().length > 0 &&
    typeof writerPackage.title === "string" &&
    typeof writerPackage.sparkText === "string" &&
    Array.isArray(writerPackage.notes) &&
    writerPackage.notes.every(isWriterPackageNote) &&
    typeof writerPackage.workshopText === "string" &&
    typeof writerPackage.finalText === "string" &&
    isValidDateString(writerPackage.createdAt) &&
    isValidDateString(writerPackage.updatedAt) &&
    (writerPackage.deletedAt === undefined ||
      isValidDateString(writerPackage.deletedAt)) &&
    writerPackage.packageVersion === WRITER_PACKAGE_VERSION &&
    (writerPackage.legacy === undefined ||
      isWriterPackageLegacyMetadata(writerPackage.legacy))
  );
}

function cloneNote(note: Readonly<WriterPackageNote>): WriterPackageNote {
  return Object.freeze({ ...note });
}

function clonePackage(writerPackage: Readonly<WriterPackage>): WriterPackage {
  const notes = Object.freeze(writerPackage.notes.map(cloneNote)) as WriterPackageNote[];
  const legacy = writerPackage.legacy
    ? Object.freeze({ ...writerPackage.legacy })
    : undefined;

  return Object.freeze({
    ...writerPackage,
    notes,
    ...(legacy ? { legacy } : {})
  });
}

function blocked(
  reason: WriterPackageWorkshopEditBlockedReason
): WriterPackageWorkshopEditPlan {
  return Object.freeze({ status: "blocked" as const, reason });
}

function createNextUpdatedAt(now: string, currentUpdatedAt: string): string | undefined {
  const nowMs = Date.parse(now);
  const currentMs = Date.parse(currentUpdatedAt);

  if (!Number.isFinite(nowMs) || !Number.isFinite(currentMs)) {
    return undefined;
  }

  const nextMs = nowMs > currentMs ? nowMs : currentMs + 1;
  if (nextMs > MAX_DATE_MS) {
    return undefined;
  }

  return new Date(nextMs).toISOString();
}

export function planWriterPackageWorkshopEdit(
  input: PlanWriterPackageWorkshopEditInput
): WriterPackageWorkshopEditPlan {
  if (!Array.isArray(input.packages) || !input.packages.every(isWriterPackage)) {
    return blocked("invalid-package-collection");
  }

  const ids = new Set<string>();
  for (const writerPackage of input.packages) {
    if (ids.has(writerPackage.id)) {
      return blocked("duplicate-package-id");
    }
    ids.add(writerPackage.id);
  }

  const selectedIndex = input.packages.findIndex(
    (writerPackage) => writerPackage.id === input.packageId
  );
  if (selectedIndex < 0) {
    return blocked("package-not-found");
  }

  const selected = input.packages[selectedIndex];
  if (selected.deletedAt !== undefined) {
    return blocked("package-deleted");
  }

  if (selected.updatedAt !== input.expectedUpdatedAt) {
    return blocked("stale-revision");
  }

  if (selected.workshopText === input.workshopText) {
    return Object.freeze({
      status: "unchanged" as const,
      package: clonePackage(selected)
    });
  }

  const nextUpdatedAt = createNextUpdatedAt(input.now, selected.updatedAt);
  if (!nextUpdatedAt) {
    return blocked("invalid-now");
  }

  const packages = Object.freeze(
    input.packages.map((writerPackage, index) =>
      clonePackage(
        index === selectedIndex
          ? {
              ...writerPackage,
              workshopText: input.workshopText,
              updatedAt: nextUpdatedAt
            }
          : writerPackage
      )
    )
  );
  const updatedPackage = packages[selectedIndex];

  return Object.freeze({
    status: "ready" as const,
    packages,
    updatedPackage,
    previousUpdatedAt: selected.updatedAt,
    nextUpdatedAt
  });
}
