import type { WriterLibraryDetail } from "./writerLibraryDetailViewModel";
import type { WriterLibraryReadOnlySnapshot } from "./writerLibraryReadOnlySnapshot";

export type WriterLibraryDetailLayer =
  | "spark"
  | "notes"
  | "workshop"
  | "final";

export type WriterLibraryReadOnlySelectionState = Readonly<{
  selectedPackageId: string | null;
  activeLayer: WriterLibraryDetailLayer;
}>;

export type WriterLibraryReadOnlyResolvedSelection =
  | Readonly<{
      status: "library";
    }>
  | Readonly<{
      status: "detail";
      detail: WriterLibraryDetail;
      activeLayer: WriterLibraryDetailLayer;
    }>
  | Readonly<{
      status: "missing-detail";
      selectedPackageId: string;
    }>;

export function createWriterLibraryReadOnlySelectionState(): WriterLibraryReadOnlySelectionState {
  return Object.freeze({
    selectedPackageId: null,
    activeLayer: "spark"
  });
}

export function selectWriterLibraryDetail(
  state: WriterLibraryReadOnlySelectionState,
  packageId: string
): WriterLibraryReadOnlySelectionState {
  return Object.freeze({
    ...state,
    selectedPackageId: packageId,
    activeLayer: "spark"
  });
}

export function setWriterLibraryDetailLayer(
  state: WriterLibraryReadOnlySelectionState,
  layer: WriterLibraryDetailLayer
): WriterLibraryReadOnlySelectionState {
  return Object.freeze({
    ...state,
    activeLayer: layer
  });
}

export function returnToWriterLibrary(
  state: WriterLibraryReadOnlySelectionState
): WriterLibraryReadOnlySelectionState {
  return Object.freeze({
    ...state,
    selectedPackageId: null,
    activeLayer: "spark"
  });
}

export function resolveWriterLibraryReadOnlySelection(
  snapshot: WriterLibraryReadOnlySnapshot,
  state: WriterLibraryReadOnlySelectionState
): WriterLibraryReadOnlyResolvedSelection {
  if (state.selectedPackageId === null) {
    return Object.freeze({ status: "library" });
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      snapshot.detailsById,
      state.selectedPackageId
    )
  ) {
    return Object.freeze({
      status: "missing-detail",
      selectedPackageId: state.selectedPackageId
    });
  }

  return Object.freeze({
    status: "detail",
    detail: snapshot.detailsById[state.selectedPackageId],
    activeLayer: state.activeLayer
  });
}
