import type { LegacySparkRetirementLocalBackupPanelBlockingReason } from "./LegacySparkRetirementLocalBackupPanel";

export type LegacySparkRetirementAppPlacementState = Readonly<{
  writerDbImportActive: boolean;
  writerDbRecoveryClean: boolean;
  googleSyncActive: boolean;
  editorOrDraftActive: boolean;
}>;

export function deriveLegacySparkRetirementLocalBackupBlockingReason(
  state: LegacySparkRetirementAppPlacementState
): LegacySparkRetirementLocalBackupPanelBlockingReason | null {
  if (state.writerDbImportActive) return "writer-db-import-active";
  if (!state.writerDbRecoveryClean) return "writer-db-recovery-not-clean";
  if (state.googleSyncActive) return "google-sync-active";
  if (state.editorOrDraftActive) return "editor-or-draft-active";
  return null;
}
