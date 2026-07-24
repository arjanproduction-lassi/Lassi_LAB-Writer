import type {
  WriterLibraryDetail,
  WriterLibraryDetailNote
} from "./writerLibraryDetailViewModel";
import type { WriterLibraryDetailLayer } from "./writerLibraryReadOnlySelection";

export type WriterLibraryDetailLayerOption = Readonly<{
  id: WriterLibraryDetailLayer;
  label: "Iskra" | "Poznámky" | "Dielňa" | "Text OK";
}>;

export type WriterLibraryDetailLayerPresentation =
  | Readonly<{
      kind: "text";
      layer: Exclude<WriterLibraryDetailLayer, "notes">;
      label: WriterLibraryDetailLayerOption["label"];
      eyebrow: string;
      text: string;
      emptyText: string;
    }>
  | Readonly<{
      kind: "notes";
      layer: "notes";
      label: "Poznámky";
      eyebrow: string;
      notes: readonly WriterLibraryDetailNote[];
      emptyText: string;
    }>;

export const WRITER_LIBRARY_DETAIL_LAYER_OPTIONS: readonly WriterLibraryDetailLayerOption[] =
  Object.freeze([
    Object.freeze({ id: "spark", label: "Iskra" }),
    Object.freeze({ id: "notes", label: "Poznámky" }),
    Object.freeze({ id: "workshop", label: "Dielňa" }),
    Object.freeze({ id: "final", label: "Text OK" })
  ]);

export function getWriterLibraryDetailContextLayer(
  activeLayer: WriterLibraryDetailLayer
): WriterLibraryDetailLayer {
  switch (activeLayer) {
    case "spark":
      return "notes";
    case "notes":
      return "spark";
    case "workshop":
      return "notes";
    case "final":
      return "workshop";
  }
}

export function createWriterLibraryDetailLayerPresentation(
  detail: WriterLibraryDetail,
  layer: WriterLibraryDetailLayer
): WriterLibraryDetailLayerPresentation {
  switch (layer) {
    case "spark":
      return Object.freeze({
        kind: "text",
        layer,
        label: "Iskra",
        eyebrow: "Pôvodný impulz",
        text: detail.sparkText,
        emptyText: "Pôvodná iskra nemá text."
      });
    case "notes":
      return Object.freeze({
        kind: "notes",
        layer,
        label: "Poznámky",
        eyebrow: "Materiál okolo diela",
        notes: detail.notes,
        emptyText: "K tomuto dielu zatiaľ nie sú poznámky."
      });
    case "workshop":
      return Object.freeze({
        kind: "text",
        layer,
        label: "Dielňa",
        eyebrow: "Pracovný text",
        text: detail.workshopText,
        emptyText: "Pracovný text zatiaľ nie je uložený."
      });
    case "final":
      return Object.freeze({
        kind: "text",
        layer,
        label: "Text OK",
        eyebrow: "Čistá prijatá verzia",
        text: detail.finalText,
        emptyText: "Finálny text zatiaľ nie je uložený."
      });
  }
}
