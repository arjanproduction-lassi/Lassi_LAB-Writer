import type { Spark, WriterPackage } from "./types";
import type {
  ImportCollectionPreview,
  WriterDb,
  WriterDbImportBackupResult,
  WriterDbImportPreview,
  WriterDbInMemoryMergeResult,
  WriterDbV1
} from "./writerDb";
import {
  WRITER_DB_APP_NAME,
  WRITER_DB_V1_SCHEMA_VERSION,
  WRITER_DB_V2_SCHEMA_VERSION,
  createWriterDbImportBackup,
  createWriterDbV2Payload,
  mergeWriterDbInMemory,
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

function merge(
  incoming: WriterDb,
  localSparks: readonly Spark[] = [],
  localPackages: readonly WriterPackage[] = []
): WriterDbInMemoryMergeResult {
  return mergeWriterDbInMemory({
    incoming,
    localSparks,
    localPackages
  });
}

function assertMergeOk(
  result: WriterDbInMemoryMergeResult,
  message: string
): asserts result is Extract<WriterDbInMemoryMergeResult, { ok: true }> {
  assert(result.ok, `${message}: ${result.ok ? "" : result.error}`);
}

function createBackup(
  sourceSchemaVersion: WriterDb["schemaVersion"],
  localSparks: readonly Spark[] = [],
  localPackages: readonly WriterPackage[] = [],
  now?: string
): WriterDbImportBackupResult {
  return createWriterDbImportBackup({
    sourceSchemaVersion,
    localSparks,
    localPackages,
    ...(now === undefined ? {} : { now })
  });
}

function assertBackupOk(
  result: WriterDbImportBackupResult,
  message: string
): asserts result is Extract<WriterDbImportBackupResult, { ok: true }> {
  assert(result.ok, `${message}: ${result.ok ? "" : result.error}`);
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

const inMemoryMergeTests: TestCase[] = [
  {
    name: "v1 merge creates a new Spark and preserves Packages",
    run: () => {
      const localPackages = [packageWithNotes];
      const result = merge(createV1([normalSpark]), [], localPackages);

      assertMergeOk(result, "v1 new Spark merge should succeed");
      assertDeepEqual(result.sparks, [normalSpark], "v1 did not create the incoming Spark");
      assertDeepEqual(result.packages, localPackages, "v1 changed Package content");
      assert(result.packages !== localPackages, "v1 should return a new Package array");
      assertDeepEqual(
        warningCodes(result.preview),
        ["v1-packages-untouched"],
        "v1 merge lost the untouched warning"
      );
    }
  },
  {
    name: "v1 merge updates a newer Spark at its local position",
    run: () => {
      const incoming: Spark = {
        ...normalSpark,
        text: "Updated in place",
        updatedAt: "2026-07-16T10:05:00.000Z"
      };
      const result = merge(createV1([incoming]), [stagedSpark, normalSpark]);

      assertMergeOk(result, "v1 newer Spark merge should succeed");
      assertDeepEqual(
        result.sparks.map((spark) => spark.id),
        [stagedSpark.id, normalSpark.id],
        "Spark update changed local order"
      );
      assert(result.sparks[1].text === "Updated in place", "newer Spark did not replace local data");
    }
  },
  {
    name: "v1 merge ignores an older Spark",
    run: () => {
      const incoming: Spark = {
        ...normalSpark,
        text: "Older incoming text",
        updatedAt: "2026-07-16T09:59:00.000Z"
      };
      const result = merge(createV1([incoming]), [normalSpark]);

      assertMergeOk(result, "v1 older Spark merge should succeed");
      assertDeepEqual(result.sparks, [normalSpark], "older Spark replaced local data");
    }
  },
  {
    name: "equal updatedAt keeps the local Spark",
    run: () => {
      const incoming: Spark = {
        ...normalSpark,
        text: "Different incoming text"
      };
      const result = merge(createV1([incoming]), [normalSpark]);

      assertMergeOk(result, "equal Spark timestamp merge should succeed");
      assert(result.sparks[0].text === normalSpark.text, "equal timestamp did not keep local Spark");
    }
  },
  {
    name: "v2 merge creates a new Spark and Package",
    run: () => {
      const result = merge(createV2([normalSpark], [basicPackage]));

      assertMergeOk(result, "v2 new records merge should succeed");
      assertDeepEqual(result.sparks, [normalSpark], "v2 did not create new Spark");
      assertDeepEqual(result.packages, [basicPackage], "v2 did not create new Package");
    }
  },
  {
    name: "v2 merge replaces a whole Package by top-level updatedAt",
    run: () => {
      const incomingPackage: WriterPackage = {
        ...packageWithNotes,
        title: "Incoming whole Package",
        notes: [
          {
            id: "replacement-note",
            text: "Replacement note",
            createdAt: "2026-07-16T11:30:00.000Z",
            updatedAt: "2026-07-16T11:31:00.000Z"
          }
        ],
        workshopText: "Incoming workshop",
        updatedAt: "2026-07-16T11:31:00.000Z"
      };
      const localPackage: WriterPackage = {
        ...packageWithNotes,
        title: "Local Package",
        updatedAt: "2026-07-16T11:25:00.000Z"
      };
      const result = merge(createV2([], [incomingPackage]), [], [localPackage]);

      assertMergeOk(result, "v2 whole Package update should succeed");
      assertDeepEqual(result.packages, [incomingPackage], "Package was not replaced as one record");
      assert(result.packages[0].notes.length === 1, "Package notes were merged individually");
    }
  },
  {
    name: "newer incoming tombstone replaces an active Spark",
    run: () => {
      const incoming: Spark = {
        ...normalSpark,
        updatedAt: "2026-07-16T10:03:00.000Z",
        deletedAt: "2026-07-16T10:03:00.000Z"
      };
      const result = merge(createV2([incoming], []), [normalSpark]);

      assertMergeOk(result, "newer tombstone merge should succeed");
      assertDeepEqual(result.sparks, [incoming], "newer tombstone did not replace active Spark");
    }
  },
  {
    name: "older incoming tombstone is ignored",
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
      const result = merge(createV2([incoming], []), [local]);

      assertMergeOk(result, "older tombstone merge should succeed");
      assertDeepEqual(result.sparks, [local], "older tombstone replaced newer active Spark");
    }
  },
  {
    name: "new tombstone without local id is preserved",
    run: () => {
      const result = merge(createV2([deletedSpark], []));

      assertMergeOk(result, "new tombstone merge should succeed");
      assertDeepEqual(result.sparks, [deletedSpark], "new tombstone was not preserved");
    }
  },
  {
    name: "newer active Spark replaces an older tombstone",
    run: () => {
      const incoming: Spark = {
        ...deletedSpark,
        text: "Restored active Spark",
        updatedAt: "2026-07-16T10:23:00.000Z",
        deletedAt: undefined
      };
      const result = merge(createV2([incoming], []), [deletedSpark]);

      assertMergeOk(result, "newer active Spark merge should succeed");
      assert(result.sparks[0].text === "Restored active Spark", "active Spark did not replace tombstone");
      assert(result.sparks[0].deletedAt === undefined, "older tombstone remained active");
    }
  },
  {
    name: "missing incoming records never delete local records",
    run: () => {
      const localSparks = [normalSpark, stagedSpark];
      const localPackages = [basicPackage, packageWithNotes];
      const result = merge(createV2([], []), localSparks, localPackages);

      assertMergeOk(result, "empty merge should preserve local records");
      assertDeepEqual(result.sparks, localSparks, "missing Sparks deleted local records");
      assertDeepEqual(result.packages, localPackages, "missing Packages deleted local records");
    }
  },
  {
    name: "same id across models preserves both records",
    run: () => {
      const result = merge(createV2([sharedIdSpark], [sharedIdPackage]));

      assertMergeOk(result, "cross-model shared id merge should succeed");
      assertDeepEqual(result.sparks, [sharedIdSpark], "shared-id Spark was removed");
      assertDeepEqual(result.packages, [sharedIdPackage], "shared-id Package was removed");
      assertDeepEqual(
        warningCodes(result.preview),
        ["cross-model-id-overlap"],
        "cross-model warning was lost"
      );
    }
  },
  {
    name: "merge preserves local order and appends new records in incoming order",
    run: () => {
      const updatedNormal: Spark = {
        ...normalSpark,
        text: "Updated normal",
        updatedAt: "2026-07-16T10:05:00.000Z"
      };
      const newSparkA: Spark = {
        ...normalSpark,
        id: "spark-new-a",
        text: "New A",
        updatedAt: "2026-07-16T12:10:00.000Z"
      };
      const newSparkB: Spark = {
        ...normalSpark,
        id: "spark-new-b",
        text: "New B",
        updatedAt: "2026-07-16T12:20:00.000Z"
      };
      const updatedBasic: WriterPackage = {
        ...basicPackage,
        title: "Updated basic",
        updatedAt: "2026-07-16T11:05:00.000Z"
      };
      const newPackageA: WriterPackage = {
        ...basicPackage,
        id: "package-new-a",
        title: "New Package A"
      };
      const newPackageB: WriterPackage = {
        ...basicPackage,
        id: "package-new-b",
        title: "New Package B"
      };
      const result = merge(
        createV2(
          [newSparkA, updatedNormal, newSparkB],
          [newPackageA, updatedBasic, newPackageB]
        ),
        [normalSpark, stagedSpark],
        [basicPackage, packageWithNotes]
      );

      assertMergeOk(result, "stable-order merge should succeed");
      assertDeepEqual(
        result.sparks.map((spark) => spark.id),
        [normalSpark.id, stagedSpark.id, newSparkA.id, newSparkB.id],
        "Spark order is not stable"
      );
      assertDeepEqual(
        result.packages.map((writerPackage) => writerPackage.id),
        [basicPackage.id, packageWithNotes.id, newPackageA.id, newPackageB.id],
        "Package order is not stable"
      );
      assert(result.sparks[0].text === "Updated normal", "Spark update moved or disappeared");
      assert(result.packages[0].title === "Updated basic", "Package update moved or disappeared");
    }
  },
  {
    name: "blocked preview prevents merge",
    run: () => {
      const duplicate: Spark = {
        ...normalSpark,
        text: "Duplicate",
        updatedAt: "2026-07-16T10:02:00.000Z"
      };
      const incoming = createV2([normalSpark, duplicate], []);
      const incomingBefore = cloneJson(incoming);
      const result = merge(incoming);

      assert(!result.ok, "duplicate incoming ids should reject merge");
      assert(result.preview.status === "blocked", "rejected merge lost blocked preview");
      assertDeepEqual(
        blockingIssueCodes(result.preview),
        ["duplicate-spark-id"],
        "blocked merge lost duplicate issue"
      );
      assertDeepEqual(incoming, incomingBefore, "blocked merge mutated incoming DB");
    }
  },
  {
    name: "mergeWriterDbInMemory does not mutate its inputs",
    run: () => {
      const incoming = createV2([deletedSpark], [packageWithNotes]);
      const localSparks = [normalSpark, stagedSpark];
      const localPackages = [basicPackage, packageWithNotes];
      const incomingBefore = cloneJson(incoming);
      const localSparksBefore = cloneJson(localSparks);
      const localPackagesBefore = cloneJson(localPackages);

      const result = merge(incoming, localSparks, localPackages);

      assertMergeOk(result, "immutable input merge should succeed");
      assertDeepEqual(incoming, incomingBefore, "merge mutated incoming DB");
      assertDeepEqual(localSparks, localSparksBefore, "merge mutated local Sparks");
      assertDeepEqual(localPackages, localPackagesBefore, "merge mutated local Packages");
    }
  },
  {
    name: "merge result is deeply detached from incoming and local notes",
    run: () => {
      const packageWithLegacy: WriterPackage = {
        ...packageWithNotes,
        legacy: {
          source: "spark",
          stage: "notes"
        }
      };
      const incoming = createV2([stagedSpark], [packageWithLegacy]);
      const incomingResult = merge(incoming);
      assertMergeOk(incomingResult, "incoming deep-clone merge should succeed");

      incomingResult.sparks[0].tags.push("result-only");
      incomingResult.packages[0].notes[0].text = "Changed only in result";
      if (incomingResult.packages[0].legacy) {
        incomingResult.packages[0].legacy.stage = "final";
      }

      assertDeepEqual(stagedSpark.tags, ["stage"], "result tags mutated incoming Spark");
      assert(
        packageWithLegacy.notes[0].text === "First note",
        "result note mutated incoming Package"
      );
      assert(packageWithLegacy.legacy?.stage === "notes", "result mutated incoming legacy metadata");

      const localSparks = [stagedSpark];
      const localPackages = [packageWithNotes];
      const localResult = merge(createV1([]), localSparks, localPackages);
      assertMergeOk(localResult, "local deep-clone merge should succeed");
      localResult.sparks[0].tags.push("local-result-only");
      localResult.packages[0].notes[0].text = "Changed local result";
      assertDeepEqual(localSparks[0].tags, ["stage"], "result tags mutated local Spark");
      assert(
        localPackages[0].notes[0].text === "First note",
        "result note mutated local Package"
      );
    }
  },
  {
    name: "mergeWriterDbInMemory does not touch localStorage",
    run: () => {
      let localStorageTouches = 0;
      const throwingStorage = {
        getItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("mergeWriterDbInMemory touched localStorage");
        },
        setItem(_key: string, _value: string) {
          localStorageTouches += 1;
          throw new Error("mergeWriterDbInMemory touched localStorage");
        },
        removeItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("mergeWriterDbInMemory touched localStorage");
        }
      };

      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = {
        localStorage: throwingStorage
      };

      const result = merge(createV2([normalSpark], [basicPackage]));

      assertMergeOk(result, "localStorage guard merge should succeed");
      assert(localStorageTouches === 0, "merge touched localStorage");
    }
  },
  {
    name: "merge validation rejects an invalid resulting Spark",
    run: () => {
      const invalidLocal = {
        ...normalSpark,
        updatedAt: "not-a-date"
      } as Spark;
      const result = merge(createV2([], []), [invalidLocal]);

      assert(!result.ok, "invalid resulting Spark should reject merge");
      assert(result.error.includes("Neplatny Spark"), "invalid Spark error is unclear");
    }
  },
  {
    name: "merge validation rejects an invalid resulting packageVersion",
    run: () => {
      const invalidLocal = {
        ...basicPackage,
        packageVersion: 2
      } as unknown as WriterPackage;
      const result = merge(createV2([], []), [], [invalidLocal]);

      assert(!result.ok, "invalid resulting packageVersion should reject merge");
      assert(result.error.includes("WriterPackage"), "invalid Package error is unclear");
    }
  },
  {
    name: "merge validation rejects duplicate local ids",
    run: () => {
      const duplicateLocal: Spark = {
        ...normalSpark,
        text: "Duplicate local Spark"
      };
      const result = merge(createV2([], []), [normalSpark, duplicateLocal]);

      assert(!result.ok, "duplicate local ids should reject merge result");
      assert(result.error.includes("duplicitne Spark id"), "duplicate result error is unclear");
    }
  }
];

const backupFactoryTests: TestCase[] = [
  {
    name: "backup factory captures an empty state with current ISO time",
    run: () => {
      const result = createBackup(WRITER_DB_V2_SCHEMA_VERSION);

      assertBackupOk(result, "empty backup should succeed");
      assert(result.backup.backupVersion === 1, "backupVersion should be 1");
      assert(result.backup.reason === "before-import", "backup reason is wrong");
      assertDeepEqual(result.backup.sparks, [], "empty backup has Sparks");
      assertDeepEqual(result.backup.packages, [], "empty backup has Packages");
      assert(
        new Date(result.backup.createdAt).toISOString() === result.backup.createdAt,
        "default createdAt is not canonical ISO"
      );
      assert(
        Math.abs(Date.now() - Date.parse(result.backup.createdAt)) < 5000,
        "default createdAt is not current"
      );
    }
  },
  {
    name: "backup factory preserves sourceSchemaVersion 1",
    run: () => {
      const result = createBackup(WRITER_DB_V1_SCHEMA_VERSION, [], [], EXPORTED_AT);

      assertBackupOk(result, "v1 backup should succeed");
      assert(result.backup.sourceSchemaVersion === 1, "v1 sourceSchemaVersion changed");
    }
  },
  {
    name: "backup factory preserves sourceSchemaVersion 2",
    run: () => {
      const result = createBackup(WRITER_DB_V2_SCHEMA_VERSION, [], [], EXPORTED_AT);

      assertBackupOk(result, "v2 backup should succeed");
      assert(result.backup.sourceSchemaVersion === 2, "v2 sourceSchemaVersion changed");
    }
  },
  {
    name: "v1 backup includes both local Sparks and Packages",
    run: () => {
      const result = createBackup(
        WRITER_DB_V1_SCHEMA_VERSION,
        [normalSpark],
        [basicPackage],
        EXPORTED_AT
      );

      assertBackupOk(result, "v1 full-state backup should succeed");
      assertDeepEqual(result.backup.sparks, [normalSpark], "v1 backup lost Sparks");
      assertDeepEqual(result.backup.packages, [basicPackage], "v1 backup lost Packages");
    }
  },
  {
    name: "backup preserves record and note tombstones",
    run: () => {
      const deletedPackage: WriterPackage = {
        ...packageWithNotes,
        updatedAt: "2026-07-16T12:00:00.000Z",
        deletedAt: "2026-07-16T12:00:00.000Z"
      };
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [deletedSpark],
        [deletedPackage],
        EXPORTED_AT
      );

      assertBackupOk(result, "tombstone backup should succeed");
      assert(result.backup.sparks[0].deletedAt === deletedSpark.deletedAt, "Spark tombstone changed");
      assert(
        result.backup.packages[0].deletedAt === deletedPackage.deletedAt,
        "Package tombstone changed"
      );
      assert(
        result.backup.packages[0].notes[1].deletedAt === packageWithNotes.notes[1].deletedAt,
        "deleted note tombstone changed"
      );
    }
  },
  {
    name: "backup preserves Spark stage and tags",
    run: () => {
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [stagedSpark],
        [],
        EXPORTED_AT
      );

      assertBackupOk(result, "staged Spark backup should succeed");
      assert(result.backup.sparks[0].stage === "workshop", "Spark stage changed");
      assertDeepEqual(result.backup.sparks[0].tags, ["stage"], "Spark tags changed");
    }
  },
  {
    name: "backup preserves Package notes including deleted notes",
    run: () => {
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [],
        [packageWithNotes],
        EXPORTED_AT
      );

      assertBackupOk(result, "Package notes backup should succeed");
      assertDeepEqual(
        result.backup.packages[0].notes,
        packageWithNotes.notes,
        "Package notes changed"
      );
    }
  },
  {
    name: "backup preserves workshopText and finalText",
    run: () => {
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [],
        [basicPackage],
        EXPORTED_AT
      );

      assertBackupOk(result, "Package text backup should succeed");
      assert(
        result.backup.packages[0].workshopText === basicPackage.workshopText,
        "workshopText changed"
      );
      assert(result.backup.packages[0].finalText === basicPackage.finalText, "finalText changed");
    }
  },
  {
    name: "backup preserves legacy metadata",
    run: () => {
      const packageWithLegacy: WriterPackage = {
        ...basicPackage,
        legacy: {
          source: "spark",
          stage: "final"
        }
      };
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [],
        [packageWithLegacy],
        EXPORTED_AT
      );

      assertBackupOk(result, "legacy metadata backup should succeed");
      assertDeepEqual(
        result.backup.packages[0].legacy,
        packageWithLegacy.legacy,
        "legacy metadata changed"
      );
    }
  },
  {
    name: "backup factory uses deterministic createdAt from now",
    run: () => {
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [normalSpark],
        [basicPackage],
        EXPORTED_AT
      );

      assertBackupOk(result, "deterministic backup should succeed");
      assert(result.backup.createdAt === EXPORTED_AT, "deterministic createdAt changed");
    }
  },
  {
    name: "backup factory rejects invalid now",
    run: () => {
      const result = createBackup(WRITER_DB_V2_SCHEMA_VERSION, [], [], "not-a-date");

      assert(!result.ok, "invalid now should reject backup");
      assert(result.error.includes("createdAt"), "invalid now error is unclear");
    }
  },
  {
    name: "backup factory rejects invalid Spark",
    run: () => {
      const invalidSpark = {
        ...normalSpark,
        updatedAt: "not-a-date"
      } as Spark;
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [invalidSpark],
        [],
        EXPORTED_AT
      );

      assert(!result.ok, "invalid Spark should reject backup");
      assert(result.error.includes("Spark"), "invalid Spark backup error is unclear");
    }
  },
  {
    name: "backup factory rejects invalid Package",
    run: () => {
      const invalidPackage = {
        ...basicPackage,
        packageVersion: 2
      } as unknown as WriterPackage;
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [],
        [invalidPackage],
        EXPORTED_AT
      );

      assert(!result.ok, "invalid Package should reject backup");
      assert(result.error.includes("WriterPackage"), "invalid Package backup error is unclear");
    }
  },
  {
    name: "backup factory rejects duplicate Spark ids",
    run: () => {
      const duplicate: Spark = {
        ...normalSpark,
        text: "Duplicate Spark"
      };
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [normalSpark, duplicate],
        [],
        EXPORTED_AT
      );

      assert(!result.ok, "duplicate Spark ids should reject backup");
      assert(result.error.includes("duplicitne id"), "duplicate Spark backup error is unclear");
    }
  },
  {
    name: "backup factory rejects duplicate Package ids",
    run: () => {
      const duplicate: WriterPackage = {
        ...basicPackage,
        title: "Duplicate Package"
      };
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [],
        [basicPackage, duplicate],
        EXPORTED_AT
      );

      assert(!result.ok, "duplicate Package ids should reject backup");
      assert(result.error.includes("duplicitne id"), "duplicate Package backup error is unclear");
    }
  },
  {
    name: "mutating backup cannot mutate local inputs",
    run: () => {
      const localSparks = cloneJson([stagedSpark]);
      const packageWithLegacy: WriterPackage = {
        ...cloneJson(packageWithNotes),
        legacy: {
          source: "spark",
          stage: "notes"
        }
      };
      const localPackages = [packageWithLegacy];
      const result = createBackup(
        WRITER_DB_V1_SCHEMA_VERSION,
        localSparks,
        localPackages,
        EXPORTED_AT
      );

      assertBackupOk(result, "backup-to-input immutability setup should succeed");
      result.backup.sparks[0].tags.push("backup-only");
      result.backup.packages[0].notes[0].text = "Changed in backup";
      if (result.backup.packages[0].legacy) {
        result.backup.packages[0].legacy.stage = "final";
      }
      result.backup.sparks.push(cloneJson(normalSpark));

      assertDeepEqual(localSparks[0].tags, ["stage"], "backup tags mutated local Spark");
      assert(
        localPackages[0].notes[0].text === "First note",
        "backup note mutated local Package"
      );
      assert(localPackages[0].legacy?.stage === "notes", "backup mutated local legacy metadata");
      assert(localSparks.length === 1, "backup array mutation changed local Spark array");
    }
  },
  {
    name: "mutating local inputs cannot mutate created backup",
    run: () => {
      const localSparks = cloneJson([stagedSpark]);
      const localPackages: WriterPackage[] = cloneJson([
        {
          ...packageWithNotes,
          legacy: {
            source: "spark" as const,
            stage: "notes" as const
          }
        }
      ]);
      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        localSparks,
        localPackages,
        EXPORTED_AT
      );

      assertBackupOk(result, "input-to-backup immutability setup should succeed");
      localSparks[0].tags.push("input-only");
      localPackages[0].notes[0].text = "Changed in input";
      if (localPackages[0].legacy) {
        localPackages[0].legacy.stage = "final";
      }
      localPackages.push(cloneJson(basicPackage));

      assertDeepEqual(result.backup.sparks[0].tags, ["stage"], "input tags mutated backup");
      assert(
        result.backup.packages[0].notes[0].text === "First note",
        "input note mutated backup"
      );
      assert(result.backup.packages[0].legacy?.stage === "notes", "input mutated backup legacy");
      assert(result.backup.packages.length === 1, "input array mutation changed backup array");
    }
  },
  {
    name: "backup factory does not touch localStorage",
    run: () => {
      let localStorageTouches = 0;
      const throwingStorage = {
        getItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("createWriterDbImportBackup touched localStorage");
        },
        setItem(_key: string, _value: string) {
          localStorageTouches += 1;
          throw new Error("createWriterDbImportBackup touched localStorage");
        },
        removeItem(_key: string) {
          localStorageTouches += 1;
          throw new Error("createWriterDbImportBackup touched localStorage");
        }
      };

      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = {
        localStorage: throwingStorage
      };

      const result = createBackup(
        WRITER_DB_V2_SCHEMA_VERSION,
        [normalSpark],
        [basicPackage],
        EXPORTED_AT
      );

      assertBackupOk(result, "localStorage guard backup should succeed");
      assert(localStorageTouches === 0, "backup factory touched localStorage");
    }
  },
  {
    name: "backup factory rejects unsupported sourceSchemaVersion",
    run: () => {
      const result = createWriterDbImportBackup({
        sourceSchemaVersion: 3 as WriterDb["schemaVersion"],
        localSparks: [],
        localPackages: [],
        now: EXPORTED_AT
      });

      assert(!result.ok, "unsupported sourceSchemaVersion should reject backup");
      assert(result.error.includes("sourceSchemaVersion"), "schema version error is unclear");
    }
  }
];

const tests: TestCase[] = [
  ...parserAndExportTests,
  ...importPreviewTests,
  ...inMemoryMergeTests,
  ...backupFactoryTests
];

export function runWriterDbChecks() {
  let passed = 0;

  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok ${passed} - ${test.name}`);
  }

  console.log(
    `Writer DB checks passed: ${passed}/${tests.length} ` +
      `(${parserAndExportTests.length} existing, ${importPreviewTests.length} import preview, ` +
      `${inMemoryMergeTests.length} in-memory merge, ${backupFactoryTests.length} backup factory)`
  );
}

runWriterDbChecks();
