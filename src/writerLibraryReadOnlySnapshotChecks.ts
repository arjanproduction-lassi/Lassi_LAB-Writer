import type { WriterPackage } from "./types";
import { buildWriterLibraryReadOnlySnapshot } from "./writerLibraryReadOnlySnapshot";
import { buildWriterLibraryItems } from "./writerLibraryViewModel";

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
    workshopText: "",
    finalText: "",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

const fullCatalog = [
  createPackage({
    id: "older",
    title: "Older package",
    notes: [
      {
        id: "live-note",
        text: "Artificial live note.",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T09:00:00.000Z"
      },
      {
        id: "deleted-note",
        text: "Artificial deleted note.",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T09:00:00.000Z",
        deletedAt: "2026-01-01T10:00:00.000Z"
      }
    ],
    workshopText: "Artificial workshop.",
    finalText: "Artificial final.",
    updatedAt: "2026-01-02T08:00:00.000Z"
  }),
  createPackage({
    id: "newer",
    title: "Newer package",
    updatedAt: "2026-01-03T08:00:00.000Z",
    legacy: { source: "spark", stage: "spark" }
  }),
  createPackage({
    id: "deleted",
    deletedAt: "2026-01-04T08:00:00.000Z"
  })
];
const fullSnapshot = buildWriterLibraryReadOnlySnapshot(fullCatalog);

check(fullSnapshot.items.length === 2, "Snapshot must expose visible B1 items.");
check(
  fullSnapshot.items.map((item) => item.id).join(",") === "newer,older",
  "Snapshot items must preserve B1 sorting."
);
check(
  Object.keys(fullSnapshot.detailsById).join(",") === "older,newer",
  "Snapshot details must preserve the visible catalog order."
);
check(
  fullSnapshot.detailsById.older.sparkText === "Artificial spark." &&
    fullSnapshot.detailsById.older.workshopText === "Artificial workshop." &&
    fullSnapshot.detailsById.older.finalText === "Artificial final.",
  "Snapshot details must preserve exact text layers."
);
check(
  fullSnapshot.items.every((item) =>
    Object.prototype.hasOwnProperty.call(fullSnapshot.detailsById, item.id)
  ),
  "Every visible item must have a detail."
);
check(
  fullSnapshot.items.every(
    (item) => fullSnapshot.detailsById[item.id].title === item.title
  ),
  "Item and detail titles must agree."
);
check(
  fullSnapshot.items.every(
    (item) => fullSnapshot.detailsById[item.id].origin === item.origin
  ),
  "Item and detail origins must agree."
);
check(
  !("deleted" in fullSnapshot.detailsById),
  "Top-level tombstones must be absent from details."
);
check(
  fullSnapshot.detailsById.older.notes.map((note) => note.id).join(",") ===
    "live-note",
  "Deleted notes must be absent from details."
);
check(
  fullSnapshot.detailsById.newer.origin === "legacy-spark",
  "Legacy origin must remain consistent in detail."
);

const emptySnapshot = buildWriterLibraryReadOnlySnapshot([]);
check(
  emptySnapshot.items.length === 0 &&
    Object.keys(emptySnapshot.detailsById).length === 0,
  "An empty catalog must create an empty ready snapshot."
);
check(Object.isFrozen(fullSnapshot), "The snapshot object must be frozen.");
check(Object.isFrozen(fullSnapshot.items), "The snapshot items must be frozen.");
check(
  Object.isFrozen(fullSnapshot.detailsById),
  "The detail lookup must be frozen."
);
check(
  Object.isFrozen(fullSnapshot.detailsById.older),
  "Each detail must be frozen."
);
check(
  Object.isFrozen(fullSnapshot.detailsById.older.notes) &&
    Object.isFrozen(fullSnapshot.detailsById.older.notes[0]),
  "Detail notes and note values must be frozen."
);

const inputCatalog = [
  createPackage({
    id: "input",
    notes: [
      {
        id: "input-note",
        text: "Original artificial note.",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T08:00:00.000Z"
      }
    ]
  })
];
const inputBefore = JSON.stringify(inputCatalog);
const detachedSnapshot = buildWriterLibraryReadOnlySnapshot(inputCatalog);
check(
  JSON.stringify(inputCatalog) === inputBefore,
  "Snapshot construction must not mutate the catalog."
);
inputCatalog[0].title = "Changed after snapshot";
inputCatalog[0].notes[0].text = "Changed after snapshot";
check(
  detachedSnapshot.items[0].title === "Artificial package" &&
    detachedSnapshot.detailsById.input.notes[0].text ===
      "Original artificial note.",
  "Snapshot values must be detached from later catalog mutation."
);
check(
  (detachedSnapshot.detailsById.input as unknown) !== inputCatalog[0] &&
    detachedSnapshot.detailsById.input.notes !== inputCatalog[0].notes,
  "Snapshot must retain no raw package or notes collection reference."
);

const repeatCatalog = [createPackage({ id: "repeat" })];
const firstRun = buildWriterLibraryReadOnlySnapshot(repeatCatalog);
const secondRun = buildWriterLibraryReadOnlySnapshot(repeatCatalog);
check(
  JSON.stringify(firstRun) === JSON.stringify(secondRun),
  "The snapshot must be deterministic for the same input."
);
check(
  firstRun !== secondRun &&
    firstRun.items !== secondRun.items &&
    firstRun.detailsById !== secondRun.detailsById,
  "Repeated snapshots must be independently allocated."
);
check(
  JSON.stringify(fullSnapshot.items) ===
    JSON.stringify(buildWriterLibraryItems(fullCatalog)),
  "Snapshot items must be exactly the authoritative B1 result."
);
check(
  !("excerpt" in fullSnapshot.detailsById.older) &&
    !("progress" in fullSnapshot.detailsById.older),
  "Details must not invent B1 presentation fields."
);
check(
  Object.getPrototypeOf(fullSnapshot.detailsById) === null,
  "The detail lookup must use a null prototype."
);

const specialIdSnapshot = buildWriterLibraryReadOnlySnapshot([
  createPackage({ id: "__proto__", title: "Special artificial package" })
]);
check(
  Object.prototype.hasOwnProperty.call(
    specialIdSnapshot.detailsById,
    "__proto__"
  ) && specialIdSnapshot.detailsById.__proto__.id === "__proto__",
  "Special string ids must remain safe own lookup keys."
);

let duplicateIdFailed = false;
try {
  buildWriterLibraryReadOnlySnapshot([
    createPackage({ id: "duplicate", title: "First" }),
    createPackage({ id: "duplicate", title: "Second" })
  ]);
} catch {
  duplicateIdFailed = true;
}
check(
  duplicateIdFailed,
  "Invalid duplicate ids must fail instead of silently overwriting a detail."
);
check(
  Object.keys(fullSnapshot).join(",") === "items,detailsById",
  "Snapshot must expose only items and detailsById."
);
check(
  Object.keys(fullSnapshot.detailsById).length === fullSnapshot.items.length,
  "Snapshot must contain exactly one detail per visible item."
);

console.log(`Writer library read-only snapshot checks: ${passed}/${passed} passed.`);
