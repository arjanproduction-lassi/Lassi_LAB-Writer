import type { WriterPackage, WriterPackageNote } from "./types";
import {
  planWriterPackageWorkshopEdit,
  type WriterPackageWorkshopEditPlan
} from "./writerPackageWorkshopEdit";

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

function plan(
  overrides: Partial<Parameters<typeof planWriterPackageWorkshopEdit>[0]> = {}
): WriterPackageWorkshopEditPlan {
  return planWriterPackageWorkshopEdit({
    packages: [writerPackage()],
    packageId: "artificial-package",
    expectedUpdatedAt: UPDATED_AT,
    workshopText: "Changed artificial workshop text.",
    now: "2026-01-03T09:10:11.123Z",
    ...overrides
  });
}

function ready(result: WriterPackageWorkshopEditPlan) {
  if (result.status !== "ready") {
    throw new Error(`Expected ready, received ${result.status}.`);
  }
  return result;
}

function unchanged(result: WriterPackageWorkshopEditPlan) {
  if (result.status !== "unchanged") {
    throw new Error(`Expected unchanged, received ${result.status}.`);
  }
  return result;
}

function isBlocked(
  result: WriterPackageWorkshopEditPlan,
  reason: Extract<WriterPackageWorkshopEditPlan, { status: "blocked" }>["reason"]
) {
  return result.status === "blocked" && result.reason === reason;
}

const first = writerPackage({ id: "first-package" });
const target = writerPackage({
  id: "target-package",
  notes: [
    note({ id: "live-note" }),
    note({
      id: "deleted-note",
      deletedAt: "2026-01-02T10:00:00.000Z"
    })
  ],
  legacy: { source: "spark", stage: "workshop" }
});
const third = writerPackage({ id: "third-package" });
const collection = [first, target, third];
const collectionBefore = JSON.stringify(collection);
const changed = ready(
  plan({
    packages: collection,
    packageId: target.id,
    expectedUpdatedAt: target.updatedAt,
    workshopText: "Changed only this artificial workshop.",
    now: "2026-01-03T09:10:11.123Z"
  })
);

check(
  changed.packages.map((candidate) => candidate.id).join(",") ===
    "first-package,target-package,third-package" &&
    changed.updatedPackage === changed.packages[1],
  "A ready plan must preserve collection order and expose its updated package."
);
check(
  changed.updatedPackage.workshopText === "Changed only this artificial workshop." &&
    changed.updatedPackage.updatedAt === "2026-01-03T09:10:11.123Z" &&
    changed.previousUpdatedAt === UPDATED_AT &&
    changed.nextUpdatedAt === "2026-01-03T09:10:11.123Z",
  "B a ready plan must change workshopText and updatedAt only."
);
check(
  changed.updatedPackage.title === target.title &&
    changed.updatedPackage.sparkText === target.sparkText &&
    changed.updatedPackage.finalText === target.finalText &&
    changed.updatedPackage.createdAt === target.createdAt &&
    changed.updatedPackage.deletedAt === target.deletedAt &&
    changed.updatedPackage.packageVersion === target.packageVersion &&
    JSON.stringify(changed.updatedPackage.notes) === JSON.stringify(target.notes) &&
    JSON.stringify(changed.updatedPackage.legacy) === JSON.stringify(target.legacy),
  "C every field outside workshopText and top-level updatedAt must remain exact."
);
check(
  JSON.stringify(changed.packages[0]) === JSON.stringify(first) &&
    JSON.stringify(changed.packages[2]) === JSON.stringify(third),
  "D unrelated Packages must remain semantically unchanged."
);
check(
  JSON.stringify(collection) === collectionBefore,
  "E planning must not mutate the input collection or Packages."
);
check(
  Object.isFrozen(changed) &&
    Object.isFrozen(changed.packages) &&
    changed.packages.every((candidate) =>
      Object.isFrozen(candidate) &&
      Object.isFrozen(candidate.notes) &&
      candidate.notes.every(Object.isFrozen) &&
      (candidate.legacy === undefined || Object.isFrozen(candidate.legacy))
    ),
  "F ready output must be deeply frozen."
);
check(
  changed.packages !== collection &&
    changed.packages[0] !== first &&
    changed.updatedPackage !== target &&
    changed.updatedPackage.notes !== target.notes &&
    changed.updatedPackage.notes[0] !== target.notes[0] &&
    changed.updatedPackage.legacy !== target.legacy,
  "G ready output must be deeply detached from every input Package."
);

target.title = "Later input title mutation";
target.notes[0].text = "Later input note mutation";
collection.push(writerPackage({ id: "late-package" }));
check(
  changed.packages.length === 3 &&
    changed.updatedPackage.title === "Artificial title" &&
    changed.updatedPackage.notes[0].text === "Artificial note text.",
  "H later input mutation must not affect a completed plan."
);

const emptyText = ready(plan({ workshopText: "" }));
check(
  emptyText.updatedPackage.workshopText === "",
  "I an explicit empty workshopText edit must be valid."
);

const noChangeInput = writerPackage();
const noChange = unchanged(
  plan({
    packages: [noChangeInput],
    workshopText: noChangeInput.workshopText,
    now: "not-needed-for-an-unchanged-plan"
  })
);
check(
  noChange.package.updatedAt === UPDATED_AT &&
    noChange.package.workshopText === noChangeInput.workshopText &&
    Object.isFrozen(noChange) &&
    Object.isFrozen(noChange.package) &&
    Object.isFrozen(noChange.package.notes) &&
    noChange.package !== noChangeInput,
  "J unchanged text must not advance time and must return a detached frozen Package."
);

check(
  ready(plan({ now: UPDATED_AT })).nextUpdatedAt === "2026-01-02T08:00:00.001Z" &&
    ready(plan({ now: "2025-12-01T00:00:00.000Z" })).nextUpdatedAt ===
      "2026-01-02T08:00:00.001Z",
  "K equal or older injected time must advance the current revision by one millisecond."
);
check(
  ready(plan({ now: "2026-01-03T10:11:12Z" })).nextUpdatedAt ===
    "2026-01-03T10:11:12.000Z",
  "L a newer injected time must be canonicalized."
);
check(
  isBlocked(plan({ now: "not-a-date" }), "invalid-now"),
  "M an invalid injected time must block a changed edit."
);
check(
  isBlocked(plan({ packageId: "missing-package" }), "package-not-found") &&
    isBlocked(plan({ packageId: "" }), "package-not-found"),
  "N a missing or empty selected ID must block without creating a Package."
);
check(
  isBlocked(
    plan({
      packages: [
        writerPackage({ deletedAt: "2026-01-03T08:00:00.000Z" })
      ]
    }),
    "package-deleted"
  ),
  "O a tombstoned Package must block."
);
check(
  isBlocked(
    plan({ expectedUpdatedAt: "2026-01-02T08:00:00.001Z" }),
    "stale-revision"
  ),
  "P an expected revision mismatch must block."
);
check(
  isBlocked(
    plan({
      packages: [
        writerPackage({ id: "duplicate" }),
        writerPackage({ id: "duplicate" })
      ],
      packageId: "duplicate"
    }),
    "duplicate-package-id"
  ),
  "Q duplicate Package IDs must block."
);
check(
  isBlocked(
    plan({
      packages: [writerPackage({ updatedAt: "invalid-date" })]
    }),
    "invalid-package-collection"
  ) &&
    isBlocked(
      plan({
        packages: [
          {
            ...writerPackage(),
            legacy: null
          } as unknown as WriterPackage
        ]
      }),
      "invalid-package-collection"
    ),
  "R an invalid Package collection must block safely."
);

const repeatInput = {
  packages: [writerPackage()],
  packageId: "artificial-package",
  expectedUpdatedAt: UPDATED_AT,
  workshopText: "Repeatable artificial edit.",
  now: "2026-01-03T09:10:11.123Z"
} as const;
const repeatA = ready(planWriterPackageWorkshopEdit(repeatInput));
const repeatB = ready(planWriterPackageWorkshopEdit(repeatInput));
check(
  JSON.stringify(repeatA) === JSON.stringify(repeatB) &&
    repeatA !== repeatB &&
    repeatA.packages !== repeatB.packages,
  "S equivalent calls must be deterministic and independently allocated."
);

console.log(`WriterPackage workshop edit checks: ${passed}/${passed} passed.`);
