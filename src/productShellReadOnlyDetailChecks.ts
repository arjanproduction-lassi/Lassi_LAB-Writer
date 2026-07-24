import {
  createWriterLibraryDetailLayerPresentation,
  getWriterLibraryDetailContextLayer,
  WRITER_LIBRARY_DETAIL_LAYER_OPTIONS
} from "./productShellReadOnlyDetail";
import type { WriterLibraryDetail } from "./writerLibraryDetailViewModel";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function createDetail(
  overrides: Partial<WriterLibraryDetail> = {}
): WriterLibraryDetail {
  return Object.freeze({
    id: "artificial-detail",
    title: "Artificial detail",
    origin: "writer-package",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-02T08:00:00.000Z",
    sparkText: "Artificial spark.\nSecond line.",
    notes: Object.freeze([
      Object.freeze({
        id: "artificial-note-1",
        text: "First artificial note.",
        createdAt: "2026-01-01T09:00:00.000Z",
        updatedAt: "2026-01-01T09:00:00.000Z"
      }),
      Object.freeze({
        id: "artificial-note-2",
        text: "Second artificial note.",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z"
      })
    ]),
    workshopText: "Artificial workshop.",
    finalText: "Artificial final.",
    ...overrides
  });
}

const detail = createDetail();
const detailBefore = JSON.stringify(detail);

check(
  WRITER_LIBRARY_DETAIL_LAYER_OPTIONS.map((layer) => layer.id).join(",") ===
    "spark,notes,workshop,final" &&
    WRITER_LIBRARY_DETAIL_LAYER_OPTIONS.map((layer) => layer.label).join(",") ===
      "Iskra,Poznámky,Dielňa,Text OK",
  "Layer options must expose the four approved layers in order."
);
check(
  getWriterLibraryDetailContextLayer("spark") === "notes",
  "Spark context must be notes."
);
check(
  getWriterLibraryDetailContextLayer("notes") === "spark",
  "Notes context must be spark."
);
check(
  getWriterLibraryDetailContextLayer("workshop") === "notes",
  "Workshop context must be notes."
);
check(
  getWriterLibraryDetailContextLayer("final") === "workshop",
  "Final context must be workshop."
);

const spark = createWriterLibraryDetailLayerPresentation(detail, "spark");
check(
  spark.kind === "text" && spark.text === detail.sparkText,
  "Spark presentation must preserve exact spark text."
);
check(
  createWriterLibraryDetailLayerPresentation(
    createDetail({ sparkText: "" }),
    "spark"
  ).emptyText === "Pôvodná iskra nemá text.",
  "Spark must expose truthful empty copy."
);

const notes = createWriterLibraryDetailLayerPresentation(detail, "notes");
check(
  notes.kind === "notes" &&
    notes.notes === detail.notes &&
    notes.notes.map((note) => note.id).join(",") ===
      "artificial-note-1,artificial-note-2",
  "Notes presentation must reuse frozen live notes in their original order."
);
check(
  createWriterLibraryDetailLayerPresentation(
    createDetail({ notes: Object.freeze([]) }),
    "notes"
  ).emptyText === "K tomuto dielu zatiaľ nie sú poznámky.",
  "Notes must expose truthful empty copy."
);

const workshop = createWriterLibraryDetailLayerPresentation(detail, "workshop");
check(
  workshop.kind === "text" && workshop.text === detail.workshopText,
  "Workshop presentation must preserve exact workshop text."
);
check(
  createWriterLibraryDetailLayerPresentation(
    createDetail({ workshopText: "" }),
    "workshop"
  ).emptyText === "Pracovný text zatiaľ nie je uložený.",
  "Workshop must expose truthful empty copy."
);

const final = createWriterLibraryDetailLayerPresentation(detail, "final");
check(
  final.kind === "text" && final.text === detail.finalText,
  "Final presentation must preserve exact final text."
);
check(
  createWriterLibraryDetailLayerPresentation(
    createDetail({ finalText: "" }),
    "final"
  ).emptyText === "Finálny text zatiaľ nie je uložený.",
  "Final must expose truthful empty copy."
);
check(
  Object.isFrozen(WRITER_LIBRARY_DETAIL_LAYER_OPTIONS) &&
    WRITER_LIBRARY_DETAIL_LAYER_OPTIONS.every(Object.isFrozen) &&
    Object.isFrozen(spark) &&
    Object.isFrozen(notes),
  "Layer options and presentations must be frozen."
);
check(
  JSON.stringify(detail) === detailBefore,
  "Layer presentation must not mutate the frozen detail."
);
check(
  JSON.stringify(createWriterLibraryDetailLayerPresentation(detail, "final")) ===
    JSON.stringify(final),
  "Equivalent layer presentation calls must be deterministic."
);
check(
  spark.label === "Iskra" &&
    notes.label === "Poznámky" &&
    workshop.label === "Dielňa" &&
    final.label === "Text OK",
  "Every layer presentation must keep its human label."
);

console.log(`Product shell read-only detail checks: ${passed}/${passed} passed.`);
