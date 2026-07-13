import type { Spark, WriterPackage } from "./types";

const UNTITLED_WRITER_PACKAGE_TITLE = "Bez názvu";
const LEGACY_TITLE_MAX_LENGTH = 72;

export function deriveLegacyWriterPackageTitle(text: string): string {
  const firstContentLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find(Boolean);

  if (!firstContentLine) {
    return UNTITLED_WRITER_PACKAGE_TITLE;
  }

  if (firstContentLine.length <= LEGACY_TITLE_MAX_LENGTH) {
    return firstContentLine;
  }

  return `${firstContentLine.slice(0, LEGACY_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

export function adaptSparkToWriterPackage(spark: Spark): WriterPackage {
  return {
    id: spark.id,
    title: deriveLegacyWriterPackageTitle(spark.text),
    sparkText: spark.text,
    notes: [],
    workshopText: "",
    finalText: "",
    createdAt: spark.createdAt,
    updatedAt: spark.updatedAt,
    ...(spark.deletedAt ? { deletedAt: spark.deletedAt } : {}),
    packageVersion: 1,
    legacy: {
      source: "spark",
      ...(spark.stage ? { stage: spark.stage } : {})
    }
  };
}
