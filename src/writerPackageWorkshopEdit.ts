import type { WriterPackage } from "./types";
import {
  cloneAndFreezeWriterPackageCollection,
  validateWriterPackageCollectionCompatibility
} from "./writerPackageCollectionCodec";

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

const MAX_DATE_MS = 8_640_000_000_000_000;

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
  const validation = validateWriterPackageCollectionCompatibility(input.packages);
  if (!validation.ok) {
    return blocked(
      validation.reason === "duplicate-package-id"
        ? "duplicate-package-id"
        : "invalid-package-collection"
    );
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
    const [selectedClone] = cloneAndFreezeWriterPackageCollection([selected]);
    return Object.freeze({
      status: "unchanged" as const,
      package: selectedClone
    });
  }

  const nextUpdatedAt = createNextUpdatedAt(input.now, selected.updatedAt);
  if (!nextUpdatedAt) {
    return blocked("invalid-now");
  }

  const packages = cloneAndFreezeWriterPackageCollection(
    input.packages.map((writerPackage, index) =>
      index === selectedIndex
        ? {
            ...writerPackage,
            workshopText: input.workshopText,
            updatedAt: nextUpdatedAt
          }
        : writerPackage
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
