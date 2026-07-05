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

export type RemoteSyncStatus =
  | "unavailable"
  | "idle"
  | "authorizing"
  | "connected"
  | "syncing"
  | "error";

export interface WriterDbMergeResult {
  added: number;
  updated: number;
  kept: number;
  invalid: number;
  pushed: number;
  pulled: number;
  total: number;
  backupKey: string;
  backedUpAt: string;
}

export interface GoogleSyncCounts {
  added: number;
  updated: number;
  kept: number;
  pushed: number;
  pulled: number;
  errors: number;
}

export interface RemoteDbMetadata {
  fileId: string;
  fileName: string;
  created: boolean;
  updatedAt: string;
}

export interface GoogleSyncResult {
  status: "created" | "synced" | "upload-warning";
  message: string;
  counts: GoogleSyncCounts;
  remote: RemoteDbMetadata;
  backupKey?: string;
  backedUpAt?: string;
}
