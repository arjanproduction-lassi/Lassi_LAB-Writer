import type { WriterPackage } from "./types";
import {
  createWriterLibraryReadOnlySelectionState,
  resolveWriterLibraryReadOnlySelection,
  returnToWriterLibrary,
  selectWriterLibraryDetail,
  setWriterLibraryDetailLayer
} from "./writerLibraryReadOnlySelection";
import { buildWriterLibraryReadOnlySnapshot } from "./writerLibraryReadOnlySnapshot";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function createPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "artificial-package",
    title: "Artificial package",
    sparkText: "Artificial spark.",
    notes: [],
    workshopText: "Artificial workshop.",
    finalText: "Artificial final.",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

const snapshot = buildWriterLibraryReadOnlySnapshot([createPackage()]);
const snapshotBefore = JSON.stringify(snapshot);
const detailsBefore = JSON.stringify(snapshot.detailsById);
const initialState = createWriterLibraryReadOnlySelectionState();
const initialResolved = resolveWriterLibraryReadOnlySelection(
  snapshot,
  initialState
);

check(
  initialState.selectedPackageId === null &&
    initialState.activeLayer === "spark" &&
    initialResolved.status === "library",
  "Initial state must resolve to the Library with the spark layer reset."
);
check(Object.isFrozen(initialState), "Initial state must be frozen.");

const stateBeforeSelect = JSON.stringify(initialState);
const selectedState = selectWriterLibraryDetail(
  initialState,
  "artificial-package"
);
check(
  selectedState.selectedPackageId === "artificial-package",
  "Selecting a detail must store only its ID in the new state."
);
const previouslyLayeredState = setWriterLibraryDetailLayer(
  selectedState,
  "final"
);
const reselectedState = selectWriterLibraryDetail(
  previouslyLayeredState,
  "artificial-package"
);
check(
  reselectedState.activeLayer === "spark",
  "Selecting a work must reset the active layer to spark."
);
check(
  JSON.stringify(initialState) === stateBeforeSelect,
  "Selecting a detail must not mutate the input state."
);

const selectedResolved = resolveWriterLibraryReadOnlySelection(
  snapshot,
  selectedState
);
check(
  selectedResolved.status === "detail",
  "An existing selected ID must resolve to detail."
);
check(
  selectedResolved.status === "detail" &&
    selectedResolved.detail.id === "artificial-package",
  "Resolver must return the matching detail."
);

const notesState = setWriterLibraryDetailLayer(selectedState, "notes");
const notesResolved = resolveWriterLibraryReadOnlySelection(
  snapshot,
  notesState
);
check(
  notesResolved.status === "detail" && notesResolved.activeLayer === "notes",
  "Resolved detail must preserve the selected active layer."
);
check(notesState.activeLayer === "notes", "Layer transition must support notes.");
const workshopState = setWriterLibraryDetailLayer(
  notesState,
  "workshop"
);
check(
  workshopState.activeLayer === "workshop",
  "Layer transition must support workshop."
);
const finalState = setWriterLibraryDetailLayer(workshopState, "final");
check(finalState.activeLayer === "final", "Layer transition must support final.");
const sparkState = setWriterLibraryDetailLayer(finalState, "spark");
check(sparkState.activeLayer === "spark", "Layer transition must support spark.");
check(
  notesState.selectedPackageId === selectedState.selectedPackageId &&
    workshopState.selectedPackageId === selectedState.selectedPackageId &&
    finalState.selectedPackageId === selectedState.selectedPackageId,
  "Changing layers must preserve the selected package ID."
);

const stateBeforeReturn = JSON.stringify(finalState);
const returnedState = returnToWriterLibrary(finalState);
const returnedResolved = resolveWriterLibraryReadOnlySelection(
  snapshot,
  returnedState
);
check(
  returnedState.selectedPackageId === null && returnedResolved.status === "library",
  "Returning must clear selection and resolve to the Library."
);
check(
  returnedState.activeLayer === "spark",
  "Returning to the Library must reset the layer to spark."
);
check(
  JSON.stringify(finalState) === stateBeforeReturn,
  "Returning to the Library must not mutate the input state."
);

const missingState = selectWriterLibraryDetail(initialState, "missing-id");
const missingResolved = resolveWriterLibraryReadOnlySelection(
  snapshot,
  missingState
);
check(
  missingResolved.status === "missing-detail" &&
    missingResolved.selectedPackageId === "missing-id",
  "An absent own detail key must resolve to missing-detail."
);
check(
  missingResolved.status === "missing-detail" &&
    Object.keys(missingResolved).join(",") === "status,selectedPackageId",
  "Missing detail must expose no loader, provider, exception, or record data."
);
check(
  JSON.stringify(snapshot) === snapshotBefore,
  "Resolving a missing detail must not mutate the snapshot."
);

const specialSnapshot = buildWriterLibraryReadOnlySnapshot([
  createPackage({ id: "__proto__", title: "Special artificial package" })
]);
const specialState = selectWriterLibraryDetail(initialState, "__proto__");
const specialResolved = resolveWriterLibraryReadOnlySelection(
  specialSnapshot,
  specialState
);
check(
  specialResolved.status === "detail" &&
    specialResolved.detail.id === "__proto__",
  "Special string IDs must resolve through a safe own-property lookup."
);
check(
  selectedResolved.status === "detail" &&
    selectedResolved.detail === snapshot.detailsById["artificial-package"] &&
    Object.isFrozen(selectedResolved.detail),
  "Resolver must reuse the original frozen snapshot detail."
);
check(
  Object.isFrozen(initialResolved) &&
    Object.isFrozen(selectedResolved) &&
    Object.isFrozen(missingResolved),
  "Every resolved wrapper must be frozen."
);
check(
  Object.isFrozen(selectedState) &&
    Object.isFrozen(notesState) &&
    Object.isFrozen(returnedState),
  "Every newly created selection state must be frozen."
);

const repeatedState = selectWriterLibraryDetail(
  createWriterLibraryReadOnlySelectionState(),
  "artificial-package"
);
const repeatedResolved = resolveWriterLibraryReadOnlySelection(
  snapshot,
  repeatedState
);
check(
  JSON.stringify(repeatedState) === JSON.stringify(selectedState) &&
    JSON.stringify(repeatedResolved) === JSON.stringify(selectedResolved) &&
    repeatedState !== selectedState &&
    repeatedResolved !== selectedResolved,
  "Equivalent calls must produce equivalent independently allocated wrappers."
);
check(
  JSON.stringify(snapshot) === snapshotBefore,
  "Selection, layer, return, and resolve operations must leave snapshot unchanged."
);
check(
  JSON.stringify(snapshot.detailsById) === detailsBefore &&
    Object.isFrozen(snapshot.detailsById),
  "Selection operations must leave the frozen detail lookup unchanged."
);

console.log(`Writer library read-only selection checks: ${passed}/${passed} passed.`);
