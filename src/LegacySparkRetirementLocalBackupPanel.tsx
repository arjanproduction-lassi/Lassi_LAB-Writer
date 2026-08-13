import { useEffect, useId, useRef, useState } from "react";
import {
  LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL,
  type LegacySparkRetirementMinimalUiCaptureCommandResult,
  type LegacySparkRetirementMinimalUiCaptureController,
  type LegacySparkRetirementMinimalUiCaptureMessageKey,
  type LegacySparkRetirementMinimalUiCaptureViewModel
} from "./legacySparkRetirementMinimalUiCaptureController";

export type LegacySparkRetirementLocalBackupPanelBlockingReason =
  | "writer-db-import-active"
  | "writer-db-recovery-not-clean"
  | "google-sync-active"
  | "editor-or-draft-active";

export type LegacySparkRetirementLocalBackupPanelMessageKey =
  | "not-started"
  | "panel-command-in-progress"
  | "panel-command-not-available"
  | "controller-creation-failed"
  | LegacySparkRetirementLocalBackupPanelBlockingReason
  | LegacySparkRetirementMinimalUiCaptureMessageKey;

export type LegacySparkRetirementLocalBackupPanelPublicState = Readonly<{
  viewModel: LegacySparkRetirementMinimalUiCaptureViewModel | null;
  messageKey: LegacySparkRetirementLocalBackupPanelMessageKey;
  commandActive: boolean;
}>;

export type LegacySparkRetirementLocalBackupPanelCommandResult = Readonly<{
  status: "handled" | "rejected" | "blocked";
  state: LegacySparkRetirementLocalBackupPanelPublicState;
}>;

export type LegacySparkRetirementLocalBackupPanelInteraction = Readonly<{
  getPublicState: () => LegacySparkRetirementLocalBackupPanelPublicState;
  prepareLocalBackup: (
    blockingReason: LegacySparkRetirementLocalBackupPanelBlockingReason | null
  ) => LegacySparkRetirementLocalBackupPanelCommandResult;
  startOver: () => LegacySparkRetirementLocalBackupPanelCommandResult;
  cancel: () => LegacySparkRetirementLocalBackupPanelCommandResult;
  dispose: () => void;
}>;

export type LegacySparkRetirementLocalBackupPanelProps = Readonly<{
  createController: () => LegacySparkRetirementMinimalUiCaptureController;
  blockingReason: LegacySparkRetirementLocalBackupPanelBlockingReason | null;
}>;

const PANEL_MESSAGE_COPY: Readonly<
  Record<LegacySparkRetirementLocalBackupPanelMessageKey, string>
> = Object.freeze({
  "not-started": "Lokálna záloha ešte nie je pripravená.",
  "panel-command-in-progress": "Príprava lokálnej zálohy už prebieha.",
  "panel-command-not-available": "Tento krok teraz nie je dostupný.",
  "controller-creation-failed": "Lokálnu kontrolu sa nepodarilo pripraviť.",
  "writer-db-import-active": "Počkajte na dokončenie importu databázy.",
  "writer-db-recovery-not-clean": "Najprv vyriešte stav obnovy databázy.",
  "google-sync-active": "Počkajte na dokončenie Google synchronizácie.",
  "editor-or-draft-active": "Najprv bezpečne dokončite alebo odložte rozpracovaný text.",
  ready: "Lokálna kontrola je pripravená.",
  preparing: "Kontrolujem lokálne údaje…",
  "snapshot-ready":
    "Lokálny snapshot je pripravený iba v pamäti. Súbor ešte nebol vytvorený ani stiahnutý.",
  incomplete: "Lokálna kontrola nie je úplná.",
  invalid: "Lokálne údaje nie je možné bezpečne použiť.",
  released: "Dočasný lokálny snapshot bol uvoľnený.",
  "local-storage-unavailable": "Lokálne úložisko nie je dostupné.",
  "spark-storage-read-failed": "Lokálne Iskry sa nepodarilo prečítať.",
  "package-storage-read-failed": "Lokálne tvorivé balíky sa nepodarilo prečítať.",
  "draft-storage-read-failed": "Rozpracovaný text sa nepodarilo bezpečne skontrolovať.",
  "invalid-created-at": "Čas lokálnej kontroly nie je platný.",
  "created-at-creation-failed": "Čas lokálnej kontroly sa nepodarilo vytvoriť.",
  "capture-dependency-failed": "Lokálna kontrola zlyhala bez zmeny údajov.",
  "unfinished-draft-present": "Najprv bezpečne dokončite alebo odložte rozpracovaný text.",
  "spark-storage-invalid": "Lokálne Iskry majú nepodporovaný alebo poškodený formát.",
  "package-storage-invalid": "Lokálne tvorivé balíky majú nepodporovaný alebo poškodený formát.",
  "draft-storage-invalid": "Rozpracovaný text má nepodporovaný alebo poškodený formát.",
  "capture-already-in-progress": "Lokálna kontrola už prebieha.",
  "capture-already-attempted": "Pre nový pokus použite Začať odznova.",
  "capture-session-released": "Dočasná lokálna kontrola už bola uvoľnená.",
  "guide-transition-rejected": "Tento krok lokálnej kontroly bol bezpečne zablokovaný.",
  "invalid-transition": "Tento prechod lokálnej kontroly nie je platný.",
  "ui-command-already-in-progress": "Príprava lokálnej zálohy už prebieha.",
  "ui-controller-released": "Dočasná lokálna kontrola už bola uvoľnená.",
  "ui-command-not-available": "Tento krok teraz nie je dostupný.",
  "safe-operation-blocked": "Lokálna kontrola bola bezpečne zablokovaná."
});

function freezeState(
  viewModel: LegacySparkRetirementMinimalUiCaptureViewModel | null,
  messageKey: LegacySparkRetirementLocalBackupPanelMessageKey,
  commandActive: boolean
): LegacySparkRetirementLocalBackupPanelPublicState {
  return Object.freeze({ viewModel, messageKey, commandActive });
}

function freezeResult(
  status: LegacySparkRetirementLocalBackupPanelCommandResult["status"],
  state: LegacySparkRetirementLocalBackupPanelPublicState
): LegacySparkRetirementLocalBackupPanelCommandResult {
  return Object.freeze({ status, state });
}

function stateFromControllerResult(
  result: LegacySparkRetirementMinimalUiCaptureCommandResult
): LegacySparkRetirementLocalBackupPanelPublicState {
  return freezeState(result.viewModel, result.viewModel.safeMessageKey, false);
}

export function createLegacySparkRetirementLocalBackupPanelInteraction(
  createController: () => LegacySparkRetirementMinimalUiCaptureController
): LegacySparkRetirementLocalBackupPanelInteraction {
  let controller: LegacySparkRetirementMinimalUiCaptureController | null = null;
  let commandActive = false;
  let publicState = freezeState(null, "not-started", false);
  let disposed = false;

  const getPublicState = () => publicState;

  const blocked = (
    messageKey: LegacySparkRetirementLocalBackupPanelMessageKey
  ): LegacySparkRetirementLocalBackupPanelCommandResult => {
    publicState = freezeState(publicState.viewModel, messageKey, commandActive);
    return freezeResult("blocked", publicState);
  };

  const prepareLocalBackup = (
    blockingReason: LegacySparkRetirementLocalBackupPanelBlockingReason | null
  ): LegacySparkRetirementLocalBackupPanelCommandResult => {
    if (disposed) return blocked("panel-command-not-available");
    if (blockingReason !== null) return blocked(blockingReason);
    if (commandActive) return blocked("panel-command-in-progress");
    if (publicState.viewModel?.primaryActionDisabled) {
      return blocked("panel-command-not-available");
    }

    commandActive = true;
    publicState = freezeState(publicState.viewModel, "preparing", true);
    try {
      if (controller === null) controller = createController();
      const result = controller.prepareLocalBackup();
      publicState = stateFromControllerResult(result);
      return freezeResult(result.status, publicState);
    } catch {
      try {
        controller?.dispose();
      } catch {
        // The public result stays static and text-free even if release also fails.
      }
      controller = null;
      publicState = freezeState(null, "controller-creation-failed", false);
      return freezeResult("rejected", publicState);
    } finally {
      commandActive = false;
    }
  };

  const startOver = (): LegacySparkRetirementLocalBackupPanelCommandResult => {
    if (disposed || controller === null || commandActive || !publicState.viewModel?.showStartOver) {
      return blocked(commandActive ? "panel-command-in-progress" : "panel-command-not-available");
    }
    try {
      const result = controller.startOver();
      publicState = stateFromControllerResult(result);
      return freezeResult(result.status, publicState);
    } catch {
      try {
        controller.dispose();
      } catch {
        // The public result stays static and text-free even if release also fails.
      }
      controller = null;
      publicState = freezeState(null, "controller-creation-failed", false);
      return freezeResult("rejected", publicState);
    }
  };

  const releaseController = (
    messageKey: LegacySparkRetirementLocalBackupPanelMessageKey
  ): LegacySparkRetirementLocalBackupPanelCommandResult => {
    try {
      controller?.dispose();
    } catch {
      // Release removes the local reference even when an injected controller fails.
    }
    controller = null;
    commandActive = false;
    publicState = freezeState(null, messageKey, false);
    return freezeResult("handled", publicState);
  };

  const cancel = () => releaseController("not-started");

  const dispose = () => {
    if (disposed) return;
    releaseController("released");
    disposed = true;
  };

  return Object.freeze({
    getPublicState,
    prepareLocalBackup,
    startOver,
    cancel,
    dispose
  });
}

export function LegacySparkRetirementLocalBackupPanel({
  createController,
  blockingReason
}: LegacySparkRetirementLocalBackupPanelProps) {
  const titleId = useId();
  const statusId = useId();
  const createControllerRef = useRef(createController);
  createControllerRef.current = createController;
  const interactionRef = useRef<LegacySparkRetirementLocalBackupPanelInteraction | null>(null);

  function getInteraction(): LegacySparkRetirementLocalBackupPanelInteraction {
    if (interactionRef.current === null) {
      interactionRef.current = createLegacySparkRetirementLocalBackupPanelInteraction(
        () => createControllerRef.current()
      );
    }
    return interactionRef.current;
  }

  const [panelState, setPanelState] = useState(() => getInteraction().getPublicState());

  useEffect(() => {
    return () => {
      interactionRef.current?.dispose();
      interactionRef.current = null;
    };
  }, []);

  const effectiveMessageKey = blockingReason ?? panelState.messageKey;
  const viewModel = panelState.viewModel;
  const primaryDisabled =
    blockingReason !== null || panelState.commandActive || viewModel?.primaryActionDisabled === true;

  function prepareLocalBackup() {
    const result = getInteraction().prepareLocalBackup(blockingReason);
    setPanelState(result.state);
  }

  function startOver() {
    const result = getInteraction().startOver();
    setPanelState(result.state);
  }

  function cancel() {
    const result = getInteraction().cancel();
    setPanelState(result.state);
  }

  return (
    <section className="sync-panel" aria-labelledby={titleId} aria-describedby={statusId}>
      <div>
        <p className="eyebrow">Bezpečné vyradenie pôvodných Iskier</p>
        <h3 id={titleId}>Pripraviť lokálnu zálohu</h3>
      </div>

      <p className="data-copy">
        Táto read-only kontrola pripraví iba dočasný lokálny snapshot v pamäti.
        Nevytvorí ani nestiahne súbor a nič nezmení.
      </p>

      <p
        id={statusId}
        className="data-copy"
        role="status"
        aria-live="polite"
        aria-busy={panelState.commandActive}
        data-status={viewModel?.status ?? "not-started"}
      >
        {PANEL_MESSAGE_COPY[effectiveMessageKey]}
      </p>

      {viewModel?.counts ? (
        <p className="data-copy">
          Iskry: {viewModel.counts.sparks.total}. Tvorivé balíky: {viewModel.counts.packages.total}.
          Poznámky: {viewModel.counts.notes.total}.
        </p>
      ) : null}

      <div className="data-actions">
        <button
          className="data-action"
          type="button"
          onClick={prepareLocalBackup}
          disabled={primaryDisabled}
        >
          {LEGACY_SPARK_RETIREMENT_MINIMAL_UI_CAPTURE_PRIMARY_ACTION_LABEL}
        </button>

        {viewModel?.showStartOver ? (
          <button className="data-action secondary" type="button" onClick={startOver}>
            Začať odznova
          </button>
        ) : null}

        {viewModel?.showCancel ? (
          <button className="data-action secondary" type="button" onClick={cancel}>
            Zrušiť
          </button>
        ) : null}
      </div>
    </section>
  );
}
