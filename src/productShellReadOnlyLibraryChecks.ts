import type { WriterPackage } from "./types";
import { resolveProductShellDataMode } from "./productShellDataMode";
import {
  assembleProductShellData,
  createWriterLibraryPresentation,
  getWriterLibraryOriginLabel,
  type ProductShellDataAssemblyInput
} from "./productShellReadOnlyLibrary";
import type { WriterLibraryItem } from "./writerLibraryViewModel";
import type { WriterLibraryReadOnlySnapshot } from "./writerLibraryReadOnlySnapshot";

let passed = 0;

function check(name: string, condition: boolean) {
  if (!condition) {
    throw new Error(`Product shell read-only Library check failed: ${name}`);
  }
  passed += 1;
}

function createPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "artificial-package",
    title: "Umelý balík",
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

function createItem(overrides: Partial<WriterLibraryItem> = {}): WriterLibraryItem {
  return Object.freeze({
    id: "artificial-item",
    title: "Umelá položka",
    excerpt: "Umelý výňatok.",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    origin: "writer-package",
    progress: "spark",
    noteCount: 0,
    hasNotes: false,
    hasWorkshopText: false,
    hasFinalText: false,
    deleted: false,
    ...overrides
  });
}

function createSnapshot(
  items: readonly WriterLibraryItem[]
): WriterLibraryReadOnlySnapshot {
  return Object.freeze({
    items,
    detailsById: Object.freeze(
      Object.create(null) as Record<string, never>
    )
  });
}

let fixtureLoaderCalls = 0;
let fixtureProviderCalls = 0;
const fixtureResult = assembleProductShellData({
  dataMode: "fixture",
  catalogLoader: () => {
    fixtureLoaderCalls += 1;
    return [];
  },
  provider: () => {
    fixtureProviderCalls += 1;
    return { status: "ready", snapshot: createSnapshot(Object.freeze([])) };
  }
} as ProductShellDataAssemblyInput);
check(
  "fixture mode calls neither loader nor provider",
  fixtureResult.mode === "fixture" && fixtureLoaderCalls === 0 && fixtureProviderCalls === 0
);

const injectedLoader = () => [createPackage()];
let realProviderCalls = 0;
let receivedLoader: unknown;
const injectedResult = assembleProductShellData({
  dataMode: "real-read-only",
  catalogLoader: injectedLoader,
  provider: (loader) => {
    realProviderCalls += 1;
    receivedLoader = loader;
    return { status: "ready", snapshot: createSnapshot(Object.freeze([])) };
  }
});
check(
  "real read-only mode calls the provider exactly once",
  injectedResult.mode === "real-read-only" && realProviderCalls === 1
);
check(
  "the provider receives the exact injected catalog loader",
  receivedLoader === injectedLoader
);

const integratedResult = assembleProductShellData({
  dataMode: "real-read-only",
  catalogLoader: () => [
    createPackage({
      id: "older",
      updatedAt: "2026-01-01T08:00:00.000Z",
      notes: [
        {
          id: "artificial-live-note",
          text: "Umelá živá poznámka.",
          createdAt: "2026-01-01T08:00:00.000Z",
          updatedAt: "2026-01-01T08:00:00.000Z"
        },
        {
          id: "artificial-deleted-note",
          text: "Umelá zmazaná poznámka.",
          createdAt: "2026-01-01T08:00:00.000Z",
          updatedAt: "2026-01-01T08:00:00.000Z",
          deletedAt: "2026-01-02T08:00:00.000Z"
        }
      ]
    }),
    createPackage({ id: "newer", updatedAt: "2026-01-03T08:00:00.000Z" }),
    createPackage({
      id: "deleted",
      updatedAt: "2026-01-04T08:00:00.000Z",
      deletedAt: "2026-01-04T09:00:00.000Z"
    })
  ]
});
check(
  "ready items use the original B1 order",
  integratedResult.mode === "real-read-only" &&
    integratedResult.library.status === "ready" &&
    integratedResult.library.snapshot.items.map((item) => item.id).join(",") ===
      "newer,older"
);
check(
  "tombstones stay hidden and deleted notes do not increase the B1 count",
  integratedResult.mode === "real-read-only" &&
    integratedResult.library.status === "ready" &&
    integratedResult.library.snapshot.items.every((item) => item.id !== "deleted") &&
    integratedResult.library.snapshot.items.find((item) => item.id === "older")
      ?.noteCount === 1
);

const suppliedItems = Object.freeze([
  createItem({ id: "supplied-second" }),
  createItem({ id: "supplied-first" })
]);
const readyPresentation = createWriterLibraryPresentation({
  status: "ready",
  snapshot: createSnapshot(suppliedItems)
});
check(
  "B4 does not sort or filter supplied items again",
  readyPresentation.status === "ready" &&
    readyPresentation.items === suppliedItems &&
    readyPresentation.items.map((item) => item.id).join(",") ===
      "supplied-second,supplied-first"
);
check(
  "Pokračovať uses the first supplied item",
  readyPresentation.status === "ready" &&
    readyPresentation.continueItem === suppliedItems[0]
);
check(
  "Knižnica keeps every supplied item",
  readyPresentation.status === "ready" && readyPresentation.items.length === 2
);
check(
  "legacy origin has the human Pôvodná Iskra label",
  getWriterLibraryOriginLabel("legacy-spark") === "Pôvodná Iskra" &&
    getWriterLibraryOriginLabel("writer-package") === undefined
);

const emptyPresentation = createWriterLibraryPresentation({
  status: "ready",
  snapshot: createSnapshot(Object.freeze([]))
});
check(
  "empty ready items produce a distinct empty presentation",
  emptyPresentation.status === "empty" && emptyPresentation.items.length === 0
);

const failedPresentation = createWriterLibraryPresentation({
  status: "failed",
  reason: "catalog-load-failed"
});
check(
  "provider failure produces a distinct failed presentation",
  failedPresentation.status === "failed"
);
check(
  "failed presentation exposes no exception or catalog data",
  Object.keys(failedPresentation).join(",") === "status"
);

check(
  "production mode still cannot activate real read-only data",
  resolveProductShellDataMode({
    isDevelopment: false,
    search: "?mode=real-read-only"
  }) === "fixture"
);

console.log(`Product shell read-only Library checks: ${passed}/${passed} passed.`);
