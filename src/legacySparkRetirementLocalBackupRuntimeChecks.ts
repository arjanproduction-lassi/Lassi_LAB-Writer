import {
  createLegacySparkRetirementLocalBackupController,
  createLegacySparkRetirementLocalBackupControllerWithDependencies,
  type LegacySparkRetirementLocalBackupRuntimeDependencies
} from "./legacySparkRetirementLocalBackupRuntime";
import { captureLegacySparkRetirementLocalSnapshotFromRaw } from "./legacySparkRetirementLocalSnapshot";
import type { LegacySparkRetirementLocalSnapshotResult } from "./legacySparkRetirementLocalSnapshot";
import { legacySparkRetirementLocalBackupPanelCheckCount } from "./legacySparkRetirementLocalBackupPanelChecks";

declare function require(name: "fs"): {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { readFileSync } = require("fs");

const CURRENT_TIME_MILLISECONDS = Date.UTC(2026, 7, 19, 9, 10, 11, 987);
const CANONICAL_CREATED_AT = "2026-08-19T09:10:11.000Z";
const PRIVATE_TEXT = "Synthetic private c2b2b2 author text";
const PRIVATE_ID = "synthetic-private-c2b2b2-id";

function captured(createdAt: string): LegacySparkRetirementLocalSnapshotResult {
  return captureLegacySparkRetirementLocalSnapshotFromRaw(Object.freeze({
    createdAt,
    sparks: Object.freeze({
      status: "present" as const,
      raw: JSON.stringify([{
        id: PRIVATE_ID,
        text: PRIVATE_TEXT,
        createdAt,
        updatedAt: createdAt,
        temperature: "spark",
        tags: [],
        schemaVersion: 1
      }])
    }),
    packages: Object.freeze({ status: "missing" as const }),
    draft: Object.freeze({ status: "missing" as const })
  }));
}

type RuntimeCalls = {
  times: number;
  captures: number;
  order: string[];
  captureInputs: Readonly<{ createdAt: string }>[];
  frozenCaptureInputs: boolean[];
};

function createRuntime(options: Readonly<{
  currentTimeMilliseconds?: number;
  getCurrentTimeMilliseconds?: () => number;
  captureLocalSnapshot?: (
    input: Readonly<{ createdAt: string }>
  ) => LegacySparkRetirementLocalSnapshotResult;
}> = {}) {
  const calls: RuntimeCalls = {
    times: 0,
    captures: 0,
    order: [],
    captureInputs: [],
    frozenCaptureInputs: []
  };
  const dependencies: LegacySparkRetirementLocalBackupRuntimeDependencies = Object.freeze({
    getCurrentTimeMilliseconds: () => {
      calls.times += 1;
      calls.order.push("time");
      return options.getCurrentTimeMilliseconds
        ? options.getCurrentTimeMilliseconds()
        : options.currentTimeMilliseconds ?? CURRENT_TIME_MILLISECONDS;
    },
    captureLocalSnapshot: (input) => {
      calls.captures += 1;
      calls.order.push("capture");
      calls.captureInputs.push(input);
      calls.frozenCaptureInputs.push(Object.isFrozen(input));
      return options.captureLocalSnapshot
        ? options.captureLocalSnapshot(input)
        : captured(input.createdAt);
    }
  });
  const controller = createLegacySparkRetirementLocalBackupControllerWithDependencies(dependencies);
  return Object.freeze({ calls, dependencies, controller });
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

const lazy = createRuntime();
check(lazy.calls.times === 0 && lazy.calls.captures === 0, "A. injected factory creation is time- and capture-free.");
const lazyInitial = lazy.controller.getViewModel();
check(lazy.calls.times === 0 && lazy.calls.captures === 0, "B. initial view-model access is time- and capture-free.");
check(lazyInitial.status === "ready" && lazyInitial.createdAt === null, "C. injected controller starts in the existing ready state.");
check(Object.isFrozen(lazy.controller) && Object.isFrozen(lazyInitial), "D. controller and view model remain frozen.");

const success = lazy.controller.prepareLocalBackup();
check(success.status === "handled" && success.viewModel.status === "snapshot-ready", "E. one accepted prepare preserves the existing success mapping.");
check(lazy.calls.times === 1 && lazy.calls.captures === 1, "F. one accepted prepare calls time once and capture once.");
check(lazy.calls.order.join(",") === "time,capture", "G. timestamp creation happens before capture.");
check(lazy.calls.captureInputs[0]?.createdAt === CANONICAL_CREATED_AT, "H. capture receives the canonical UTC-second timestamp.");
check(lazy.calls.frozenCaptureInputs[0] === true, "I. capture receives a frozen input object.");
check(success.viewModel.createdAt === CANONICAL_CREATED_AT, "J. successful public metadata preserves the canonical timestamp.");
const successJson = JSON.stringify(success);
check(!successJson.includes(PRIVATE_TEXT) && !successJson.includes(PRIVATE_ID), "K. public controller output does not expose raw author text or IDs.");

const repeated = lazy.controller.prepareLocalBackup();
check(repeated.status === "rejected", "L. a second prepare without start-over is rejected.");
check(lazy.calls.times === 1 && lazy.calls.captures === 1, "M. rejected repeat causes no new time or capture call.");
const restarted = lazy.controller.startOver();
check(restarted.status === "handled" && restarted.viewModel.status === "ready", "N. start-over creates a fresh ready session.");
check(lazy.calls.times === 1 && lazy.calls.captures === 1, "O. start-over itself remains time- and capture-free.");
lazy.controller.prepareLocalBackup();
check(lazy.calls.times === 2 && lazy.calls.captures === 2, "P. only a later explicit prepare runs the fresh attempt.");

const fractional = createRuntime({ currentTimeMilliseconds: CURRENT_TIME_MILLISECONDS });
fractional.controller.prepareLocalBackup();
check(fractional.calls.captureInputs[0]?.createdAt === CANONICAL_CREATED_AT, "Q. fractional milliseconds are floored to canonical .000Z precision.");

for (const invalidTime of [Number.NaN, Number.POSITIVE_INFINITY, 8.64e15 + 1]) {
  const invalid = createRuntime({ currentTimeMilliseconds: invalidTime });
  const result = invalid.controller.prepareLocalBackup();
  check(
    result.status === "handled" &&
      result.viewModel.safeMessageKey === "created-at-creation-failed" &&
      invalid.calls.times === 1 &&
      invalid.calls.captures === 0,
    "R. non-finite or out-of-range time blocks capture with the existing safe state."
  );
}

const timestampThrow = createRuntime({
  getCurrentTimeMilliseconds() {
    throw new Error(PRIVATE_TEXT);
  }
});
const timestampThrowResult = timestampThrow.controller.prepareLocalBackup();
check(timestampThrow.calls.times === 1 && timestampThrow.calls.captures === 0, "S. timestamp dependency failure prevents capture.");
check(timestampThrowResult.viewModel.safeMessageKey === "created-at-creation-failed", "T. timestamp failure maps to the existing safe message key.");
check(!JSON.stringify(timestampThrowResult).includes(PRIVATE_TEXT), "U. timestamp exception text is not exposed.");

const captureThrow = createRuntime({
  captureLocalSnapshot() {
    throw new Error(PRIVATE_TEXT);
  }
});
const captureThrowResult = captureThrow.controller.prepareLocalBackup();
check(captureThrow.calls.times === 1 && captureThrow.calls.captures === 1, "V. capture dependency is attempted exactly once after a valid timestamp.");
check(captureThrowResult.viewModel.safeMessageKey === "capture-dependency-failed", "W. capture failure maps to the existing safe message key.");
check(!JSON.stringify(captureThrowResult).includes(PRIVATE_TEXT), "X. capture exception text is not exposed.");

const incomplete = createRuntime({
  captureLocalSnapshot: () => Object.freeze({
    status: "incomplete" as const,
    reasons: Object.freeze(["DRAFT_PRESENT" as const])
  })
});
const incompleteResult = incomplete.controller.prepareLocalBackup();
check(incompleteResult.viewModel.status === "incomplete" && incompleteResult.viewModel.safeMessageKey === "unfinished-draft-present", "Y. incomplete result preserves its typed mapping.");

const invalid = createRuntime({
  captureLocalSnapshot: () => Object.freeze({
    status: "invalid" as const,
    reasons: Object.freeze(["LOCAL_STORAGE_UNAVAILABLE" as const])
  })
});
const invalidResult = invalid.controller.prepareLocalBackup();
check(invalidResult.viewModel.status === "invalid" && invalidResult.viewModel.safeMessageKey === "local-storage-unavailable", "Z. invalid result preserves its typed mapping.");

const disposed = createRuntime();
disposed.controller.dispose();
const afterDispose = disposed.controller.prepareLocalBackup();
check(afterDispose.status === "rejected" && disposed.calls.times === 0 && disposed.calls.captures === 0, "AA. dispose and later rejected prepare cause no effects.");

const originalDateNow = Date.now;
let productionTimeCalls = 0;
(Date as unknown as { now: () => number }).now = () => {
  productionTimeCalls += 1;
  return CURRENT_TIME_MILLISECONDS;
};
let productionController;
try {
  productionController = createLegacySparkRetirementLocalBackupController();
  productionController.getViewModel();
  productionController.startOver();
  productionController.dispose();
} finally {
  (Date as unknown as { now: () => number }).now = originalDateNow;
}
check(productionTimeCalls === 0, "AB. production factory creation and read-only lifecycle never call Date.now.");
check(productionController?.getViewModel().status === "released", "AC. production factory returns the existing controller contract without preparing.");

const dependenciesBefore = JSON.stringify(lazy.dependencies);
lazy.controller.getViewModel();
check(JSON.stringify(lazy.dependencies) === dependenciesBefore, "AD. runtime composition does not mutate injected dependencies.");

const source = readFileSync("src/legacySparkRetirementLocalBackupRuntime.ts", "utf8");
check(!/React|jsx|tsx|from ["']\.\/App/.test(source), "AE. runtime composition contains no React or App wiring.");
check(!/window|localStorage|sessionStorage|getItem|setItem|removeItem|clear\(/.test(source), "AF. runtime composition contains no direct browser storage access.");
check(!/lassilab-writer:v0\.1:/.test(source), "AG. runtime composition defines no storage key.");
check(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|Drive|googleDrive/.test(source), "AH. runtime composition contains no network or Google Drive path.");
check(!/crypto|subtle|digest|Math\.random|Blob|FileReader|createObjectURL|download/.test(source), "AI. runtime composition contains no crypto, randomness, or file path.");
check(!/createWriterDb|WriterDbV2|backupAssembly|rollback|tombstone|purge|migration/.test(source), "AJ. runtime composition contains no backup assembly, rollback, or retirement mutation.");
check((source.match(/Date\.now/g) ?? []).length === 1, "AK. production time access exists only in one deferred callback.");
check(source.includes("captureLegacySparkRetirementBrowserLocalStorageSnapshot"), "AL. production capture delegates to the published c2a wrapper.");
check((source.match(/export function createLegacySparkRetirementLocalBackupController/g) ?? []).length === 2, "AM. runtime exposes only the injected and production controller factories.");
check(legacySparkRetirementLocalBackupPanelCheckCount === 45, "AN. all c2b2b1 panel checks remain preserved.");

export const legacySparkRetirementLocalBackupRuntimeCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c2b2b2 local backup runtime checks: ${passed}/${passed} passed.`);
