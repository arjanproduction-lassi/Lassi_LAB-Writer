import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LegacySparkRetirementLocalBackupPanel,
  createLegacySparkRetirementLocalBackupPanelInteraction,
  type LegacySparkRetirementLocalBackupPanelCommandResult
} from "./LegacySparkRetirementLocalBackupPanel";
import {
  LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL,
  type LegacySparkRetirementMinimalUiCaptureCommandResult,
  type LegacySparkRetirementMinimalUiCaptureController,
  type LegacySparkRetirementMinimalUiCaptureViewModel
} from "./legacySparkRetirementMinimalUiCaptureController";
import { legacySparkRetirementMinimalUiCaptureControllerCheckCount } from "./legacySparkRetirementMinimalUiCaptureControllerChecks";

declare function require(name: "fs"): {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { readFileSync } = require("fs");

const PRIVATE_TEXT = "Synthetic private c2b2b1 author text";
const PRIVATE_ID = "synthetic-private-c2b2b1-id";

function viewModel(
  status: "ready" | "snapshot-ready" = "ready"
): LegacySparkRetirementMinimalUiCaptureViewModel {
  const ready = status === "ready";
  return Object.freeze({
    status,
    guideStatus: ready ? "idle" : "drive-reading",
    primaryActionLabel: LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL,
    primaryActionDisabled: !ready,
    showStartOver: !ready,
    showCancel: ready,
    safeMessageKey: status,
    createdAt: ready ? null : "2026-08-11T10:00:00.000Z",
    counts: ready
      ? null
      : Object.freeze({
          sparks: Object.freeze({ total: 2, live: 1, tombstones: 1 }),
          packages: Object.freeze({ total: 1, live: 1, tombstones: 0 }),
          notes: Object.freeze({ total: 3, deleted: 1 })
        }),
    storageStatuses: Object.freeze({
      sparks: ready ? null : "present",
      packages: ready ? null : "present"
    }),
    reasonCodes: Object.freeze([]),
    nextAllowedStep: ready ? "prepare-local-snapshot" : "provide-captured-snapshot-to-next-step"
  });
}

function handled(
  view: LegacySparkRetirementMinimalUiCaptureViewModel
): LegacySparkRetirementMinimalUiCaptureCommandResult {
  return Object.freeze({ status: "handled" as const, viewModel: view });
}

type FakeCalls = {
  factories: number;
  prepares: number;
  startsOver: number;
  disposes: number;
};

function fakeControllerFactory(options: Readonly<{
  onPrepare?: () => void;
  throwOnCreate?: boolean;
  throwOnPrepare?: boolean;
}> = {}): Readonly<{
  calls: FakeCalls;
  createController: () => LegacySparkRetirementMinimalUiCaptureController;
}> {
  const calls: FakeCalls = { factories: 0, prepares: 0, startsOver: 0, disposes: 0 };
  const createController = (): LegacySparkRetirementMinimalUiCaptureController => {
    calls.factories += 1;
    if (options.throwOnCreate) throw new Error(PRIVATE_TEXT);
    let current = viewModel();
    let disposed = false;
    return Object.freeze({
      getViewModel() {
        return current;
      },
      prepareLocalBackup() {
        calls.prepares += 1;
        options.onPrepare?.();
        if (options.throwOnPrepare) throw new Error(PRIVATE_TEXT);
        current = viewModel("snapshot-ready");
        return handled(current);
      },
      startOver() {
        calls.startsOver += 1;
        current = viewModel();
        return handled(current);
      },
      dispose() {
        if (!disposed) calls.disposes += 1;
        disposed = true;
        return handled(Object.freeze({ ...current, status: "released", safeMessageKey: "released" }));
      }
    });
  };
  return Object.freeze({ calls, createController });
}

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  passed += 1;
}

const lazy = fakeControllerFactory();
const lazyInteraction = createLegacySparkRetirementLocalBackupPanelInteraction(lazy.createController);
check(lazy.calls.factories === 0, "A. creating the panel interaction does not create a controller.");
const initialState = lazyInteraction.getPublicState();
check(lazy.calls.factories === 0, "B. reading initial public state does not create a controller.");
check(initialState.viewModel === null && initialState.messageKey === "not-started", "C. initial public state is text-free and not started.");
check(Object.isFrozen(initialState), "D. initial public state is frozen.");

const blocked = lazyInteraction.prepareLocalBackup("writer-db-recovery-not-clean");
check(blocked.status === "blocked", "E. external recovery guard blocks prepare.");
check(blocked.state.messageKey === "writer-db-recovery-not-clean", "F. blocked result preserves the text-free reason.");
check(lazy.calls.factories === 0 && lazy.calls.prepares === 0, "G. blocked prepare creates no controller and issues no command.");

const prepared = lazyInteraction.prepareLocalBackup(null);
check(lazy.calls.factories === 1 && lazy.calls.prepares === 1, "H. first accepted prepare lazily creates one controller and issues one command.");
check(prepared.status === "handled" && prepared.state.viewModel?.status === "snapshot-ready", "I. handled result preserves controller snapshot-ready state.");
check(prepared.state.messageKey === "snapshot-ready", "J. handled result preserves the safe controller message key.");
check(Object.isFrozen(prepared) && Object.isFrozen(prepared.state), "K. prepare result and public state are frozen.");

const repeated = lazyInteraction.prepareLocalBackup(null);
check(repeated.status === "blocked" && repeated.state.messageKey === "panel-command-not-available", "L. repeated prepare is blocked until start over.");
check(lazy.calls.factories === 1 && lazy.calls.prepares === 1, "M. repeated prepare issues no second controller command.");

let reentrantResult: LegacySparkRetirementLocalBackupPanelCommandResult | null = null;
let reentrantInteraction: ReturnType<typeof createLegacySparkRetirementLocalBackupPanelInteraction>;
const reentrant = fakeControllerFactory({
  onPrepare() {
    reentrantResult = reentrantInteraction.prepareLocalBackup(null);
  }
});
reentrantInteraction = createLegacySparkRetirementLocalBackupPanelInteraction(reentrant.createController);
reentrantInteraction.prepareLocalBackup(null);
const observedReentrantResult = reentrantResult as LegacySparkRetirementLocalBackupPanelCommandResult | null;
check(observedReentrantResult?.status === "blocked" && observedReentrantResult.state.messageKey === "panel-command-in-progress", "N. reentrant prepare is blocked by the synchronous command lock.");
check(reentrant.calls.factories === 1 && reentrant.calls.prepares === 1, "O. reentrant prepare issues no second controller command.");

const restarted = lazyInteraction.startOver();
check(restarted.status === "handled" && restarted.state.viewModel?.status === "ready", "P. start over returns the controller to ready.");
check(lazy.calls.startsOver === 1 && lazy.calls.prepares === 1, "Q. start over does not prepare another snapshot.");
const freshPrepare = lazyInteraction.prepareLocalBackup(null);
check(freshPrepare.status === "handled" && lazy.calls.prepares === 2, "R. a new capture after start over requires a new explicit command.");

const neverStarted = fakeControllerFactory();
const neverStartedInteraction = createLegacySparkRetirementLocalBackupPanelInteraction(neverStarted.createController);
check(neverStartedInteraction.startOver().status === "blocked", "S. start over before capture is blocked.");
check(neverStarted.calls.factories === 0, "T. blocked start over creates no controller.");

const cancelled = lazyInteraction.cancel();
check(cancelled.state.viewModel === null && cancelled.state.messageKey === "not-started", "U. cancel clears the public view and returns to not-started.");
check(lazy.calls.disposes === 1, "V. cancel disposes the retained controller once.");
lazyInteraction.cancel();
check(lazy.calls.disposes === 1, "W. repeated cancel does not dispose again.");

const disposable = fakeControllerFactory();
const disposableInteraction = createLegacySparkRetirementLocalBackupPanelInteraction(disposable.createController);
disposableInteraction.prepareLocalBackup(null);
disposableInteraction.dispose();
disposableInteraction.dispose();
check(disposable.calls.disposes === 1, "X. interaction dispose is idempotent.");
check(disposableInteraction.prepareLocalBackup(null).status === "blocked", "Y. prepare after dispose is blocked.");
check(disposable.calls.factories === 1 && disposable.calls.prepares === 1, "Z. prepare after dispose creates and issues nothing.");

const throwing = fakeControllerFactory({ throwOnCreate: true });
const throwingInteraction = createLegacySparkRetirementLocalBackupPanelInteraction(throwing.createController);
const throwingResult = throwingInteraction.prepareLocalBackup(null);
check(throwingResult.status === "rejected" && throwingResult.state.messageKey === "controller-creation-failed", "AA. controller factory failure maps to a static safe message key.");
check(!JSON.stringify(throwingResult).includes(PRIVATE_TEXT), "AB. factory exception text is not exposed in public state.");

const throwingPrepare = fakeControllerFactory({ throwOnPrepare: true });
const throwingPrepareInteraction = createLegacySparkRetirementLocalBackupPanelInteraction(throwingPrepare.createController);
const throwingPrepareResult = throwingPrepareInteraction.prepareLocalBackup(null);
check(throwingPrepareResult.status === "rejected" && throwingPrepareResult.state.messageKey === "controller-creation-failed", "AC. controller command failure maps to a static safe message key.");
check(throwingPrepare.calls.disposes === 1, "AD. controller command failure releases the retained controller.");
check(!JSON.stringify(throwingPrepareResult).includes(PRIVATE_TEXT), "AE. controller command exception text is not exposed.");

const renderFactory = fakeControllerFactory();
const markup = renderToStaticMarkup(createElement(LegacySparkRetirementLocalBackupPanel, {
  createController: renderFactory.createController,
  blockingReason: null
}));
check(renderFactory.calls.factories === 0, "AF. server render creates no controller.");
check(markup.includes(LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL), "AG. render exposes the approved primary action label.");
check(markup.includes('role="status"') && markup.includes('aria-live="polite"'), "AH. status copy has an accessible polite live region.");
check(markup.includes("read-only") && markup.includes("nič nezmení"), "AI. initial copy truthfully states the read-only boundary.");
check(!markup.includes(PRIVATE_TEXT) && !markup.includes(PRIVATE_ID), "AJ. rendered markup contains no synthetic private content.");

const blockedRenderFactory = fakeControllerFactory();
const blockedMarkup = renderToStaticMarkup(createElement(LegacySparkRetirementLocalBackupPanel, {
  createController: blockedRenderFactory.createController,
  blockingReason: "google-sync-active"
}));
check(blockedRenderFactory.calls.factories === 0, "AK. blocked server render creates no controller.");
check(blockedMarkup.includes("disabled") && blockedMarkup.includes("Google synchronizácie"), "AL. external block disables the action and renders safe copy.");

const source = readFileSync("src/LegacySparkRetirementLocalBackupPanel.tsx", "utf8");
check(!/window|localStorage|sessionStorage|setItem|removeItem/.test(source), "AM. panel source contains no browser storage access.");
check(!/BrowserLocalStorageCapture|captureLegacySparkRetirementBrowser/.test(source), "AN. panel source does not import or call production c2a.");
check(!/from ["']\.\/App|from ["']\.\/storage|from ["']\.\/googleDriveSync/.test(source), "AO. panel source does not import App, storage, or Google sync modules.");
check(!/Date\.now|new Date|Math\.random|crypto|fetch\(|XMLHttpRequest|Blob|FileReader/.test(source), "AP. panel source uses no time, randomness, network, crypto, or file APIs.");
const effectSource = source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/)?.[0] ?? "";
check(effectSource.includes("interactionRef.current?.dispose()") && !/prepareLocalBackup|createController|capture/.test(effectSource), "AQ. the only effect path is release-only cleanup.");
check(!source.includes(PRIVATE_TEXT) && !source.includes(PRIVATE_ID), "AR. panel source contains no synthetic author content or private IDs.");
check(legacySparkRetirementMinimalUiCaptureControllerCheckCount === 44, "AS. all c2b2a controller checks remain preserved.");

export const legacySparkRetirementLocalBackupPanelCheckCount = passed;
console.log(`Legacy Spark retirement R2.6.3c2b2b1 local backup panel checks: ${passed}/${passed} passed.`);
