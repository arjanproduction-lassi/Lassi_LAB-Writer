import type { WriterPackage, WriterPackageNote } from "./types";
import {
  buildWriterLibraryItems,
  toWriterLibraryItem
} from "./writerLibraryViewModel";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function createNote(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return {
    id: "fixture-note",
    text: "Umelá poznámka.",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    ...overrides
  };
}

function createPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "fixture-package",
    title: "Testovací balík",
    sparkText: "Umelá iskra.",
    notes: [],
    workshopText: "",
    finalText: "",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

const mappedPackage = toWriterLibraryItem(createPackage());
check(
  mappedPackage.id === "fixture-package" &&
    mappedPackage.title === "Testovací balík" &&
    mappedPackage.excerpt === "Umelá iskra." &&
    mappedPackage.origin === "writer-package" &&
    mappedPackage.progress === "spark",
  "A real WriterPackage must map to the expected Library item."
);

const legacyItem = toWriterLibraryItem(
  createPackage({ legacy: { source: "spark", stage: "final" } })
);
check(
  legacyItem.origin === "legacy-spark",
  "Legacy metadata must map to the legacy-spark presentation origin."
);
check(
  !("storageSource" in legacyItem) && !("storageKey" in legacyItem),
  "Origin must not expose physical storage provenance."
);

check(
  toWriterLibraryItem(createPackage({ title: " \n\t " })).title === "Bez názvu",
  "A blank title must use the safe fallback."
);

const allLayers = createPackage({
  sparkText: "Iskra",
  workshopText: "Dielňa",
  finalText: "Text OK"
});
check(
  toWriterLibraryItem(allLayers).excerpt === "Text OK" &&
    toWriterLibraryItem({ ...allLayers, finalText: "" }).excerpt === "Dielňa" &&
    toWriterLibraryItem({ ...allLayers, finalText: "", workshopText: "" }).excerpt === "Iskra",
  "Excerpt priority must be final, workshop, then spark."
);

const longText = "x".repeat(130);
const longExcerpt = toWriterLibraryItem(createPackage({ finalText: longText })).excerpt;
check(
  longExcerpt === `${"x".repeat(118)}…` &&
    toWriterLibraryItem(createPackage({ finalText: longText })).excerpt === longExcerpt,
  "Excerpt truncation must use the deterministic 118-character rule."
);

check(
  toWriterLibraryItem(
    createPackage({ finalText: "  Prvý\n\n   druhý\t tretí  " })
  ).excerpt === "Prvý druhý tretí",
  "Excerpt whitespace must be normalized safely."
);

check(
  toWriterLibraryItem(createPackage({ finalText: "Hotovo" })).progress === "final",
  "Non-empty final text must produce final progress."
);
check(
  toWriterLibraryItem(createPackage({ workshopText: "Rozpracované" })).progress === "workshop",
  "Workshop text without final text must produce workshop progress."
);
check(
  toWriterLibraryItem(createPackage({ sparkText: "", notes: [createNote()] })).progress === "notes",
  "A live non-empty note must produce notes progress."
);
check(
  toWriterLibraryItem(createPackage()).progress === "spark",
  "Spark text without later layers must produce spark progress."
);
check(
  toWriterLibraryItem(createPackage({ sparkText: " \n ", title: "" })).progress === "empty" &&
    toWriterLibraryItem(createPackage({ sparkText: "" })).excerpt === "Zatiaľ bez textu.",
  "An empty package must use empty progress and safe copy."
);

const deletedNotesItem = toWriterLibraryItem(
  createPackage({
    sparkText: "",
    notes: [
      createNote({ id: "fixture-live-empty", text: "" }),
      createNote({ id: "fixture-deleted", deletedAt: "2026-01-02T08:00:00.000Z" })
    ]
  })
);
check(
  deletedNotesItem.noteCount === 1 &&
    deletedNotesItem.hasNotes &&
    deletedNotesItem.progress === "empty",
  "Deleted notes must be excluded and an empty live note must not invent notes progress."
);

check(
  buildWriterLibraryItems([
    createPackage({ id: "visible" }),
    createPackage({ id: "deleted", deletedAt: "2026-01-03T08:00:00.000Z" })
  ]).map((item) => item.id).join(",") === "visible",
  "A tombstoned package must be excluded from the visible Library."
);

check(
  buildWriterLibraryItems([
    createPackage({ id: "older", updatedAt: "2026-01-01T08:00:00.000Z" }),
    createPackage({ id: "newer", updatedAt: "2026-01-03T08:00:00.000Z" }),
    createPackage({ id: "middle", updatedAt: "2026-01-02T08:00:00.000Z" })
  ]).map((item) => item.id).join(",") === "newer,middle,older",
  "Library items must sort by updatedAt descending."
);

check(
  buildWriterLibraryItems([
    createPackage({ id: "z-item" }),
    createPackage({ id: "a-item" })
  ]).map((item) => item.id).join(",") === "a-item,z-item",
  "Equal timestamps must use an ascending ID tie-breaker."
);

const mutableCatalog = [
  createPackage({
    id: "input-b",
    notes: [createNote({ id: "nested-note" })]
  }),
  createPackage({ id: "input-a" })
];
const inputSnapshot = JSON.stringify(mutableCatalog);
buildWriterLibraryItems(mutableCatalog);
check(
  JSON.stringify(mutableCatalog) === inputSnapshot &&
    mutableCatalog.map((item) => item.id).join(",") === "input-b,input-a",
  "Building the Library must not mutate the catalog or nested notes."
);

const frozenItems = buildWriterLibraryItems([createPackage()]);
check(
  Object.isFrozen(frozenItems) &&
    Object.isFrozen(frozenItems[0]) &&
    Object.values(frozenItems[0]).every(
      (value) => value === null || typeof value !== "object"
    ),
  "The result must expose frozen scalar-only presentation objects."
);

const firstRun = buildWriterLibraryItems(mutableCatalog);
const secondRun = buildWriterLibraryItems(mutableCatalog);
check(
  JSON.stringify(firstRun) === JSON.stringify(secondRun) &&
    firstRun !== secondRun &&
    firstRun[0] !== secondRun[0],
  "Repeated calls must be meaningfully equal and independently allocated."
);

check(
  buildWriterLibraryItems([
    createPackage({ id: "invalid-b", updatedAt: "invalid-date" }),
    createPackage({ id: "valid", updatedAt: "2026-01-02T08:00:00.000Z" }),
    createPackage({ id: "invalid-a", updatedAt: "also-invalid" })
  ]).map((item) => item.id).join(",") === "valid,invalid-a,invalid-b",
  "Unexpected invalid dates must sort safely and deterministically after valid dates."
);

console.log(`Writer library view-model checks: ${passed}/${passed} passed.`);
