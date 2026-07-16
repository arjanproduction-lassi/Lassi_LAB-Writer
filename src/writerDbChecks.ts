import type { Spark, WriterPackage } from "./types";
import type {
  ImportCollectionPreview,
  WriterDb,
  WriterDbImportPreview,
  WriterDbV1
} from "./writerDb";
import {
  WRITER_DB_APP_NAME,
  WRITER_DB_V1_SCHEMA_VERSION,
  WRITER_DB_V2_SCHEMA_VERSION,
  createWriterDbV2Payload,
  parseWriterDbJson,
  parseWriterDbPayload,
  previewWriterDbImport
} from "./writerDb";

type TestCase = {
  name: string;
  run: () => void;
};

const EXPORTED_AT = "2026-07-16T15:00:00.000Z";

const normalSpark: Spark = {
  id: "spark-normal",
  title: "Normal Spark",
  text: "Normal spark text",
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:01:00.000Z",
  temperature: "spark",
  tags: [],
  schemaVersion: 1
};

const stagedSpark: Spark = {
  id: "spark-staged",
  text: "Staged spark text",
  createdAt: "2026-07-16T10:10:00.000Z",
  updatedAt: "2026-07-16T10:11:00.000Z",
  stage: "workshop",
  temperature: "spark",
  tags: ["stage"],
  schemaVersion: 1
};

const deletedSpark: Spark = {
  id: "spark-deleted",
  text: "Deleted spark text",
  createdAt: "2026-07-16T10:20:00.000Z",
  updatedAt: "2026-07-16T10:22:00.000Z",
  deletedAt: "2026-07-16T10:22:00.000Z",
  stage: "notes",
  temperature: "spark",
  tags: [],
  schemaVersion: 1
};

const basicPackage: WriterPackage = {
  id: "package-basic",
  title: "Basic Package",
  sparkText: "Package spark",
  notes: [],
  workshopText: "Workshop text",
  finalText: "Final text",
  createdAt: "2026-07-16T11:00:00.000Z",
  updatedAt: "2026-07-16T11:01:00.000Z",
  packageVersion: 1
};

const packageWithNotes: WriterPackage = {
  id: "package-notes",
  title: "Package With Notes",
  sparkText: "Package note spark",
  notes: [
    {
      id: "note-one",
      text: "First note",
      createdAt: "2026-07-16T11:10:00.000Z",
      updatedAt: "2026-07-16T11:11:00.000Z"
    },
    {
      id: "note-two-deleted",
      text: "Deleted note",
      createdAt: "2026-07-16T11:20:00.000Z",
      updatedAt: "2026-07-16T11:22:00.000Z",
      deletedAt: "2026-07-16T11:22:00.000Z"
    }
  ],
  workshopText: "Workshop with notes",
  finalText: "Final with notes",
  createdAt: "2026-07-16T11:10:00.000Z",
  updatedAt: "2026-07-16T11:22:00.000Z",
  packageVersion: 1
};

const sharedIdSpark: Spark = {
  id: "shared-id",
  text: "Legacy Spark with shared id",
  createdAt: "2026-07-16T12:00:00.000Z",
  updatedAt: "2026-07-16T12:01:00.000Z",
  temperature: "spark",
  tags: [],
  schemaVersion: 1
};

const sharedIdPackage: WriterPackage = {
  id: "shared-id",
  title: "Real Package With Shared Id",
  sparkText: "Real package spark",
  notes: [],
  workshopText: "",
  finalText: "",
  createdAt: "2026-07-16T12:00:00.000Z",
  updatedAt: "2026-07-16T12:02:00.000Z",
  packageVersion: 1
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  assert(actualJson === expectedJson, `${message}\nexpected: ${expectedJson}\nactual:   ${actualJson}`);
}

function createV2(sparks: Spark[], packages: WriterPackage[]) {
  return createWriterDbV2Payload({
    sparks,
    packages,
    exportedAt: EXPORTED_AT
  });
}

function createV1(sparks: Spark[], sparkCount = sparks.length): WriterDbV1 {
  return {
    app: WRITER_DB_APP_NAME,
    schemaVersion: WRITER_DB_V1_SCHEMA_VERSION,
    exportedAt: EXPORTED_AT,
    sparkCount,
    sparks
  };
}

function preview(
  incoming: WriterDb,
  localSparks: readonly Spark[] = [],
  localPackages: readonly WriterPackage[] = []
): WriterDbImportPreview {
  return previewWriterDbImport({
    incoming,
    localSparks,
    localPackages
  });
}

function warningCodes(result: WriterDbImportPreview) {
  return result.warnings.map((warning) => warning.code);
}

function blockingIssueCodes(result: WriterDbImportPreview) {
  return result.blockingIssues.map((issue) => issue.code);
}

function collectionPreview(
  mode: ImportCollectionPreview["mode"],
  overrides: Partial<ImportCollectionPreview> = {}
): ImportCollectionPreview {
  return {
    mode,
    incoming: 0,
    create: 0,
    update: 0,
    unchanged: 0,
    ignoredOlder: 0,
    tombstones: 0,
    ...overrides
  };
}

function assertRoundTrip(
  name: string,
  sparks: Spark[],
  packages: WriterPackage[]
) {
  const payload = createV2(sparks, packages);
  const parsed = parseWriterDbJson(JSON.stringify(payload));

  assert(parsed.ok, `${name}: v2 payload should parse`);
  assert(parsed.db.schemaVersion === WRITER_DB_V2_SCHEMA_VERSION, `${name}: schemaVersion changed`);
  assert(parsed.db.app === WRITER_DB_APP_NAME, `${name}: app marker changed`);
  assert(parsed.db.exportedAt === EXPORTED_AT, `${name}: exportedAt changed`);
  assert(parsed.db.sparkCount === sparks.length, `${name}: sparkCount mismatch`);
  assert(parsed.db.packageCount === packages.length, `${name}: packageCount mismatch`);
  assertDeepEqual(parsed.db.sparks, sparks, `${name}: sparks changed`);
  assertDeepEqual(parsed.db.packages, packages, `${name}: packages changed`);
}

function assertRejected(name: string, value: unknown) {
  const parsed = parseWriterDbJson(JSON.stringify(value));
  assert(!parsed.ok, `${name}: payload should be rejected`);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const parserAndExportTests: TestCase[] = [
  {
    name: "empty v2 DB round-trips",
    run: () => assertRoundTrip("empty", [], [])
  },
  {
    name: "sparks-only v2 DB round-trips with stage and deletedAt",
    run: () => assertRoundTrip("sparks-only", [normalSpark, stagedSpark, deletedSpark], [])
  },
  {
    name: "basic WriterPackage-only v2 DB round-trips",
    run: () => assertRoundTrip("package-only", [], [basicPackage])
  },
  {
    name: "WriterPackage notes round-trip including deleted note",
    run: () => assertRoundTrip("package-notes", [], [packageWithNotes])
  },
  {
    name: "Spark and WriterPackage with the same id both survive",
    run: () => assertRoundTrip("shared-id", [sharedIdSpark], [sharedIdPackage])
  },
  {
    name: "count mismatch remains informational while parsing",
    run: () => {
      const payload = {
        ...createV2([normalSpark], [basicPackage]),
        sparkCount: 99,
        packageCount: 77
      };
      const parsed = parseWriterDbJson(JSON.stringify(payload));

      assert(parsed.ok, "count mismatch should still parse");
      assert(parsed.db.schemaVersion === 2, "count mismatch should stay v2");
      assert(parsed.db.sparkCount === 99, "parser should preserve informational sparkCount");
      assert(parsed.db.packageCount === 77, "parser should preserve informational packageCount");
      assert(parsed.db.sparks.length === 1, "spark array should remain source of truth");
      assert(parsed.db.packages.length === 1, "package array should remain source of truth");
    }
  },
  {
    name: "invalid JSON is rejected",
    run: () => {
      const parsed = parseWriterDbJson("{not valid json");
      assert(!parsed.ok, "invalid JSON should return ok: false");
    }
  },
  {
    name: "unknown schemaVersion is rejected",
    run: () => assertRejected("schemaVersion 3", { ...createV2([], []), schemaVersion: 3 })
  },
  {
    name: "damaged Spark rejects the whole payload",
    run: () => {
      const damagedSpark = { ...normalSpark, updatedAt: "not-a-date" };
      assertRejected("damaged Spark", { ...createV2([], []), sparks: [damagedSpark], sparkCount: 1 });
    }
  },
  {
    name: "wrong WriterPackage packageVersion rejects the whole payload",
    run: () => {
      const damagedPackage = { ...basicPackage, packageVersion: 2 };
      assertRejected("wrong packageVersion", {
        ...createV2([], []),
        packages: [damagedPackage],
        packageCount: 1
      });
    }
  },
  {
    name: "invalid WriterPackage note rejects the whole payload",
    run: () => {
      const damagedPackage = {
        ...packageWithNotes,
        notes: [{ ...packageWithNotes.notes[0], id: "" }]
      };
      assertRejected("invalid note", {
        ...createV2([], []),
        packages: [damagedPackage],
        packageCount: 1
      });
    }
  },
  {
    name: "createWriterDbV2Payload does not mutate input arrays",
    run: () => {
      const sparks = [normalSpark, stagedSpark];
      const packages = [basicPackage, packageWithNotes];
      const sparksBefore = cloneJson(sparks);
      const packagesBefore = cloneJson(packages);
      const payload = createV2(sparks, packages);

      assert(payload.sparks !== sparks, "builder should create a new sparks array");
      assert(payload.packages !== packages, "builder should create a new packages array");
      assert(payload.sparks[0] === normalSpark, "builder should not rewrite Spark objects");
      assert(payload.packages[0] === basicPackage, "builder should not rewrite WriterPackage objects");
      assertDeepEqual(sparks, sparksBefore, "builder mutated input sparks");
      assertDeepEqual(packages, packagesBefore, "builder mutated input packages");
    }
  },
  {
    name: "parseWriterDbPayload is read-only and does not touch localStorage",
    run: () => {
      let localStorageTouches = 0;
      const throwingStorage = {
        getItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("parseWriterDbPayload touched localStorage");
        },
        setItem(_key: string, _value: string) {
          localStorageTouches += 1;
          throw new Error("parseWriterDbPayload touched localStorage");
        },
        removeItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("parseWriterDbPayload touched localStorage");
        }
      };

      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = {
        localStorage: throwingStorage
      };

      const payload = createV2([deletedSpark], [packageWithNotes]);
      const before = JSON.stringify(payload);
      const parsed = parseWriterDbPayload(payload);
      const after = JSON.stringify(payload);

      assert(parsed.ok, "valid payload should parse");
      assert(before === after, "parser mutated input payload");
      assert(localStorageTouches === 0, "parser touched localStorage");
    }
  }
];

const importPreviewTests: TestCase[] = [
  {
    name: "v1 previews new Sparks and leaves Packages untouched",
    run: () => {
      const result = preview(createV1([normalSpark]), [], [basicPackage]);

      assert(result.status === "ready", "v1 new Spark preview should be ready");
      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, create: 1 }),
        "v1 new Spark counts are wrong"
      );
      assertDeepEqual(
        result.packages,
        collectionPreview("untouched"),
        "v1 should leave Packages untouched"
      );
      assertDeepEqual(
        result.source,
        {
          declaredSparkCount: 1,
          actualSparkCount: 1,
          declaredPackageCount: null,
          actualPackageCount: 0
        },
        "v1 source counts are wrong"
      );
      assertDeepEqual(
        warningCodes(result),
        ["v1-packages-untouched"],
        "v1 untouched warning is missing"
      );
    }
  },
  {
    name: "v1 previews a newer Spark as update",
    run: () => {
      const incoming = {
        ...normalSpark,
        text: "Newer incoming text",
        updatedAt: "2026-07-16T10:02:00.000Z"
      };
      const result = preview(createV1([incoming]), [normalSpark]);

      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, update: 1 }),
        "newer Spark should preview as update"
      );
    }
  },
  {
    name: "v1 previews an older Spark as ignoredOlder",
    run: () => {
      const incoming = {
        ...normalSpark,
        text: "Older incoming text",
        updatedAt: "2026-07-16T09:59:00.000Z"
      };
      const result = preview(createV1([incoming]), [normalSpark]);

      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, ignoredOlder: 1 }),
        "older Spark should be ignored"
      );
    }
  },
  {
    name: "v1 previews an equal Spark timestamp as unchanged",
    run: () => {
      const incoming = { ...normalSpark, text: "Different text with equal timestamp" };
      const result = preview(createV1([incoming]), [normalSpark]);

      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, unchanged: 1 }),
        "equal Spark timestamp should be unchanged"
      );
    }
  },
  {
    name: "v2 previews new Sparks and Packages independently",
    run: () => {
      const result = preview(createV2([normalSpark], [basicPackage]));

      assert(result.status === "ready", "v2 new records preview should be ready");
      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, create: 1 }),
        "v2 new Spark counts are wrong"
      );
      assertDeepEqual(
        result.packages,
        collectionPreview("merge", { incoming: 1, create: 1 }),
        "v2 new Package counts are wrong"
      );
      assertDeepEqual(result.warnings, [], "valid v2 new records should have no warnings");
    }
  },
  {
    name: "v2 previews Package update by top-level updatedAt",
    run: () => {
      const incomingPackage: WriterPackage = {
        ...basicPackage,
        notes: [packageWithNotes.notes[0]],
        workshopText: "New workshop text",
        updatedAt: "2026-07-16T11:05:00.000Z"
      };
      const result = preview(createV2([], [incomingPackage]), [], [basicPackage]);

      assertDeepEqual(
        result.packages,
        collectionPreview("merge", { incoming: 1, update: 1 }),
        "newer Package should preview as one whole-record update"
      );
    }
  },
  {
    name: "newer incoming tombstone follows updatedAt and previews as update",
    run: () => {
      const incoming: Spark = {
        ...normalSpark,
        updatedAt: "2026-07-16T10:03:00.000Z",
        deletedAt: "2026-07-16T10:03:00.000Z"
      };
      const result = preview(createV2([incoming], []), [normalSpark]);

      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, update: 1, tombstones: 1 }),
        "newer tombstone should preview as update"
      );
      assertDeepEqual(
        warningCodes(result),
        ["contains-tombstones"],
        "newer tombstone warning is missing"
      );
    }
  },
  {
    name: "older incoming tombstone follows updatedAt and is ignored",
    run: () => {
      const local: Spark = {
        ...normalSpark,
        updatedAt: "2026-07-16T10:05:00.000Z"
      };
      const incoming: Spark = {
        ...normalSpark,
        updatedAt: "2026-07-16T10:02:00.000Z",
        deletedAt: "2026-07-16T10:02:00.000Z"
      };
      const result = preview(createV2([incoming], []), [local]);

      assertDeepEqual(
        result.sparks,
        collectionPreview("merge", { incoming: 1, ignoredOlder: 1, tombstones: 1 }),
        "older tombstone should remain ignoredOlder"
      );
      assertDeepEqual(
        warningCodes(result),
        ["contains-tombstones"],
        "older tombstone warning is missing"
      );
    }
  },
  {
    name: "count mismatches add warnings without blocking preview",
    run: () => {
      const parsed = parseWriterDbPayload({
        ...createV2([normalSpark], [basicPackage]),
        sparkCount: 99,
        packageCount: 77
      });

      assert(parsed.ok, "count mismatch payload should parse before preview");
      const result = preview(parsed.db);

      assert(result.status === "ready", "count mismatch should not block preview");
      assertDeepEqual(
        warningCodes(result),
        ["count-mismatch", "count-mismatch"],
        "count mismatch warning order is wrong"
      );
      const [sparkWarning, packageWarning] = result.warnings;
      assert(
        sparkWarning.code === "count-mismatch" && sparkWarning.collection === "sparks",
        "Spark count mismatch warning is wrong"
      );
      assert(
        packageWarning.code === "count-mismatch" && packageWarning.collection === "packages",
        "Package count mismatch warning is wrong"
      );
    }
  },
  {
    name: "empty v2 import stays ready and adds warning",
    run: () => {
      const result = preview(createV2([], []));

      assert(result.status === "ready", "empty import should remain ready");
      assertDeepEqual(result.sparks, collectionPreview("merge"), "empty Spark preview is wrong");
      assertDeepEqual(result.packages, collectionPreview("merge"), "empty Package preview is wrong");
      assertDeepEqual(warningCodes(result), ["empty-import"], "empty import warning is missing");
    }
  },
  {
    name: "same id across Spark and Package adds informational warning",
    run: () => {
      const result = preview(createV2([sharedIdSpark], [sharedIdPackage]));

      assert(result.status === "ready", "cross-model id should not block preview");
      assertDeepEqual(
        warningCodes(result),
        ["cross-model-id-overlap"],
        "cross-model id warning is missing"
      );
      const warning = result.warnings[0];
      assert(
        warning.code === "cross-model-id-overlap" && warning.count === 1,
        "cross-model id warning count is wrong"
      );
      assert(result.sparks.create === 1, "shared-id Spark should remain independent");
      assert(result.packages.create === 1, "shared-id Package should remain independent");
    }
  },
  {
    name: "previewWriterDbImport does not mutate incoming or local data",
    run: () => {
      const incoming = createV2([deletedSpark], [packageWithNotes]);
      const localSparks = [normalSpark, stagedSpark];
      const localPackages = [basicPackage, packageWithNotes];
      const incomingBefore = cloneJson(incoming);
      const localSparksBefore = cloneJson(localSparks);
      const localPackagesBefore = cloneJson(localPackages);

      preview(incoming, localSparks, localPackages);

      assertDeepEqual(incoming, incomingBefore, "preview mutated incoming DB");
      assertDeepEqual(localSparks, localSparksBefore, "preview mutated local Sparks");
      assertDeepEqual(localPackages, localPackagesBefore, "preview mutated local Packages or notes");
    }
  },
  {
    name: "previewWriterDbImport does not touch localStorage",
    run: () => {
      let localStorageTouches = 0;
      const throwingStorage = {
        getItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("previewWriterDbImport touched localStorage");
        },
        setItem(_key: string, _value: string) {
          localStorageTouches += 1;
          throw new Error("previewWriterDbImport touched localStorage");
        },
        removeItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("previewWriterDbImport touched localStorage");
        }
      };

      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = {
        localStorage: throwingStorage
      };

      const result = preview(createV2([normalSpark], [basicPackage]));

      assert(result.status === "ready", "valid preview should remain ready");
      assert(localStorageTouches === 0, "preview touched localStorage");
    }
  },
  {
    name: "duplicate ids inside incoming collections block preview",
    run: () => {
      const duplicateSpark: Spark = {
        ...normalSpark,
        text: "Duplicate Spark",
        updatedAt: "2026-07-16T10:02:00.000Z"
      };
      const duplicatePackage: WriterPackage = {
        ...basicPackage,
        title: "Duplicate Package",
        updatedAt: "2026-07-16T11:02:00.000Z"
      };
      const result = preview(
        createV2(
          [normalSpark, duplicateSpark],
          [basicPackage, duplicatePackage]
        )
      );

      assert(result.status === "blocked", "duplicate ids should block preview");
      assertDeepEqual(
        blockingIssueCodes(result),
        ["duplicate-spark-id", "duplicate-package-id"],
        "duplicate blocking issue order is wrong"
      );
      assert(result.blockingIssues[0].count === 1, "duplicate Spark id count is wrong");
      assert(result.blockingIssues[1].count === 1, "duplicate Package id count is wrong");
    }
  }
];

const tests: TestCase[] = [...parserAndExportTests, ...importPreviewTests];

export function runWriterDbChecks() {
  let passed = 0;

  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok ${passed} - ${test.name}`);
  }

  console.log(
    `Writer DB checks passed: ${passed}/${tests.length} ` +
      `(${parserAndExportTests.length} existing, ${importPreviewTests.length} import preview)`
  );
}

runWriterDbChecks();
