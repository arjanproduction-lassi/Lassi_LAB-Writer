import type { Spark, WriterPackage } from "./types";
import { WRITER_DB_APP_NAME } from "./writerDb";
import { prepareWriterDbImportPreview } from "./writerDbImportPreview";

type TestCase = { name: string; run: () => void };
const NOW = "2026-07-19T12:00:00.000Z";

const spark: Spark = {
  id: "spark-preview",
  text: "Preview spark",
  createdAt: NOW,
  updatedAt: NOW,
  temperature: "spark",
  tags: ["preview"],
  schemaVersion: 1
};

const writerPackage: WriterPackage = {
  id: "package-preview",
  title: "Preview package",
  sparkText: "Source",
  notes: [],
  workshopText: "",
  finalText: "",
  createdAt: NOW,
  updatedAt: NOW,
  packageVersion: 1
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function v1(overrides: Record<string, unknown> = {}) {
  return {
    app: WRITER_DB_APP_NAME,
    schemaVersion: 1,
    exportedAt: NOW,
    sparkCount: 1,
    sparks: [spark],
    ...overrides
  };
}

function v2(overrides: Record<string, unknown> = {}) {
  return {
    app: WRITER_DB_APP_NAME,
    schemaVersion: 2,
    exportedAt: NOW,
    sparkCount: 1,
    packageCount: 1,
    sparks: [spark],
    packages: [writerPackage],
    ...overrides
  };
}

function prepare(payload: unknown, localSparks: readonly Spark[] = [], localPackages: readonly WriterPackage[] = []) {
  return prepareWriterDbImportPreview({
    jsonText: typeof payload === "string" ? payload : JSON.stringify(payload),
    localSparks,
    localPackages
  });
}

const tests: TestCase[] = [
  {
    name: "valid Writer DB v1 is preview ready",
    run: () => {
      const result = prepare(v1());
      assert(result.ok && result.preview.status === "ready", "valid v1 preview was blocked");
    }
  },
  {
    name: "valid Writer DB v2 is preview ready",
    run: () => {
      const result = prepare(v2());
      assert(result.ok && result.db.schemaVersion === 2, "valid v2 preview was blocked");
    }
  },
  {
    name: "invalid JSON is blocked",
    run: () => assert(!prepare("not-json").ok, "invalid JSON was accepted")
  },
  {
    name: "unsupported schemaVersion is blocked",
    run: () => assert(!prepare({ ...v2(), schemaVersion: 3 }).ok, "unsupported schema was accepted")
  },
  {
    name: "damaged Spark is blocked",
    run: () => assert(!prepare(v1({ sparks: [{ id: "broken" }] })).ok, "damaged Spark was accepted")
  },
  {
    name: "damaged WriterPackage is blocked",
    run: () => assert(!prepare(v2({ packages: [{ id: "broken" }] })).ok, "damaged package was accepted")
  },
  {
    name: "duplicate Spark ids are blocked",
    run: () => {
      const result = prepare(v1({ sparkCount: 2, sparks: [spark, { ...spark }] }));
      assert(!result.ok && result.blockingIssues[0]?.code === "duplicate-spark-id", "duplicate Sparks were accepted");
    }
  },
  {
    name: "duplicate Package ids are blocked",
    run: () => {
      const result = prepare(v2({ packageCount: 2, packages: [writerPackage, { ...writerPackage }] }));
      assert(!result.ok && result.blockingIssues[0]?.code === "duplicate-package-id", "duplicate packages were accepted");
    }
  },
  {
    name: "v1 Packages are untouched",
    run: () => {
      const result = prepare(v1(), [], [writerPackage]);
      assert(result.ok && result.preview.packages.mode === "untouched", "v1 packages were not untouched");
    }
  },
  {
    name: "count mismatch stays warning only",
    run: () => {
      const result = prepare(v1({ sparkCount: 7 }));
      assert(result.ok && result.preview.warnings.some((warning) => warning.code === "count-mismatch"), "count warning missing");
    }
  },
  {
    name: "tombstones add warning",
    run: () => {
      const result = prepare(v1({ sparks: [{ ...spark, deletedAt: NOW }] }));
      assert(result.ok && result.preview.warnings.some((warning) => warning.code === "contains-tombstones"), "tombstone warning missing");
    }
  },
  {
    name: "empty import adds warning",
    run: () => {
      const result = prepare(v2({ sparkCount: 0, packageCount: 0, sparks: [], packages: [] }));
      assert(result.ok && result.preview.warnings.some((warning) => warning.code === "empty-import"), "empty warning missing");
    }
  },
  {
    name: "cross-model id overlap adds warning",
    run: () => {
      const overlappingPackage = { ...writerPackage, id: spark.id };
      const result = prepare(v2({ packages: [overlappingPackage] }));
      assert(result.ok && result.preview.warnings.some((warning) => warning.code === "cross-model-id-overlap"), "overlap warning missing");
    }
  },
  {
    name: "helper does not mutate JSON or local arrays",
    run: () => {
      const payload = v2();
      const jsonText = JSON.stringify(payload);
      const localSparks = [clone(spark)];
      const localPackages = [clone(writerPackage)];
      const sparksBefore = clone(localSparks);
      const packagesBefore = clone(localPackages);
      const result = prepareWriterDbImportPreview({ jsonText, localSparks, localPackages });
      assert(result.ok, "immutability setup failed");
      assert(jsonText === JSON.stringify(payload), "incoming JSON changed");
      assert(JSON.stringify(localSparks) === JSON.stringify(sparksBefore), "local Sparks changed");
      assert(JSON.stringify(localPackages) === JSON.stringify(packagesBefore), "local Packages changed");
    }
  },
  {
    name: "helper never touches localStorage",
    run: () => {
      const throwingStorage = {
        getItem() { throw new Error("localStorage touched"); },
        setItem() { throw new Error("localStorage touched"); },
        removeItem() { throw new Error("localStorage touched"); }
      };
      (globalThis as unknown as { window: { localStorage: typeof throwingStorage } }).window = {
        localStorage: throwingStorage
      };
      assert(prepare(v2()).ok, "pure preview touched localStorage");
    }
  }
];

export function runWriterDbImportPreviewPreparationChecks() {
  let passed = 0;
  for (const test of tests) {
    test.run();
    passed += 1;
    console.log(`ok preview preparation ${passed} - ${test.name}`);
  }
  console.log(`Writer DB preview preparation checks passed: ${passed}/${tests.length}`);
}

runWriterDbImportPreviewPreparationChecks();
