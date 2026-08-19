import { legacySparkRetirementLocalBackupPanelCheckCount } from "./legacySparkRetirementLocalBackupPanelChecks";
import { legacySparkRetirementLocalBackupRuntimeCheckCount } from "./legacySparkRetirementLocalBackupRuntimeChecks";
import {
  deriveLegacySparkRetirementLocalBackupBlockingReason,
  type LegacySparkRetirementAppPlacementState
} from "./legacySparkRetirementAppPlacement";

declare function require(name: "fs"): {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { readFileSync } = require("fs");

function state(
  patch: Partial<LegacySparkRetirementAppPlacementState> = {}
): LegacySparkRetirementAppPlacementState {
  return Object.freeze({
    writerDbImportActive: false,
    writerDbRecoveryClean: true,
    googleSyncActive: false,
    editorOrDraftActive: false,
    ...patch
  });
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(state()) === null,
  "A. all-clear App state permits the panel command boundary."
);
check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(
    state({ writerDbImportActive: true })
  ) === "writer-db-import-active",
  "B. active Writer DB import maps to its exact blocking reason."
);
check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(
    state({ writerDbRecoveryClean: false })
  ) === "writer-db-recovery-not-clean",
  "C. non-clean Writer DB recovery maps to its exact blocking reason."
);
check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(
    state({ googleSyncActive: true })
  ) === "google-sync-active",
  "D. active Google sync maps to its exact blocking reason."
);
check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(
    state({ editorOrDraftActive: true })
  ) === "editor-or-draft-active",
  "E. active editor or draft maps to its exact blocking reason."
);

check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(state({
    writerDbImportActive: true,
    writerDbRecoveryClean: false,
    googleSyncActive: true,
    editorOrDraftActive: true
  })) === "writer-db-import-active",
  "F. active import has stable first precedence."
);
check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(state({
    writerDbRecoveryClean: false,
    googleSyncActive: true,
    editorOrDraftActive: true
  })) === "writer-db-recovery-not-clean",
  "G. non-clean recovery precedes sync and editor guards."
);
check(
  deriveLegacySparkRetirementLocalBackupBlockingReason(state({
    googleSyncActive: true,
    editorOrDraftActive: true
  })) === "google-sync-active",
  "H. active sync precedes the editor or draft guard."
);

const frozenInput = state({ editorOrDraftActive: true });
const frozenInputBefore = JSON.stringify(frozenInput);
const firstResult = deriveLegacySparkRetirementLocalBackupBlockingReason(frozenInput);
const secondResult = deriveLegacySparkRetirementLocalBackupBlockingReason(frozenInput);
check(firstResult === secondResult, "I. equivalent helper input is deterministic.");
check(JSON.stringify(frozenInput) === frozenInputBefore, "J. helper does not mutate its input.");
check(Object.isFrozen(frozenInput), "K. helper accepts a frozen read-only input.");
check(
  firstResult === "editor-or-draft-active" && /^[a-z-]+$/.test(firstResult),
  "L. helper output is a static text-free reason."
);

const helperSource = readFileSync("src/legacySparkRetirementAppPlacement.ts", "utf8");
check(!/React|jsx|tsx|from ["']\.\/App/.test(helperSource), "M. helper contains no React or App dependency.");
check(!/window|document|navigator|localStorage|sessionStorage|getItem|setItem|removeItem/.test(helperSource), "N. helper contains no browser or storage access.");
check(
  !/from ["'][^"']*(?:writerDbImportRuntime|writerDbRecovery|googleDriveSync|storage)/.test(
    helperSource
  ),
  "O. helper imports no recovery, Drive, or storage runtime."
);
check(!/Date\.now|new Date|Math\.random|crypto|fetch\(|XMLHttpRequest/.test(helperSource), "P. helper contains no time, randomness, crypto, or network access.");
check(!/captureLegacy|createLegacySparkRetirementLocalBackupController|prepareLocalBackup/.test(helperSource), "Q. helper cannot reach production capture or controller commands.");
check(!/console\.|throw new Error/.test(helperSource), "R. helper contains no logging or content-bearing error path.");

const appSource = readFileSync("src/App.tsx", "utf8");
const panelElement = "<LegacySparkRetirementLocalBackupPanel";
const panelIndex = appSource.indexOf(panelElement);
const finalImportUiIndex = appSource.lastIndexOf('importPreviewState.status === "preview-blocked"');
const googlePanelIndex = appSource.indexOf(
  '<div className="sync-panel" aria-labelledby="google-sync-title">'
);
check((appSource.match(/<LegacySparkRetirementLocalBackupPanel/g) ?? []).length === 1, "S. App renders exactly one retirement panel.");
check(panelIndex > finalImportUiIndex && panelIndex < googlePanelIndex, "T. panel is after import UI and before Google sync.");
check(appSource.includes('from "./LegacySparkRetirementLocalBackupPanel"'), "U. App imports the reviewed panel module.");
check(appSource.includes('from "./legacySparkRetirementLocalBackupRuntime"'), "V. App imports the reviewed production composition module.");
check(appSource.includes('from "./legacySparkRetirementAppPlacement"'), "W. App imports the pure blocking-reason helper.");
check(appSource.includes("createController={createLegacySparkRetirementLocalBackupController}"), "X. App passes the production factory only as a function reference.");
check(!/createLegacySparkRetirementLocalBackupController\s*\(/.test(appSource), "Y. App never invokes the production controller factory.");
check(appSource.includes("blockingReason={legacySparkRetirementBlockingReason}"), "Z. App passes only the derived text-free blocking reason.");
check(appSource.includes('writerDbImportActive: importPreviewState.status === "importing"'), "AA. import guard derives only from the existing importing state.");
check(appSource.includes('writerDbRecoveryClean: importRecoveryGate.status === "clean"'), "AB. recovery guard derives only from the existing clean state.");
check(appSource.includes("googleSyncActive: isGoogleSyncBusy"), "AC. sync guard reuses the existing App busy state.");
check(appSource.includes("editorOrDraftActive: editor !== null || newSparkDraft !== undefined"), "AD. editor and draft guard reuses existing App state.");
check(!/captureLegacySparkRetirementBrowserLocalStorageSnapshot|createLegacySparkRetirementLocalCaptureSession|createLegacySparkRetirementMinimalUiCaptureController/.test(appSource), "AE. App imports or calls no c2a, c2b1, or c2b2a retirement layer.");
check((appSource.match(/useEffect\(/g) ?? []).length === 7, "AF. placement adds no App effect.");
check((appSource.match(/useState/g) ?? []).length === 14, "AG. placement adds no App state hook.");
check((appSource.match(/useRef/g) ?? []).length === 9, "AH. placement adds no App ref.");
check((appSource.match(/window\.localStorage/g) ?? []).length === 4, "AI. placement adds no App localStorage access.");
check(!/lassilab-writer:v0\.1:/.test(appSource), "AJ. App placement defines no storage key.");

for (const sourcePath of [
  "src/main.tsx",
  "src/productShellMain.tsx",
  "src/ProductShellPrototype.tsx"
]) {
  const source = readFileSync(sourcePath, "utf8");
  check(
    !source.includes("LegacySparkRetirementLocalBackupPanel") &&
      !source.includes("legacySparkRetirementLocalBackupRuntime"),
    `AK. ${sourcePath} does not wire retirement capture.`
  );
}

check(legacySparkRetirementLocalBackupPanelCheckCount === 45, "AL. all c2b2b1 panel checks remain preserved.");
check(legacySparkRetirementLocalBackupRuntimeCheckCount === 42, "AM. all c2b2b2 runtime checks remain preserved.");

export const legacySparkRetirementAppPlacementCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c2b2b3 App placement checks: ${passed}/${passed} passed.`);
