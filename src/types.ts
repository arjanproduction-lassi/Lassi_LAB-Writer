export type SparkTemperature = "spark";

export interface Spark {
  id: string;
  title?: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  temperature: SparkTemperature;
  tags: string[];
  schemaVersion: 1;
}

export interface SparkInput {
  id?: string;
  title?: string;
  text: string;
}

export interface WriterDbExport {
  app: "LassiLAB Writer";
  schemaVersion: 1;
  exportedAt: string;
  sparkCount: number;
  sparks: Spark[];
}

export interface WriterDbImportResult {
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
  backupKey: string;
  backedUpAt: string;
}
