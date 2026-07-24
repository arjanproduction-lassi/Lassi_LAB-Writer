import type { WriterPackage, WriterPackageNote } from "./types";
import {
  buildWriterLibraryDetails,
  toWriterLibraryDetail
} from "./writerLibraryDetailViewModel";
import { toWriterLibraryItem } from "./writerLibraryViewModel";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function createNote(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return {
    id: "artificial-note",
    text: "Umelá poznámka.",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides
  };
}

function createPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "artificial-package",
    title: "Umelý balík",
    sparkText: "Umelá iskra.",
    notes: [],
    workshopText: "Umelý pracovný text.",
    finalText: "Umelý finálny text.",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-02T08:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

const completePackage = createPackage({
  notes: [createNote()]
});
const completeDetail = toWriterLibraryDetail(completePackage);
check(
  completeDetail.id === completePackage.id &&
    completeDetail.title === completePackage.title &&
    completeDetail.createdAt === completePackage.createdAt &&
    completeDetail.updatedAt === completePackage.updatedAt &&
    completeDetail.sparkText === completePackage.sparkText &&
    completeDetail.notes[0].text === completePackage.notes[0].text &&
    completeDetail.workshopText === completePackage.workshopText &&
    completeDetail.finalText === completePackage.finalText,
  "A WriterPackage must map to the exact detail fields."
);

check(
  toWriterLibraryDetail(
    createPackage({ legacy: { source: "spark", stage: "notes" } })
  ).origin === "legacy-spark",
  "B legacy Spark history must map to legacy-spark origin."
);

check(
  toWriterLibraryDetail(createPackage()).origin === "writer-package",
  "C a normal package must map to writer-package origin."
);

check(
  toWriterLibraryDetail(createPackage({ title: " \n\t " })).title === "Bez názvu",
  "D a blank title must use Bez názvu."
);

const sharedTitlePackage = createPackage({ title: "  Umelý\n  názov\t diela  " });
check(
  toWriterLibraryDetail(sharedTitlePackage).title ===
    toWriterLibraryItem(sharedTitlePackage).title,
  "E detail title rules must match B1 exactly."
);

const sparkOnly = toWriterLibraryDetail(
  createPackage({ sparkText: "Iba iskra", workshopText: "", finalText: "" })
);
check(
  sparkOnly.sparkText === "Iba iskra" &&
    sparkOnly.workshopText === "" &&
    sparkOnly.finalText === "",
  "F spark text must remain only in the spark layer."
);

const workshopOnly = toWriterLibraryDetail(
  createPackage({ sparkText: "", workshopText: "Iba dielňa", finalText: "" })
);
check(
  workshopOnly.sparkText === "" &&
    workshopOnly.workshopText === "Iba dielňa" &&
    workshopOnly.finalText === "",
  "G workshop text must remain only in the workshop layer."
);

const finalOnly = toWriterLibraryDetail(
  createPackage({ sparkText: "", workshopText: "", finalText: "Iba Text OK" })
);
check(
  finalOnly.sparkText === "" &&
    finalOnly.workshopText === "" &&
    finalOnly.finalText === "Iba Text OK",
  "H final text must remain only in the final layer."
);

const separateLayers = toWriterLibraryDetail(
  createPackage({
    sparkText: "Vrstva iskry\n zostáva verná.",
    workshopText: "Vrstva dielne zostáva verná.",
    finalText: "Vrstva Text OK zostáva verná."
  })
);
check(
  separateLayers.sparkText === "Vrstva iskry\n zostáva verná." &&
    separateLayers.workshopText === "Vrstva dielne zostáva verná." &&
    separateLayers.finalText === "Vrstva Text OK zostáva verná.",
  "I layer text must remain exact and must never be copied between layers."
);

check(
  !("excerpt" in completeDetail) && !("progress" in completeDetail),
  "J detail must not expose excerpt or progress."
);

const notesPackage = createPackage({
  notes: [
    createNote({ id: "live-note" }),
    createNote({
      id: "deleted-note",
      deletedAt: "2026-01-03T08:00:00.000Z"
    })
  ]
});
const notesDetail = toWriterLibraryDetail(notesPackage);
check(
  notesDetail.notes.length === 1 && notesDetail.notes[0].id === "live-note",
  "K deleted notes must be excluded."
);

check(
  notesDetail.notes[0].text === "Umelá poznámka." &&
    notesDetail.notes[0].createdAt === "2026-01-01T08:00:00.000Z" &&
    notesDetail.notes[0].updatedAt === "2026-01-01T09:00:00.000Z",
  "L a live note must preserve all detail fields."
);

check(
  toWriterLibraryDetail(
    createPackage({ notes: [createNote({ id: "live-empty-note", text: "" })] })
  ).notes.some((note) => note.id === "live-empty-note" && note.text === ""),
  "M an empty live note must not be removed."
);

check(
  toWriterLibraryDetail(
    createPackage({
      notes: [
        createNote({ id: "note-c" }),
        createNote({ id: "note-a" }),
        createNote({ id: "note-b" })
      ]
    })
  ).notes.map((note) => note.id).join(",") === "note-c,note-a,note-b",
  "N live note order must remain unchanged."
);

const timestampPackage = createPackage({
  createdAt: "2025-05-01T01:02:03.000Z",
  updatedAt: "2025-06-04T05:06:07.000Z",
  notes: [
    createNote({
      createdAt: "2025-05-02T01:02:03.000Z",
      updatedAt: "2025-05-03T04:05:06.000Z"
    })
  ]
});
const timestampDetail = toWriterLibraryDetail(timestampPackage);
check(
  timestampDetail.createdAt === timestampPackage.createdAt &&
    timestampDetail.updatedAt === timestampPackage.updatedAt &&
    timestampDetail.notes[0].createdAt === timestampPackage.notes[0].createdAt &&
    timestampDetail.notes[0].updatedAt === timestampPackage.notes[0].updatedAt,
  "O package and note timestamps must remain unchanged."
);

const immutableInput = createPackage({
  notes: [createNote({ id: "input-note-a" }), createNote({ id: "input-note-b" })],
  legacy: { source: "spark", stage: "workshop" }
});
const immutableInputSnapshot = JSON.stringify(immutableInput);
toWriterLibraryDetail(immutableInput);
check(
  JSON.stringify(immutableInput) === immutableInputSnapshot,
  "P mapping must not mutate the input WriterPackage."
);

const noteArrayReference = immutableInput.notes;
const noteReferences = [...immutableInput.notes];
toWriterLibraryDetail(immutableInput);
check(
  immutableInput.notes === noteArrayReference &&
    immutableInput.notes[0] === noteReferences[0] &&
    immutableInput.notes[1] === noteReferences[1] &&
    immutableInput.notes.map((note) => note.id).join(",") ===
      "input-note-a,input-note-b",
  "Q mapping must not mutate input notes or their order."
);

check(Object.isFrozen(completeDetail), "R detail object must be frozen.");
check(Object.isFrozen(completeDetail.notes), "S detail notes array must be frozen.");
check(
  completeDetail.notes.every(Object.isFrozen),
  "T every detail note object must be frozen."
);

const detachedInput = createPackage({
  title: "Pôvodný názov",
  sparkText: "Pôvodná iskra",
  notes: [createNote({ id: "detached-note", text: "Pôvodná poznámka" })]
});
const detachedDetail = toWriterLibraryDetail(detachedInput);
detachedInput.title = "Zmenený názov";
detachedInput.sparkText = "Zmenená iskra";
detachedInput.notes[0].text = "Zmenená poznámka";
detachedInput.notes.push(createNote({ id: "late-note" }));
check(
  detachedDetail.title === "Pôvodný názov" &&
    detachedDetail.sparkText === "Pôvodná iskra" &&
    detachedDetail.notes.length === 1 &&
    detachedDetail.notes[0].text === "Pôvodná poznámka",
  "U later input mutation must not change an existing detail."
);

const firstRun = toWriterLibraryDetail(completePackage);
const secondRun = toWriterLibraryDetail(completePackage);
check(
  JSON.stringify(firstRun) === JSON.stringify(secondRun) &&
    firstRun !== secondRun &&
    firstRun.notes !== secondRun.notes &&
    firstRun.notes[0] !== secondRun.notes[0],
  "V repeated calls must be meaningfully equal and independently allocated."
);

check(
  buildWriterLibraryDetails([
    createPackage({ id: "visible-detail" }),
    createPackage({
      id: "deleted-detail",
      deletedAt: "2026-01-04T08:00:00.000Z"
    })
  ]).map((detail) => detail.id).join(",") === "visible-detail",
  "W the builder must exclude top-level tombstones."
);

const orderedDetails = buildWriterLibraryDetails([
  createPackage({ id: "z-first", updatedAt: "2026-01-01T00:00:00.000Z" }),
  createPackage({ id: "duplicate-id", updatedAt: "2026-01-04T00:00:00.000Z" }),
  createPackage({ id: "duplicate-id", updatedAt: "2026-01-03T00:00:00.000Z" }),
  createPackage({ id: "a-last", updatedAt: "2026-01-02T00:00:00.000Z" })
]);
check(
  orderedDetails.map((detail) => detail.id).join(",") ===
    "z-first,duplicate-id,duplicate-id,a-last" &&
    Object.isFrozen(orderedDetails),
  "X the builder must preserve order without sorting or deduplication and freeze its result."
);

console.log(`Writer library detail view-model checks: ${passed}/${passed} passed.`);
