import type { ProductShellDataMode } from "./productShellDataMode";
import {
  loadWriterLibraryReadOnly,
  type WriterLibraryReadOnlyResult,
  type WriterPackageCatalogLoader
} from "./writerLibraryReadOnlyProvider";
import type {
  WriterLibraryItem,
  WriterLibraryOrigin,
  WriterLibraryProgress
} from "./writerLibraryViewModel";

export type ProductShellData =
  | Readonly<{
      mode: "fixture";
    }>
  | Readonly<{
      mode: "real-read-only";
      library: WriterLibraryReadOnlyResult;
    }>;

export type WriterLibraryProvider = (
  loader: WriterPackageCatalogLoader
) => WriterLibraryReadOnlyResult;

export type ProductShellDataAssemblyInput =
  | Readonly<{
      dataMode: Extract<ProductShellDataMode, "fixture">;
    }>
  | Readonly<{
      dataMode: Extract<ProductShellDataMode, "real-read-only">;
      catalogLoader: WriterPackageCatalogLoader;
      provider?: WriterLibraryProvider;
    }>;

export type WriterLibraryPresentation =
  | Readonly<{
      status: "ready";
      items: readonly WriterLibraryItem[];
      continueItem: WriterLibraryItem;
    }>
  | Readonly<{
      status: "empty";
      items: readonly WriterLibraryItem[];
    }>
  | Readonly<{
      status: "failed";
    }>;

export function assembleProductShellData(
  input: ProductShellDataAssemblyInput
): ProductShellData {
  if (input.dataMode === "fixture") {
    return Object.freeze({ mode: "fixture" });
  }

  const provider = input.provider ?? loadWriterLibraryReadOnly;
  return Object.freeze({
    mode: "real-read-only",
    library: provider(input.catalogLoader)
  });
}

export function createWriterLibraryPresentation(
  result: WriterLibraryReadOnlyResult
): WriterLibraryPresentation {
  if (result.status === "failed") {
    return Object.freeze({ status: "failed" });
  }

  if (result.items.length === 0) {
    return Object.freeze({
      status: "empty",
      items: result.items
    });
  }

  return Object.freeze({
    status: "ready",
    items: result.items,
    continueItem: result.items[0]
  });
}

export function getWriterLibraryProgressLabel(
  progress: WriterLibraryProgress
): string {
  switch (progress) {
    case "final":
      return "Má Text OK";
    case "workshop":
      return "Rozpracované v Dielni";
    case "notes":
      return "Má Poznámky";
    case "spark":
      return "Zachytená Iskra";
    default:
      return "Zatiaľ bez textu";
  }
}

export function getWriterLibraryOriginLabel(
  origin: WriterLibraryOrigin
): "Pôvodná Iskra" | undefined {
  return origin === "legacy-spark" ? "Pôvodná Iskra" : undefined;
}
