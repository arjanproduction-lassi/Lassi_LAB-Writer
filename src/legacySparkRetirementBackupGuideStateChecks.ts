import {
  createLegacySparkRetirementBackupGuideState,
  LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_EVENT_TYPES,
  LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_STATUSES,
  transitionLegacySparkRetirementBackupGuide,
  type LegacySparkRetirementBackupGuideEvent,
  type LegacySparkRetirementBackupGuideMetadata,
  type LegacySparkRetirementBackupGuideState
} from "./legacySparkRetirementBackupGuideState";

const CREATED_AT = "2026-07-29T10:20:30.000Z";

const metadata: LegacySparkRetirementBackupGuideMetadata = {
  createdAt: CREATED_AT,
  fileNames: {
    writerDbV2: "LassiLAB_Writer_pre-retirement_DBv2_2026-07-29_10-20-30Z.json",
    driveV1Raw: "LassiLAB_Writer_pre-retirement_DriveV1_2026-07-29_10-20-30Z.json",
    manifest: "LassiLAB_Writer_pre-retirement_manifest_2026-07-29_10-20-30Z.json"
  },
  counts: {
    artifacts: 3,
    sparks: { total: 3, live: 2, tombstones: 1 },
    packages: { total: 2, live: 1, tombstones: 1 },
    notes: { total: 4, deleted: 1 }
  },
  drive: { status: "present" },
  shortHashes: {
    writerDbV2: "11111111",
    driveV1Raw: "22222222",
    manifest: "33333333",
    semanticPackage: "44444444",
    rawPackageStorage: "55555555"
  },
  packageBaselineMatched: true,
  reasons: ["WRITER_DB_SCHEMA_MISMATCH"]
};

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function transition(
  state: LegacySparkRetirementBackupGuideState,
  event: LegacySparkRetirementBackupGuideEvent
) {
  return transitionLegacySparkRetirementBackupGuide(state, event);
}

function isTransitioned(
  result: ReturnType<typeof transitionLegacySparkRetirementBackupGuide>
): result is Extract<ReturnType<typeof transitionLegacySparkRetirementBackupGuide>, { status: "transitioned" }> {
  return result.status === "transitioned";
}

function isRejected(
  result: ReturnType<typeof transitionLegacySparkRetirementBackupGuide>
): result is Extract<ReturnType<typeof transitionLegacySparkRetirementBackupGuide>, { status: "rejected" }> {
  return result.status === "rejected";
}

function requireTransitioned(
  state: LegacySparkRetirementBackupGuideState,
  event: LegacySparkRetirementBackupGuideEvent
): LegacySparkRetirementBackupGuideState {
  const result = transition(state, event);
  if (!isTransitioned(result)) {
    throw new Error(`Expected transitioned result from ${state.status} by ${event.type}.`);
  }
  return result.state;
}

function validFlow(): LegacySparkRetirementBackupGuideState {
  let state = createLegacySparkRetirementBackupGuideState();
  state = requireTransitioned(state, { type: "START_PREREQUISITE_CHECK", metadata });
  state = requireTransitioned(state, { type: "PREREQUISITES_CONFIRMED", metadata });
  state = requireTransitioned(state, { type: "SNAPSHOT_CAPTURED", metadata });
  state = requireTransitioned(state, { type: "DRIVE_READ_COMPLETED", metadata });
  state = requireTransitioned(state, { type: "ASSEMBLY_VERIFIED", metadata });
  state = requireTransitioned(state, { type: "BACKUP_PRESENTED", metadata });
  state = requireTransitioned(state, { type: "DOWNLOADS_TRIGGERED", metadata });
  state = requireTransitioned(state, { type: "FILES_RESELECTED", metadata });
  state = requireTransitioned(state, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true,
    metadata
  });
  return state;
}

function toSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

function publicApiText() {
  return JSON.stringify({
    statuses: LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_STATUSES,
    events: LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_EVENT_TYPES
  });
}

function transitionSourceText() {
  return [
    createLegacySparkRetirementBackupGuideState.toString(),
    transitionLegacySparkRetirementBackupGuide.toString()
  ].join("\n");
}

function runChecks(): number {
  let passed = 0;
  const test = (condition: boolean, message: string) => {
    check(condition, message);
    passed += 1;
  };

  const idle = createLegacySparkRetirementBackupGuideState();
  test(idle.status === "idle", "A. initial state is idle.");

  const checking = transition(idle, { type: "START_PREREQUISITE_CHECK" });
  test(isTransitioned(checking) && checking.status === "transitioned" && checking.state.status === "checking-prerequisites", "B. idle starts prerequisite checking.");

  const verified = validFlow();
  test(verified.status === "backup-verified", "C. full valid flow reaches backup-verified.");

  const prereqIncomplete = transition(
    requireTransitioned(idle, { type: "START_PREREQUISITE_CHECK" }),
    { type: "PREREQUISITES_INCOMPLETE", reasons: ["DRIVE_BACKUP_MISSING"] }
  );
  test(isTransitioned(prereqIncomplete) && prereqIncomplete.state.status === "incomplete", "D. prerequisites can end incomplete.");

  const prereqInvalid = transition(
    requireTransitioned(idle, { type: "START_PREREQUISITE_CHECK" }),
    { type: "PREREQUISITES_INVALID", reasons: ["DRIVE_CONTENT_INVALID"] }
  );
  test(isTransitioned(prereqInvalid) && prereqInvalid.state.status === "invalid", "E. prerequisites can end invalid.");

  const snapshotFailure = transition(
    requireTransitioned(requireTransitioned(idle, { type: "START_PREREQUISITE_CHECK" }), { type: "PREREQUISITES_CONFIRMED" }),
    { type: "SNAPSHOT_FAILED", reasons: ["SNAPSHOT_NOT_CAPTURED"] }
  );
  test(isTransitioned(snapshotFailure) && snapshotFailure.state.status === "invalid", "F. snapshot failure blocks the guide.");

  const snapshotIncomplete = transition(
    requireTransitioned(requireTransitioned(idle, { type: "START_PREREQUISITE_CHECK" }), { type: "PREREQUISITES_CONFIRMED" }),
    { type: "SNAPSHOT_INCOMPLETE", reasons: ["SNAPSHOT_NOT_CAPTURED"] }
  );
  test(isTransitioned(snapshotIncomplete) && snapshotIncomplete.state.status === "incomplete", "F2. snapshot incomplete blocks the guide.");

  const driveReading = requireTransitioned(
    requireTransitioned(requireTransitioned(idle, { type: "START_PREREQUISITE_CHECK" }), { type: "PREREQUISITES_CONFIRMED" }),
    { type: "SNAPSHOT_CAPTURED" }
  );
  const driveIncomplete = transition(driveReading, { type: "DRIVE_READ_INCOMPLETE" });
  const driveInvalid = transition(driveReading, { type: "DRIVE_READ_INVALID" });
  test(isTransitioned(driveIncomplete) && driveIncomplete.state.status === "incomplete", "G. Drive incomplete blocks the guide.");
  test(isTransitioned(driveInvalid) && driveInvalid.state.status === "invalid", "H. Drive invalid blocks the guide.");

  const assembling = requireTransitioned(driveReading, { type: "DRIVE_READ_COMPLETED" });
  const assemblyIncomplete = transition(assembling, { type: "ASSEMBLY_INCOMPLETE" });
  const assemblyInvalid = transition(assembling, { type: "ASSEMBLY_INVALID" });
  test(isTransitioned(assemblyIncomplete) && assemblyIncomplete.state.status === "incomplete", "I. assembly incomplete blocks the guide.");
  test(isTransitioned(assemblyInvalid) && assemblyInvalid.state.status === "invalid", "J. assembly invalid blocks the guide.");

  const reselected = requireTransitioned(
    requireTransitioned(
      requireTransitioned(requireTransitioned(assembling, { type: "ASSEMBLY_VERIFIED" }), { type: "BACKUP_PRESENTED" }),
      { type: "DOWNLOADS_TRIGGERED" }
    ),
    { type: "FILES_RESELECTED" }
  );
  const reselectIncomplete = transition(reselected, { type: "RESELECT_INCOMPLETE" });
  const reselectInvalid = transition(reselected, { type: "RESELECT_INVALID" });
  test(isTransitioned(reselectIncomplete) && reselectIncomplete.state.status === "incomplete", "K. reselect incomplete blocks verification.");
  test(isTransitioned(reselectInvalid) && reselectInvalid.state.status === "invalid", "L. reselect invalid blocks verification.");

  test(requireTransitioned(isTransitioned(prereqIncomplete) ? prereqIncomplete.state : idle, { type: "START_OVER" }).status === "idle", "M. START_OVER returns incomplete to idle.");
  test(requireTransitioned(isTransitioned(prereqInvalid) ? prereqInvalid.state : idle, { type: "START_OVER" }).status === "idle", "N. START_OVER returns invalid to idle.");
  test(requireTransitioned(verified, { type: "START_OVER" }).status === "idle", "O. START_OVER returns backup-verified to idle.");

  test(isRejected(transition(idle, { type: "ASSEMBLY_VERIFIED" })), "P. idle cannot jump to assembly-verified.");
  const assemblyVerified = requireTransitioned(assembling, { type: "ASSEMBLY_VERIFIED" });
  test(isRejected(transition(assemblyVerified, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true
  })), "Q. assembly-verified cannot jump to backup-verified.");
  const downloadsTriggered = requireTransitioned(requireTransitioned(assemblyVerified, { type: "BACKUP_PRESENTED" }), { type: "DOWNLOADS_TRIGGERED" });
  test(isRejected(transition(downloadsTriggered, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true
  })), "R. downloads-triggered cannot jump to backup-verified.");
  const backupPresented = requireTransitioned(assemblyVerified, { type: "BACKUP_PRESENTED" });
  test(isRejected(transition(backupPresented, { type: "FILES_RESELECTED" })), "S. backup-presented cannot jump to files reselected.");

  const explicitVerified = transition(reselected, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true
  });
  test(isTransitioned(explicitVerified) && explicitVerified.state.status === "backup-verified", "T. backup-verified requires explicit reverification confirmation.");
  test(isRejected(transition(reselected, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: false,
    writerDbStructureVerified: true,
    driveStructureVerified: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true
  })), "U. hash mismatch cannot verify backup.");
  test(isRejected(transition(reselected, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: false
  })), "V. Package baseline mismatch cannot verify backup.");
  test(isRejected(transition(reselected, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: false,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true
  })), "W. required Drive without verification cannot verify backup.");
  const driveNotApplicable = transition(reselected, {
    type: "RESELECT_VERIFIED",
    rawHashMatch: true,
    writerDbStructureVerified: true,
    driveStructureVerified: false,
    driveNotApplicable: true,
    manifestCrossCheckPassed: true,
    packageBaselineMatched: true,
    metadata: { ...metadata, drive: { status: "not-applicable" }, fileNames: { ...metadata.fileNames, driveV1Raw: null }, shortHashes: { ...metadata.shortHashes, driveV1Raw: null } }
  });
  test(isTransitioned(driveNotApplicable) && driveNotApplicable.state.status === "backup-verified", "X. Drive not-applicable can be explicitly verified.");

  const rejected = transition(backupPresented, { type: "FILES_RESELECTED" });
  test(isRejected(rejected) && rejected.status === "rejected" && rejected.state === backupPresented, "Y. rejected transition keeps current state.");

  test(Object.isFrozen(idle), "Z. initial state is frozen.");
  test(isTransitioned(explicitVerified) && Object.isFrozen(explicitVerified) && Object.isFrozen(explicitVerified.state), "AA. transitioned result is frozen.");
  test(isRejected(rejected) && Object.isFrozen(rejected) && Object.isFrozen(rejected.reasons), "AB. rejected result is frozen.");
  test(
    isTransitioned(explicitVerified) &&
      !!explicitVerified.state.metadata &&
      Object.isFrozen(explicitVerified.state.metadata) &&
      Object.isFrozen(explicitVerified.state.metadata.fileNames) &&
      Object.isFrozen(explicitVerified.state.metadata.counts) &&
      Object.isFrozen(explicitVerified.state.metadata.shortHashes),
    "AC. nested metadata is frozen."
  );
  const incompleteWithReasons = transition(
    requireTransitioned(idle, { type: "START_PREREQUISITE_CHECK" }),
    { type: "PREREQUISITES_INCOMPLETE", metadata, reasons: ["DRIVE_BACKUP_MISSING"] }
  );
  test(isTransitioned(incompleteWithReasons) && Object.isFrozen(incompleteWithReasons.state.metadata?.reasons), "AD. reason arrays are frozen.");

  const inputState = createLegacySparkRetirementBackupGuideState();
  const stateBefore = toSnapshot(inputState);
  transition(inputState, { type: "START_PREREQUISITE_CHECK", metadata });
  test(toSnapshot(inputState) === stateBefore, "AE. input state is not mutated.");

  const inputEvent = { type: "START_PREREQUISITE_CHECK" as const, metadata };
  const eventBefore = toSnapshot(inputEvent);
  transition(inputState, inputEvent);
  test(toSnapshot(inputEvent) === eventBefore, "AF. input event is not mutated.");

  test(toSnapshot(transition(inputState, inputEvent)) === toSnapshot(transition(inputState, inputEvent)), "AG. repeated call is deterministic.");

  const unsafe = transition(idle, {
    type: "START_PREREQUISITE_CHECK",
    metadata: {
      ...metadata,
      fileNames: { writerDbV2: "Synthetic author title.json" },
      shortHashes: { writerDbV2: "not-a-hash" },
      reasons: ["private author text" as never]
    } as never
  });
  const unsafeJson = toSnapshot(unsafe);
  test(!unsafeJson.includes("Synthetic author title") && !unsafeJson.includes("private author text"), "AH. state excludes author text.");
  test(!unsafeJson.includes("rawJson") && !unsafeJson.includes("Uint8Array") && !unsafeJson.includes("bytes"), "AI. state excludes raw JSON and bytes.");
  test(!unsafeJson.includes("OAuth") && !unsafeJson.includes("access_token") && !unsafeJson.includes("drive-file-id"), "AJ. state excludes OAuth and Drive file IDs.");

  const source = transitionSourceText();
  test(!/React|useState|jsx|tsx/.test(source), "AK. module does not use React.");
  test(!/localStorage|sessionStorage|window|document|fetch|FileReader|node:fs|writeFile|googleDriveSync|syncGoogleDrive/.test(source), "AL. module does not use storage/browser/fs/network/Drive.");
  test(!/Blob|createObjectURL|anchor\.click|link\.click|download\s*=/.test(source), "AM. module creates no backup/download.");
  test(!/ready-to-create-tombstones|ready-to-delete|ready-to-purge|retirement-complete|reset-complete|DATA_RESET/.test(publicApiText()), "AN. public API exposes no R3/tombstone/delete/reset-data state.");
  test(Array.isArray(LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_STATUSES) && LEGACY_SPARK_RETIREMENT_BACKUP_GUIDE_STATUSES.length === 12, "AO. R1-R2.5 checks remain additive.");

  console.log(`Legacy Spark retirement R2.6.1 backup guide state checks: ${passed}/${passed} passed.`);
  return passed;
}

export const legacySparkRetirementBackupGuideStateCheckCount = runChecks();
