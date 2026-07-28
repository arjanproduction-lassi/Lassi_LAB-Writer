import type { Spark, WriterDbExport, WriterPackage } from "./types";
import {
  buildLegacySparkRetirementInventory,
  createGoogleDriveLegacySparkInventorySource,
  createLocalLegacySparkInventorySource,
  createWriterDbV2BackupLegacySparkInventorySource,
  type LegacySparkInventorySource
} from "./legacySparkRetirementInventory";
import type { WriterDbV2 } from "./writerDb";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function createSpark(overrides: Partial<Spark> = {}): Spark {
  return {
    id: "artificial-spark",
    text: "Artificial private text that must never enter the inventory output.",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    temperature: "spark",
    tags: ["artificial"],
    schemaVersion: 1,
    ...overrides
  };
}

function createPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "artificial-package",
    title: "Artificial package",
    sparkText: "Artificial Package text.",
    notes: [],
    workshopText: "",
    finalText: "",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

const localSparks = [
  createSpark({ id: "shared", updatedAt: "2026-01-02T08:00:00.000Z" }),
  createSpark({ id: "local-only", updatedAt: "2026-01-03T08:00:00.000Z" })
];
const driveDb: WriterDbExport = {
  app: "LassiLAB Writer",
  schemaVersion: 1,
  exportedAt: "2026-01-05T08:00:00.000Z",
  sparkCount: 2,
  sparks: [
    createSpark({
      id: "shared",
      updatedAt: "2026-01-04T08:00:00.000Z",
      deletedAt: "2026-01-04T08:00:00.000Z"
    }),
    createSpark({ id: "drive-live", updatedAt: "2026-01-05T08:00:00.000Z" })
  ]
};
const backupDb: WriterDbV2 = {
  app: "LassiLAB Writer",
  schemaVersion: 2,
  exportedAt: "2026-01-06T08:00:00.000Z",
  sparkCount: 2,
  packageCount: 2,
  sparks: [
    createSpark({ id: "shared", updatedAt: "2026-01-01T08:00:00.000Z" }),
    createSpark({
      id: "backup-tombstone",
      updatedAt: "2026-01-06T08:00:00.000Z",
      deletedAt: "2026-01-06T08:00:00.000Z"
    })
  ],
  packages: [createPackage(), createPackage({ id: "deleted-package", deletedAt: "2026-01-06T08:00:00.000Z" })]
};

const sources: LegacySparkInventorySource[] = [
  createLocalLegacySparkInventorySource("pc", localSparks),
  createGoogleDriveLegacySparkInventorySource("drive-v1", driveDb),
  createWriterDbV2BackupLegacySparkInventorySource("backup-v2", backupDb)
];
const inputBefore = JSON.stringify({ sources, packages: backupDb.packages });
const inventory = buildLegacySparkRetirementInventory({
  sources,
  packages: backupDb.packages,
  draftPresent: true
});

check(inventory.status === "ready-for-backup", "R1 must stop at ready-for-backup.");
check(inventory.sources.length === 3, "Inventory must summarize every supplied source.");
check(
  inventory.sources[0].sparkCount === 2 &&
    inventory.sources[0].liveSparkCount === 2 &&
    inventory.sources[0].tombstoneCount === 0,
  "Local source counts must distinguish live records and tombstones."
);
check(
  inventory.sources[1].liveSparkCount === 1 && inventory.sources[1].tombstoneCount === 1,
  "Drive source counts must distinguish live records and tombstones."
);
check(
  inventory.uniqueSparkIds.join(",") === "backup-tombstone,drive-live,local-only,shared",
  "Inventory must expose one deterministic union of Spark ids."
);
check(inventory.liveSparkCount === 3, "Live count must count unique ids with a live copy.");
check(inventory.tombstoneCount === 2, "Tombstone count must count unique ids with a tombstone copy.");
check(inventory.packageCount === 2, "Package count must include every supplied real Package.");
check(inventory.draftPresent, "Draft presence must be copied without draft content.");
check(inventory.resurrectionRisk, "Any observed live Spark must keep resurrection risk true.");

const shared = inventory.sparkIds.find((summary) => summary.id === "shared");
check(shared?.latestUpdatedAt === "2026-01-04T08:00:00.000Z", "Latest timestamp must be the observed maximum.");
check(shared?.liveSourceIds.join(",") === "pc,backup-v2", "Live source ids must be preserved in source order.");
check(shared?.tombstoneSourceIds.join(",") === "drive-v1", "Tombstone source ids must be explicit.");
check(
  !JSON.stringify(inventory).includes("Artificial private text"),
  "Inventory output must not contain Spark author text."
);
check(
  JSON.stringify({ sources, packages: backupDb.packages }) === inputBefore,
  "Inventory construction must not mutate sources, Sparks, or Packages."
);
check(
  Object.isFrozen(inventory) &&
    Object.isFrozen(inventory.sources) &&
    Object.isFrozen(inventory.sparkIds) &&
    Object.isFrozen(inventory.uniqueSparkIds),
  "Inventory and its top-level collections must be frozen."
);
check(
  Object.isFrozen(inventory.sources[0]) &&
    Object.isFrozen(inventory.sparkIds[0]) &&
    Object.isFrozen(inventory.sparkIds[0].liveSourceIds) &&
    Object.isFrozen(inventory.sparkIds[0].tombstoneSourceIds),
  "Nested inventory summaries must be frozen."
);
check(
  JSON.stringify(inventory) === JSON.stringify(buildLegacySparkRetirementInventory({
    sources,
    packages: backupDb.packages,
    draftPresent: true
  })),
  "Same input must produce an equivalent deterministic inventory."
);

const empty = buildLegacySparkRetirementInventory({ sources: [], packages: [], draftPresent: false });
check(
  empty.uniqueSparkIds.length === 0 &&
    empty.liveSparkCount === 0 &&
    empty.tombstoneCount === 0 &&
    empty.packageCount === 0 &&
    !empty.draftPresent &&
    !empty.resurrectionRisk,
  "Empty input must produce a truthful empty inventory without risk."
);

const tombstoneOnly = buildLegacySparkRetirementInventory({
  sources: [createLocalLegacySparkInventorySource("retired", [createSpark({ deletedAt: "2026-01-01T08:00:00.000Z" })])],
  packages: [],
  draftPresent: false
});
check(!tombstoneOnly.resurrectionRisk, "Tombstone-only observed state must have no live-copy risk.");
check(sources[0].sourceKind === "local-device", "Local source helper must label the real source kind.");
check(sources[1].sourceKind === "google-drive", "Drive v1 helper must label the real source kind.");
check(sources[2].sourceKind === "imported-backup", "Writer DB v2 helper must label the backup source kind.");
check(
  sources[1].sparks !== driveDb.sparks && sources[2].sparks !== backupDb.sparks,
  "Typed DB source helpers must copy their Spark arrays."
);

let duplicateSourceFailed = false;
try {
  buildLegacySparkRetirementInventory({
    sources: [
      createLocalLegacySparkInventorySource("duplicate", []),
      createLocalLegacySparkInventorySource("duplicate", [])
    ],
    packages: [],
    draftPresent: false
  });
} catch {
  duplicateSourceFailed = true;
}
check(duplicateSourceFailed, "Duplicate source ids must block inventory construction.");

let duplicateSparkFailed = false;
try {
  buildLegacySparkRetirementInventory({
    sources: [createLocalLegacySparkInventorySource("duplicates", [
      createSpark({ id: "duplicate" }),
      createSpark({ id: "duplicate" })
    ])],
    packages: [],
    draftPresent: false
  });
} catch {
  duplicateSparkFailed = true;
}
check(duplicateSparkFailed, "Duplicate Spark ids inside one source must block the inventory.");

let duplicatePackageFailed = false;
try {
  buildLegacySparkRetirementInventory({
    sources: [],
    packages: [createPackage({ id: "duplicate" }), createPackage({ id: "duplicate" })],
    draftPresent: false
  });
} catch {
  duplicatePackageFailed = true;
}
check(duplicatePackageFailed, "Duplicate Package ids must block the inventory.");

const specialId = buildLegacySparkRetirementInventory({
  sources: [createLocalLegacySparkInventorySource("special", [createSpark({ id: "__proto__" })])],
  packages: [],
  draftPresent: false
});
check(specialId.uniqueSparkIds[0] === "__proto__", "Special string ids must remain safe data values.");

export const legacySparkRetirementInventoryCheckCount = passed;
console.log(`Legacy Spark retirement inventory checks: ${passed}/${passed} passed.`);
