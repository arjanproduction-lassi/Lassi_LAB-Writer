import type { WriterPackage } from "./types";
import * as providerApi from "./writerLibraryReadOnlyProvider";
import {
  loadWriterLibraryReadOnly,
  type WriterLibraryReadOnlyResult
} from "./writerLibraryReadOnlyProvider";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function createPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "fixture-package",
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

let successfulLoaderCalls = 0;
const readyResult = loadWriterLibraryReadOnly(() => {
  successfulLoaderCalls += 1;
  return [createPackage()];
});
check(
  successfulLoaderCalls === 1,
  "The injected catalog loader must be called exactly once."
);
check(
  readyResult.status === "ready" &&
    readyResult.snapshot.items.length === 1 &&
    readyResult.snapshot.items[0].title === "Umelý balík" &&
    readyResult.snapshot.detailsById["fixture-package"].title ===
      "Umelý balík" &&
    Object.isFrozen(readyResult),
  "A valid catalog must return a ready Library result."
);

const emptyResult = loadWriterLibraryReadOnly(() => []);
check(
  emptyResult.status === "ready" &&
    emptyResult.snapshot.items.length === 0 &&
    Object.keys(emptyResult.snapshot.detailsById).length === 0 &&
    Object.isFrozen(emptyResult.snapshot),
  "An empty catalog must remain a successful empty Library."
);

const orderedResult = loadWriterLibraryReadOnly(() => [
  createPackage({
    id: "older",
    updatedAt: "2026-01-01T08:00:00.000Z"
  }),
  createPackage({
    id: "newer",
    updatedAt: "2026-01-03T08:00:00.000Z"
  })
]);
check(
  orderedResult.status === "ready" &&
    orderedResult.snapshot.items.map((item) => item.id).join(",") === "newer,older",
  "The provider result must use B1 Library sorting."
);

const legacyResult = loadWriterLibraryReadOnly(() => [
  createPackage({ legacy: { source: "spark", stage: "notes" } })
]);
check(
    legacyResult.status === "ready" &&
    legacyResult.snapshot.items[0].origin === "legacy-spark" &&
    legacyResult.snapshot.detailsById["fixture-package"].origin ===
      "legacy-spark" &&
    !("storageSource" in legacyResult.snapshot.items[0]),
  "Legacy origin must remain a presentation fact without storage provenance."
);

const tombstoneResult = loadWriterLibraryReadOnly(() => [
  createPackage({ id: "visible" }),
  createPackage({
    id: "deleted",
    deletedAt: "2026-01-02T08:00:00.000Z"
  })
]);
check(
  tombstoneResult.status === "ready" &&
    tombstoneResult.snapshot.items.map((item) => item.id).join(",") === "visible" &&
    !("deleted" in tombstoneResult.snapshot.detailsById),
  "The provider must preserve B1 tombstone filtering."
);

const failedResult = loadWriterLibraryReadOnly(() => {
  throw new Error("synthetic loader failure");
});
const invalidCatalogResult = loadWriterLibraryReadOnly(() => [
  createPackage({ id: "duplicate", title: "First artificial package" }),
  createPackage({ id: "duplicate", title: "Second artificial package" })
]);
check(
  failedResult.status === "failed" &&
    failedResult.reason === "catalog-load-failed" &&
    Object.isFrozen(failedResult) &&
    Object.keys(failedResult).join(",") === "status,reason" &&
    invalidCatalogResult.status === "failed" &&
    invalidCatalogResult.reason === "catalog-load-failed",
  "Loader and snapshot construction failures must share the stable typed failure."
);

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};
let consoleCalls = 0;
let quietFailure: WriterLibraryReadOnlyResult | undefined;
try {
  console.log = () => {
    consoleCalls += 1;
  };
  console.warn = () => {
    consoleCalls += 1;
  };
  console.error = () => {
    consoleCalls += 1;
  };
  quietFailure = loadWriterLibraryReadOnly(() => {
    throw new Error("artificial private text");
  });
} finally {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}
check(
  quietFailure?.status === "failed" && consoleCalls === 0,
  "Provider failures and catalog text must never be logged."
);

const inputCatalog = [
  createPackage({
    id: "input-b",
    notes: [
      {
        id: "fixture-note",
        text: "Umelá poznámka.",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T08:00:00.000Z"
      }
    ]
  }),
  createPackage({ id: "input-a" })
];
const inputSnapshot = JSON.stringify(inputCatalog);
loadWriterLibraryReadOnly(() => inputCatalog);
check(
  JSON.stringify(inputCatalog) === inputSnapshot &&
    inputCatalog.map((item) => item.id).join(",") === "input-b,input-a",
  "The provider must not mutate the loader catalog or nested notes."
);

check(
  Object.keys(providerApi).join(",") === "loadWriterLibraryReadOnly",
  "The provider module must expose no runtime write API."
);

let failedLoaderCalls = 0;
loadWriterLibraryReadOnly(() => {
  failedLoaderCalls += 1;
  throw new Error("synthetic single-call failure");
});
check(
  failedLoaderCalls === 1,
  "One provider load must never invoke a failing loader twice."
);

const repeatCatalog = [createPackage({ id: "repeat" })];
const firstRun = loadWriterLibraryReadOnly(() => repeatCatalog);
const secondRun = loadWriterLibraryReadOnly(() => repeatCatalog);
check(
  JSON.stringify(firstRun) === JSON.stringify(secondRun) &&
    firstRun !== secondRun &&
    firstRun.status === "ready" &&
    secondRun.status === "ready" &&
    firstRun.snapshot !== secondRun.snapshot &&
    firstRun.snapshot.items !== secondRun.snapshot.items,
  "The same loader result must produce equivalent independently allocated results."
);

console.log(`Writer library read-only provider checks: ${passed}/${passed} passed.`);
