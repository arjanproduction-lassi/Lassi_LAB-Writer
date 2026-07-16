import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  connectGoogleDrive,
  hasGoogleDriveAccessToken,
  isGoogleDriveSyncConfigured,
  syncGoogleDrive
} from "./googleDriveSync";
import {
  clearNewSparkDraft,
  createWriterDbExport,
  deleteSpark,
  getWriterDbExportFileName,
  importWriterDb,
  listSparks,
  normalizeSparkStage,
  readNewSparkDraft,
  readGoogleSyncPreferences,
  saveSpark,
  saveNewSparkDraft,
  updateSparkStage,
  updateGoogleSyncPreferences
} from "./storage";
import { parseWriterDbPayload } from "./writerDb";
import {
  createManualWriterDbV2Export,
  getManualWriterDbV2ExportFileName
} from "./writerDbExport";
import type {
  GoogleSyncPreferences,
  NewSparkDraft,
  RemoteSyncStatus,
  Spark,
  SparkStage
} from "./types";

type EditorState = {
  id?: string;
  text: string;
};

type StageFilter = "all" | SparkStage;

const QUIET_SYNC_DEBOUNCE_MS = 4000;
const STALE_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const DRAFT_AUTOSAVE_DEBOUNCE_MS = 500;
const STAGE_LABELS: Record<SparkStage, string> = {
  spark: "Iskra",
  notes: "Poznámky",
  workshop: "Dielňa",
  final: "Text OK"
};
const STAGE_OPTIONS: Array<{ value: SparkStage; label: string }> = [
  { value: "spark", label: STAGE_LABELS.spark },
  { value: "notes", label: STAGE_LABELS.notes },
  { value: "workshop", label: STAGE_LABELS.workshop },
  { value: "final", label: STAGE_LABELS.final }
];
const STAGE_FILTERS: Array<{ value: StageFilter; label: string }> = [
  { value: "all", label: "Všetko" },
  ...STAGE_OPTIONS
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function sparkTitle(spark: Spark) {
  const firstLine = spark.text.split("\n").find(Boolean);
  return spark.title ?? firstLine ?? "Nepomenovaná iskra";
}

function sparkPreview(spark: Spark) {
  const compact = spark.text.replace(/\s+/g, " ").trim();
  return compact.length > 96 ? `${compact.slice(0, 96)}...` : compact;
}

function sparkStageLabel(spark: Spark) {
  return STAGE_LABELS[normalizeSparkStage(spark.stage)];
}

function googleSyncUnavailableMessage() {
  return "Google Drive sync ešte nie je nastavený. Chýba VITE_GOOGLE_CLIENT_ID.";
}

function googleSyncWaitingMessage() {
  return "Svitok čaká na Google pripojenie. Písať môžeš ďalej.";
}

function googleSyncOfflineMessage() {
  return "Offline — zmeny sú uložené lokálne. Písať môžeš ďalej.";
}

function isLastSyncStale(lastSyncAt?: string) {
  if (!lastSyncAt) {
    return true;
  }

  return Date.now() - Date.parse(lastSyncAt) > STALE_SYNC_INTERVAL_MS;
}

function googleSyncHeading(
  googleSyncAvailable: boolean,
  preferences: GoogleSyncPreferences,
  googleConnectedInMemory: boolean,
  isOnline: boolean,
  googleSyncStatus: RemoteSyncStatus
) {
  if (!googleSyncAvailable || !preferences.googleSyncEnabled) {
    return "Sync nie je nastavený";
  }

  if (!isOnline || googleSyncStatus === "offline") {
    return "Offline";
  }

  if (googleSyncStatus === "syncing") {
    return "Svitok synchronizuje";
  }

  if (googleSyncStatus === "error") {
    return "Svitok hlási chybu";
  }

  return googleConnectedInMemory ? "Svitok zapnutý" : "Čaká na Google pripojenie";
}

export default function App() {
  const googleSyncAvailable = isGoogleDriveSyncConfigured();
  const [sparks, setSparks] = useState<Spark[]>(() => listSparks());
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [savedMessage, setSavedMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [newSparkDraft, setNewSparkDraft] = useState<NewSparkDraft | undefined>(() =>
    readNewSparkDraft()
  );
  const [syncPreferences, setSyncPreferences] = useState<GoogleSyncPreferences>(() =>
    readGoogleSyncPreferences()
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [googleConnectedInMemory, setGoogleConnectedInMemory] = useState(() =>
    hasGoogleDriveAccessToken()
  );
  const [googleSyncStatus, setGoogleSyncStatus] = useState<RemoteSyncStatus>(
    googleSyncAvailable ? "idle" : "unavailable"
  );
  const [googleSyncMessage, setGoogleSyncMessage] = useState(
    googleSyncAvailable ? "" : googleSyncUnavailableMessage()
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const googleSyncBusyRef = useRef(false);
  const quietSyncTimerRef = useRef<number | null>(null);
  const draftAutosaveTimerRef = useRef<number | null>(null);
  const editorRef = useRef<EditorState | null>(editor);
  const syncPreferencesRef = useRef(syncPreferences);
  const isOnlineRef = useRef(isOnline);

  const activeSpark = useMemo(
    () => sparks.find((spark) => spark.id === editor?.id),
    [editor?.id, sparks]
  );
  const filteredSparks = useMemo(
    () =>
      stageFilter === "all"
        ? sparks
        : sparks.filter((spark) => normalizeSparkStage(spark.stage) === stageFilter),
    [sparks, stageFilter]
  );

  const isEditing = Boolean(editor?.id);
  const activeSparkStage = activeSpark ? normalizeSparkStage(activeSpark.stage) : "spark";
  const canSave = Boolean(editor?.text.trim());
  const isGoogleSyncBusy =
    googleSyncStatus === "authorizing" || googleSyncStatus === "syncing";
  const googleSyncTitle = googleSyncHeading(
    googleSyncAvailable,
    syncPreferences,
    googleConnectedInMemory,
    isOnline,
    googleSyncStatus
  );
  const showConnectGoogleButton =
    googleSyncAvailable &&
    isOnline &&
    (!syncPreferences.googleSyncEnabled ||
      !googleConnectedInMemory ||
      googleSyncStatus === "error");
  const lastSyncText = syncPreferences.lastSyncAt
    ? `Posledný sync: ${formatDate(syncPreferences.lastSyncAt)}`
    : "Posledný sync: zatiaľ nie";

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    syncPreferencesRef.current = syncPreferences;
  }, [syncPreferences]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    tryQuietSyncIfUseful({ force: true });

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        tryQuietSyncIfUseful();
      }
    }

    function handleOnline() {
      setIsOnline(true);
      isOnlineRef.current = true;
      tryQuietSyncIfUseful();
    }

    function handleOffline() {
      setIsOnline(false);
      isOnlineRef.current = false;
      clearQuietSyncTimer();

      if (!syncPreferencesRef.current.googleSyncEnabled) {
        return;
      }

      setGoogleSyncStatus("offline");
      setGoogleSyncMessage(googleSyncOfflineMessage());
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", flushNewSparkDraft);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pagehide", flushNewSparkDraft);

    return () => {
      flushNewSparkDraft();
      clearQuietSyncTimer();
      clearDraftAutosaveTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", flushNewSparkDraft);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pagehide", flushNewSparkDraft);
    };
  }, []);

  function startNewSpark() {
    const nextEditor = { text: "" };
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    setSavedMessage("");
    setDataMessage("");
  }

  function openSpark(spark: Spark) {
    const nextEditor = { id: spark.id, text: spark.text };
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    setSavedMessage("");
    setDataMessage("");
  }

  function closeEditor() {
    flushNewSparkDraft();
    editorRef.current = null;

    setEditor(null);
  }

  function handleRestoreDraft() {
    if (!newSparkDraft) {
      return;
    }

    const nextEditor = { text: newSparkDraft.text };
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    setSavedMessage("");
    setDataMessage("");
  }

  function handleDiscardDraft() {
    clearDraftAutosaveTimer();
    clearNewSparkDraft();
    setNewSparkDraft(undefined);
    setSavedMessage("Rozpísaná iskra zahodená.");
  }

  function clearQuietSyncTimer() {
    if (quietSyncTimerRef.current !== null) {
      window.clearTimeout(quietSyncTimerRef.current);
      quietSyncTimerRef.current = null;
    }
  }

  function clearDraftAutosaveTimer() {
    if (draftAutosaveTimerRef.current !== null) {
      window.clearTimeout(draftAutosaveTimerRef.current);
      draftAutosaveTimerRef.current = null;
    }
  }

  function flushNewSparkDraft() {
    const current = editorRef.current;

    if (current && !current.id && current.text.trim()) {
      clearDraftAutosaveTimer();
      setNewSparkDraft(saveNewSparkDraft(current.text));
    }
  }

  function scheduleNewSparkDraftSave(text: string) {
    clearDraftAutosaveTimer();

    if (!text.trim()) {
      clearNewSparkDraft();
      setNewSparkDraft(undefined);
      return;
    }

    draftAutosaveTimerRef.current = window.setTimeout(() => {
      draftAutosaveTimerRef.current = null;
      setNewSparkDraft(saveNewSparkDraft(text));
    }, DRAFT_AUTOSAVE_DEBOUNCE_MS);
  }

  function handleSparkTextChange(text: string) {
    const isNewSpark = editor !== null && !editor.id;

    setEditor((current) => {
      const next = current ? { ...current, text } : current;
      editorRef.current = next;
      return next;
    });

    if (isNewSpark) {
      scheduleNewSparkDraftSave(text);
    }
  }

  function handleStageChange(stage: SparkStage) {
    if (!activeSpark) {
      return;
    }

    const updated = updateSparkStage(activeSpark.id, stage);

    if (!updated) {
      return;
    }

    setSparks(listSparks());
    setSavedMessage(
      `Zošit zmenený na ${STAGE_LABELS[normalizeSparkStage(updated.stage)]} ${formatDate(
        updated.updatedAt
      )}`
    );
    markLocalChangesForSync();
  }

  function applySyncPreferences(patch: Partial<GoogleSyncPreferences>) {
    const next = updateGoogleSyncPreferences(patch);
    syncPreferencesRef.current = next;
    setSyncPreferences(next);
    return next;
  }

  function showWaitingForGoogle() {
    setGoogleConnectedInMemory(false);
    setGoogleSyncStatus("idle");
    setGoogleSyncMessage(googleSyncWaitingMessage());
  }

  function scheduleQuietSync() {
    clearQuietSyncTimer();
    quietSyncTimerRef.current = window.setTimeout(() => {
      quietSyncTimerRef.current = null;
      void runGoogleSync({ useExistingTokenOnly: true, quiet: true });
    }, QUIET_SYNC_DEBOUNCE_MS);

    setGoogleSyncStatus("connected");
    setGoogleSyncMessage("Svitok dorovná zmeny o chvíľu. Písať môžeš ďalej.");
  }

  function tryQuietSyncIfUseful({ force = false } = {}) {
    const preferences = syncPreferencesRef.current;

    if (!googleSyncAvailable || !preferences.googleSyncEnabled) {
      return;
    }

    if (!isOnlineRef.current) {
      setGoogleSyncStatus("offline");
      setGoogleSyncMessage(googleSyncOfflineMessage());
      return;
    }

    if (
      !force &&
      !preferences.pendingLocalChanges &&
      !isLastSyncStale(preferences.lastSyncAt)
    ) {
      return;
    }

    if (!hasGoogleDriveAccessToken()) {
      showWaitingForGoogle();
      return;
    }

    void runGoogleSync({ useExistingTokenOnly: true, quiet: true });
  }

  function markLocalChangesForSync() {
    const nextPreferences = applySyncPreferences({
      pendingLocalChanges: true,
      lastSyncError: undefined
    });

    if (!googleSyncAvailable) {
      setGoogleSyncStatus("unavailable");
      setGoogleSyncMessage(googleSyncUnavailableMessage());
      return;
    }

    if (!isOnlineRef.current) {
      setGoogleSyncStatus("offline");
      setGoogleSyncMessage(googleSyncOfflineMessage());
      return;
    }

    if (!nextPreferences.googleSyncEnabled) {
      setGoogleSyncStatus("idle");
      setGoogleSyncMessage("Lokálne zmeny čakajú. Svitok zapneš cez Pripojiť Google.");
      return;
    }

    if (!hasGoogleDriveAccessToken()) {
      showWaitingForGoogle();
      return;
    }

    scheduleQuietSync();
  }

  async function runGoogleSync({
    useExistingTokenOnly,
    quiet = false
  }: {
    useExistingTokenOnly: boolean;
    quiet?: boolean;
  }) {
    if (!googleSyncAvailable) {
      setGoogleSyncStatus("unavailable");
      setGoogleSyncMessage(googleSyncUnavailableMessage());
      return;
    }

    if (!isOnlineRef.current) {
      setGoogleSyncStatus("offline");
      setGoogleSyncMessage(googleSyncOfflineMessage());
      return;
    }

    if (googleSyncBusyRef.current) {
      return;
    }

    if (useExistingTokenOnly && !hasGoogleDriveAccessToken()) {
      showWaitingForGoogle();
      return;
    }

    clearQuietSyncTimer();
    googleSyncBusyRef.current = true;
    setGoogleSyncStatus("syncing");
    setGoogleSyncMessage(
      quiet ? "Svitok ticho prenáša zmeny..." : "Synchronizujem cez Google Drive..."
    );

    try {
      const result = await syncGoogleDrive({ useExistingTokenOnly });
      const resultMessage = `${result.message} Pridané ${result.counts.added}, aktualizované ${result.counts.updated}, ponechané ${result.counts.kept}.`;

      setSparks(listSparks());
      if (!quiet) {
        flushNewSparkDraft();
        editorRef.current = null;
        setEditor(null);
        setSavedMessage("");
      }
      setGoogleConnectedInMemory(hasGoogleDriveAccessToken());

      if (result.status === "upload-warning") {
        applySyncPreferences({
          googleSyncEnabled: true,
          lastSyncResult: resultMessage,
          lastSyncError: result.message,
          pendingLocalChanges: true
        });
        setGoogleSyncStatus("error");
      } else {
        applySyncPreferences({
          googleSyncEnabled: true,
          lastSyncAt: new Date().toISOString(),
          lastSyncResult: resultMessage,
          lastSyncError: undefined,
          pendingLocalChanges: false
        });
        setGoogleSyncStatus("connected");
      }

      setGoogleSyncMessage(resultMessage);
    } catch {
      const tokenStillActive = hasGoogleDriveAccessToken();
      const message =
        useExistingTokenOnly && !tokenStillActive
          ? googleSyncWaitingMessage()
          : "Synchronizácia zlyhala. Lokálne iskry ostali chránené; ak bol vzdialený súbor neplatný, nič sa neprepísalo.";
      const pendingLocalChanges = readGoogleSyncPreferences().pendingLocalChanges ?? false;

      setGoogleConnectedInMemory(tokenStillActive);
      applySyncPreferences({
        lastSyncError: message,
        pendingLocalChanges
      });
      setGoogleSyncStatus(useExistingTokenOnly && !tokenStillActive ? "idle" : "error");
      setGoogleSyncMessage(message);
    } finally {
      googleSyncBusyRef.current = false;
    }
  }

  function handleSave() {
    if (!editor?.text.trim()) {
      return;
    }

    const isNewSpark = !editor.id;
    const saved = saveSpark({
      id: editor.id,
      text: editor.text
    });

    if (isNewSpark) {
      clearDraftAutosaveTimer();
      clearNewSparkDraft();
      setNewSparkDraft(undefined);
    }

    setSparks(listSparks());
    editorRef.current = null;
    setEditor(null);
    setSavedMessage(
      isNewSpark
        ? `Iskra uložená ${formatDate(saved.updatedAt)}`
        : `Zmeny uložené ${formatDate(saved.updatedAt)}`
    );
    markLocalChangesForSync();
  }

  function handleDeleteSpark() {
    if (!editor?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Zmazať túto iskru? Po synchronizácii zmizne aj z ďalších zariadení."
    );

    if (!confirmed) {
      return;
    }

    const deleted = deleteSpark(editor.id);

    if (!deleted) {
      return;
    }

    setSparks(listSparks());
    editorRef.current = null;
    setEditor(null);
    setDataMessage("");
    setSavedMessage(`Iskra zmazaná ${formatDate(deleted.updatedAt)}`);
    markLocalChangesForSync();
  }

  function handleExportDb() {
    const exportData = createWriterDbExport();
    const fileName = getWriterDbExportFileName(new Date(exportData.exportedAt));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    setDataMessage(`Export pripravený: ${exportData.sparkCount} iskier.`);
  }

  function handleExportDbV2() {
    const exportData = createManualWriterDbV2Export();
    const validation = parseWriterDbPayload(exportData);

    if (!validation.ok || validation.db.schemaVersion !== 2) {
      const message = validation.ok
        ? "Writer DB v2 export neprešiel v2 kontrolou."
        : validation.error;
      setDataMessage(`Writer DB v2 export zlyhal: ${message}`);
      return;
    }

    const fileName = getManualWriterDbV2ExportFileName(new Date(exportData.exportedAt));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    setDataMessage(
      `Writer DB v2 test export pripravený: ${exportData.sparkCount} iskier, ${exportData.packageCount} balíkov.`
    );
  }

  function openImportPicker() {
    importInputRef.current?.click();
  }

  async function handleImportDb(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const result = importWriterDb(parsed);
      const skippedInvalid = result.skipped + result.invalid;

      flushNewSparkDraft();
      editorRef.current = null;
      setSparks(listSparks());
      setEditor(null);
      setSavedMessage("");
      setDataMessage(
        `Import hotový: pridané ${result.added}, aktualizované ${result.updated}, preskočené/neplatné ${skippedInvalid}.`
      );

      if (result.added || result.updated) {
        markLocalChangesForSync();
      }
    } catch {
      setDataMessage("Import zlyhal. Aktuálne iskry ostali nezmenené.");
    }
  }

  async function handleConnectGoogle() {
    if (!googleSyncAvailable) {
      setGoogleSyncStatus("unavailable");
      setGoogleSyncMessage(googleSyncUnavailableMessage());
      return;
    }

    setGoogleSyncStatus("authorizing");
    setGoogleSyncMessage("Otváram Google pripojenie...");

    try {
      await connectGoogleDrive();
      setGoogleConnectedInMemory(true);
      applySyncPreferences({
        googleSyncEnabled: true,
        lastSyncError: undefined
      });

      setGoogleSyncStatus("connected");
      setGoogleSyncMessage("Google je pripojený. Svitok je zapnutý.");

      scheduleQuietSync();
    } catch {
      setGoogleConnectedInMemory(false);
      applySyncPreferences({
        lastSyncError: "Pripojenie Google zlyhalo alebo bolo zrušené."
      });
      setGoogleSyncStatus("error");
      setGoogleSyncMessage("Pripojenie Google zlyhalo alebo bolo zrušené.");
    }
  }

  async function handleGoogleSync() {
    if (!isOnlineRef.current) {
      setGoogleSyncStatus("offline");
      setGoogleSyncMessage(googleSyncOfflineMessage());
      return;
    }

    await runGoogleSync({ useExistingTokenOnly: false });
  }

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">LassiLAB Writer v0.1</p>
        <h1 id="app-title">Rýchlejšie než zabudnutie.</h1>
        <p className="hero-copy">
          Zachyť jednu textovú iskru. Obraz, veta, pocit alebo rytmus môže
          dozrieť neskôr.
        </p>
        <button className="primary-action" type="button" onClick={startNewSpark}>
          ⚡ Nová iskra
        </button>
      </section>

      {savedMessage ? <p className="save-note">{savedMessage}</p> : null}

      {newSparkDraft && !editor ? (
        <section className="draft-recovery" aria-labelledby="draft-recovery-title">
          <div>
            <p className="eyebrow">Rozpísané</p>
            <h2 id="draft-recovery-title">Našiel som rozpísanú iskru.</h2>
          </div>
          <p className="data-copy">Obnoviť ju? Writer ju drží len lokálne v tomto prehliadači.</p>
          <div className="draft-actions">
            <button className="data-action" type="button" onClick={handleRestoreDraft}>
              Obnoviť
            </button>
            <button className="ghost-action" type="button" onClick={handleDiscardDraft}>
              Zahodiť
            </button>
          </div>
        </section>
      ) : null}

      {editor ? (
        <section className="editor-panel" aria-labelledby="editor-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{isEditing ? "Upravuješ" : "Zachytiť"}</p>
              <h2 id="editor-title">
                {isEditing && activeSpark ? sparkTitle(activeSpark) : "Nová iskra"}
              </h2>
            </div>
            <button className="ghost-action" type="button" onClick={closeEditor}>
              {isEditing ? "Zrušiť úpravu" : "Zavrieť"}
            </button>
          </div>

          <p className="editor-context">
            {isEditing
              ? "Upravuješ uloženú iskru. Rozpísaná nová iskra ostáva chránená zvlášť."
              : "Rýchlo zachyť novú iskru. Rozpísaný text sa chráni lokálne."}
          </p>

          <label className="spark-label" htmlFor="spark-text">
            {isEditing ? "Text iskry" : "Čo práve nechceš stratiť?"}
          </label>
          <textarea
            id="spark-text"
            className="spark-input"
            autoFocus
            placeholder="Obraz, veta, pocit, kus melódie v hlave..."
            value={editor.text}
            onChange={(event) => handleSparkTextChange(event.target.value)}
          />

          {isEditing && activeSpark ? (
            <label className="stage-field" htmlFor="spark-stage">
              <span>Zošit</span>
              <select
                id="spark-stage"
                value={activeSparkStage}
                onChange={(event) => handleStageChange(event.target.value as SparkStage)}
              >
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="editor-actions">
            <button
              className="save-action"
              type="button"
              disabled={!canSave}
              onClick={handleSave}
            >
              {isEditing ? "Uložiť zmeny" : "Uložiť iskru"}
            </button>
            {isEditing ? (
              <button className="delete-action" type="button" onClick={handleDeleteSpark}>
                Zmazať iskru
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="recent-section" aria-labelledby="recent-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Žeravisko</p>
            <h2 id="recent-title">Posledné iskry</h2>
          </div>
          <span className="spark-count">{sparks.length}</span>
        </div>

        <div className="stage-filters" aria-label="Filtrovať zošity">
          {STAGE_FILTERS.map((filter) => (
            <button
              className="stage-filter"
              data-active={stageFilter === filter.value}
              key={filter.value}
              type="button"
              aria-pressed={stageFilter === filter.value}
              onClick={() => setStageFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {filteredSparks.length ? (
          <div className="spark-list">
            {filteredSparks.map((spark) => (
              <button
                className="spark-card"
                key={spark.id}
                type="button"
                onClick={() => openSpark(spark)}
              >
                <span className="stage-badge">{sparkStageLabel(spark)}</span>
                <span className="spark-card-title">{sparkTitle(spark)}</span>
                <span className="spark-card-preview">{sparkPreview(spark)}</span>
                <span className="spark-card-time">
                  Úprava {formatDate(spark.updatedAt)}
                </span>
                <span className="spark-card-action">Upraviť</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {sparks.length ? (
              <>
                <p>V tomto zošite zatiaľ nič nie je.</p>
                <p>Skús iný filter alebo presuň uloženú iskru do tohto zošita.</p>
              </>
            ) : (
              <>
                <p>Zatiaľ tu nie je žiadna iskra.</p>
                <p>Jedno tlačidlo hore stačí. Zachyť len to najnutnejšie.</p>
              </>
            )}
          </div>
        )}
      </section>

      <section className="data-section" aria-labelledby="data-title">
        <div>
          <p className="eyebrow">Dáta</p>
          <h2 id="data-title">Ručný prenos DB</h2>
        </div>
        <p className="data-copy">
          Exportuj lokálne iskry do JSON súboru alebo importuj Writer DB z iného
          zariadenia. Toto nie je cloud sync.
        </p>
        <div className="data-actions">
          <button className="data-action" type="button" onClick={handleExportDb}>
            Exportovať DB
          </button>
          <button className="data-action" type="button" onClick={handleExportDbV2}>
            Exportovať DB v2 test
          </button>
          <button className="data-action" type="button" onClick={openImportPicker}>
            Importovať DB
          </button>
        </div>
        <input
          ref={importInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={handleImportDb}
        />
        {dataMessage ? <p className="data-note">{dataMessage}</p> : null}

        <div className="sync-panel" aria-labelledby="google-sync-title">
          <div>
            <p className="eyebrow">Google Drive sync</p>
            <h3 id="google-sync-title">Skrytý most medzi zariadeniami</h3>
          </div>
          <p className="data-copy">
            {googleSyncTitle}. Pre jedného autora a viac zariadení. Google účet
            slúži len na prístup k skrytému appDataFolder súboru.
          </p>
          <div className="sync-status-list" aria-live="polite">
            <p>{lastSyncText}</p>
            {syncPreferences.pendingLocalChanges ? (
              <p>Lokálne zmeny čakajú na sync.</p>
            ) : (
              <p>Lokálne zmeny sú pokojné.</p>
            )}
            <p>Písať môžeš ďalej, Writer ukladá lokálne.</p>
            {syncPreferences.lastSyncResult ? (
              <p>Posledný výsledok: {syncPreferences.lastSyncResult}</p>
            ) : null}
            {syncPreferences.lastSyncError ? (
              <p className="sync-error">{syncPreferences.lastSyncError}</p>
            ) : null}
          </div>
          <div className="data-actions">
            {showConnectGoogleButton ? (
              <button
                className="data-action"
                type="button"
                disabled={!googleSyncAvailable || !isOnline || isGoogleSyncBusy}
                onClick={handleConnectGoogle}
              >
                Pripojiť Google
              </button>
            ) : null}
            <button
              className="data-action"
              type="button"
              disabled={!googleSyncAvailable || !isOnline || isGoogleSyncBusy}
              onClick={handleGoogleSync}
            >
              Synchronizovať teraz
            </button>
          </div>
          {googleSyncMessage ? (
            <p className="data-note" data-status={googleSyncStatus}>
              {googleSyncMessage}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
