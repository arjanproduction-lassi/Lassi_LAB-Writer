import type { WriterPackage, WriterPackageNote } from "./types";
import {
  cloneAndFreezeWriterPackageCollection,
  parseWriterPackageCollectionJsonStrict,
  serializeWriterPackageCollection,
  validateWriterPackageCollectionCompatibility
} from "./writerPackageCollectionCodec";

const CREATED_AT = "2026-01-01T08:00:00.000Z";
const UPDATED_AT = "2026-01-02T08:00:00.000Z";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function note(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return {
    id: "artificial-note",
    text: "Artificial note text.",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "artificial-package",
    title: "Artificial title",
    sparkText: "Artificial spark text.",
    notes: [note()],
    workshopText: "Artificial workshop text.",
    finalText: "Artificial final text.",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    packageVersion: 1,
    ...overrides
  };
}

function parse(raw: string) {
  return parseWriterPackageCollectionJsonStrict(raw);
}

function parsed(raw: string) {
  const result = parse(raw);
  if (!result.ok) {
    throw new Error(`Expected parsed collection, received ${result.reason}.`);
  }
  return result;
}

function hasReason(
  result: ReturnType<typeof parse>,
  reason: Exclude<ReturnType<typeof parse>, { ok: true }>["reason"]
) {
  return !result.ok && result.reason === reason;
}

check(
  hasReason(parse("{"), "malformed-json") &&
    hasReason(parse("null"), "package-storage-not-array") &&
    hasReason(parse("{}"), "package-storage-not-array"),
  "A malformed JSON and valid non-array JSON must remain distinct."
);

const empty = parsed("[]");
check(
  empty.packages.length === 0 &&
    Object.isFrozen(empty) &&
    Object.isFrozen(empty.packages),
  "B an empty array must parse as a detached frozen collection."
);

const first = writerPackage({ id: "first-artificial-package" });
const second = writerPackage({
  id: "second-artificial-package",
  title: "",
  sparkText: "",
  notes: [
    note({ id: "live-artificial-note", text: "" }),
    note({
      id: "deleted-artificial-note",
      deletedAt: "2026-01-03T08:00:00.000Z"
    })
  ],
  workshopText: "",
  finalText: "",
  deletedAt: "2026-01-04T08:00:00.000Z",
  legacy: { source: "spark", stage: "workshop" }
});
const source = [first, second];
const sourceBefore = JSON.stringify(source);
const complete = parsed(sourceBefore);
check(
  JSON.stringify(complete.packages) === sourceBefore &&
    complete.packages.map((candidate) => candidate.id).join(",") ===
      "first-artificial-package,second-artificial-package" &&
    complete.packages[1].notes.map((candidate) => candidate.id).join(",") ===
      "live-artificial-note,deleted-artificial-note",
  "C valid Packages must preserve every field plus Package and note order."
);
check(
  complete.packages[1].title === "" &&
    complete.packages[1].sparkText === "" &&
    complete.packages[1].workshopText === "" &&
    complete.packages[1].finalText === "" &&
    complete.packages[1].deletedAt === "2026-01-04T08:00:00.000Z" &&
    complete.packages[1].notes[1].deletedAt === "2026-01-03T08:00:00.000Z" &&
    complete.packages[1].legacy?.stage === "workshop",
  "D empty content, tombstones, and legacy metadata must remain exact."
);
check(
  Object.isFrozen(complete) &&
    Object.isFrozen(complete.packages) &&
    complete.packages.every(
      (candidate) =>
        Object.isFrozen(candidate) &&
        Object.isFrozen(candidate.notes) &&
        candidate.notes.every(Object.isFrozen) &&
        (candidate.legacy === undefined || Object.isFrozen(candidate.legacy))
    ),
  "E parsed output must be deeply frozen."
);
check(
  JSON.stringify(source) === sourceBefore &&
    complete.packages !== source &&
    complete.packages[0] !== first &&
    complete.packages[1].notes !== second.notes &&
    complete.packages[1].notes[0] !== second.notes[0] &&
    complete.packages[1].legacy !== second.legacy,
  "F parsing must not mutate input values and output must be deeply detached."
);

first.title = "Later artificial mutation";
second.notes[0].text = "Later artificial note mutation";
source.push(writerPackage({ id: "late-artificial-package" }));
check(
  complete.packages.length === 2 &&
    complete.packages[0].title === "Artificial title" &&
    complete.packages[1].notes[0].text === "",
  "G later input mutation must not affect a parsed result."
);

check(
  hasReason(
    parse(JSON.stringify([writerPackage({ packageVersion: 2 as 1 })])),
    "unsupported-package-version"
  ),
  "H an unsupported packageVersion must block the whole collection."
);

const unknownPackage = { ...writerPackage(), extra: true };
const unknownNote = writerPackage({ notes: [{ ...note(), extra: true } as WriterPackageNote] });
const unknownLegacy = writerPackage({
  legacy: { source: "spark", extra: true } as WriterPackage["legacy"]
});
check(
  hasReason(parse(JSON.stringify([unknownPackage])), "unsupported-package-shape") &&
    hasReason(parse(JSON.stringify([unknownNote])), "unsupported-package-shape") &&
    hasReason(parse(JSON.stringify([unknownLegacy])), "unsupported-package-shape"),
  "I unknown Package, note, or legacy keys must block as unsupported shape."
);

check(
  hasReason(
    parse(JSON.stringify([writerPackage({ updatedAt: "invalid-date" })])),
    "invalid-package"
  ) &&
    hasReason(
      parse(JSON.stringify([writerPackage({ id: "   " })])),
      "invalid-package"
    ),
  "J invalid Package fields must block the whole collection."
);

check(
  hasReason(
    parse(
      JSON.stringify([
        writerPackage({ notes: [note({ deletedAt: "invalid-date" })] })
      ])
    ),
    "invalid-package"
  ),
  "K one invalid note must block the whole collection."
);

check(
  hasReason(
    parse(
      JSON.stringify([
        writerPackage({ id: "duplicate-artificial-package" }),
        writerPackage({ id: "duplicate-artificial-package" })
      ])
    ),
    "duplicate-package-id"
  ),
  "L duplicate Package IDs must block without deduplication."
);

check(
  hasReason(
    parse(
      JSON.stringify([
        writerPackage({ updatedAt: "invalid-date" }),
        writerPackage({ id: "valid-artificial-package" })
      ])
    ),
    "invalid-package"
  ),
  "M an invalid record must never be filtered or repaired."
);

const compatibilityPackage = {
  ...writerPackage(),
  compatibilityOnlyExtra: "Artificial compatibility value"
} as WriterPackage;
check(
  validateWriterPackageCollectionCompatibility([compatibilityPackage]).ok &&
    hasReason(
      parse(JSON.stringify([compatibilityPackage])),
      "unsupported-package-shape"
    ),
  "N compatibility validation must preserve D1 behavior while strict raw parsing rejects unknown keys."
);

const cloned = cloneAndFreezeWriterPackageCollection([writerPackage()]);
check(
  cloned.length === 1 &&
    Object.isFrozen(cloned) &&
    Object.isFrozen(cloned[0]) &&
    Object.isFrozen(cloned[0].notes) &&
    cloned[0] !== source[0],
  "O shared cloning must return a detached deeply frozen collection."
);

const serialA = serializeWriterPackageCollection([
  writerPackage({ id: "serial-artificial-package", legacy: { stage: "final", source: "spark" } })
]);
const serialB = serializeWriterPackageCollection([
  {
    packageVersion: 1,
    updatedAt: UPDATED_AT,
    createdAt: CREATED_AT,
    finalText: "Artificial final text.",
    workshopText: "Artificial workshop text.",
    notes: [note()],
    sparkText: "Artificial spark text.",
    title: "Artificial title",
    id: "serial-artificial-package",
    legacy: { source: "spark", stage: "final" }
  }
]);
check(
  serialA.ok &&
    serialB.ok &&
    serialA.raw === serialB.raw &&
    parsed(serialA.raw).packages[0].id === "serial-artificial-package",
  "P serialization must be deterministic and strictly parseable for equivalent validated collections."
);

const invalidSerialization = serializeWriterPackageCollection([
  { ...writerPackage(), unknown: "Artificial unknown value" } as WriterPackage
]);
check(
  !invalidSerialization.ok &&
    invalidSerialization.reason === "unsupported-package-shape",
  "Q serialization must refuse unsupported shape instead of discarding it."
);

const undefinedOptionalSerialization = serializeWriterPackageCollection([
  { ...writerPackage(), legacy: undefined }
]);
check(
  !undefinedOptionalSerialization.ok &&
    undefinedOptionalSerialization.reason === "unsupported-package-shape",
  "R explicitly undefined optional fields must not pass as canonical storage shape."
);

const repeatRaw = JSON.stringify([writerPackage()]);
const repeatA = parsed(repeatRaw);
const repeatB = parsed(repeatRaw);
check(
  JSON.stringify(repeatA) === JSON.stringify(repeatB) &&
    repeatA !== repeatB &&
    repeatA.packages !== repeatB.packages,
  "S equivalent parsing must be deterministic and independently allocated."
);

console.log(`WriterPackage collection codec checks: ${passed}/${passed} passed.`);
