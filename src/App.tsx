import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  connectGoogleDrive,
  hasGoogleDriveAccessToken,
  isGoogleDriveSyncConfigured,
  syncGoogleDrive
} from "./googleDriveSync";
import {
  createWriterDbExport,
  deleteSpark,
  getWriterDbExportFileName,
  importWriterDb,
  listSparks,
  readGoogleSyncPreferences,
  saveSpark,
  updateGoogleSyncPreferences
} from "./storage";
import type { GoogleSyncPreferences, RemoteSyncStatus, Spark } from "./types";

type EditorState = {
  id?: string;
  text: string;
};

const QUIET_SYNC_DEBOUNCE_MS = 4000;
const STALE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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
  const [savedMessage, setSavedMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
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
  const syncPreferencesRef = useRef(syncPreferences);
  const isOnlineRef = useRef(isOnline);

  const activeSpark = useMemo(
    () => sparks.find((spark) => spark.id === editor?.id),
    [editor?.id, sparks]
  );

  const isEditing = Boolean(editor?.id);
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
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearQuietSyncTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function startNewSpark() {
    setEditor({ text: "" });
    setSavedMessage("");
    setDataMessage("");
  }

  function openSpark(spark: Spark) {
    setEditor({ id: spark.id, text: spark.text });
    setSavedMessage("");
    setDataMessage("");
  }

  function closeEditor() {
    setEditor(null);
  }

  function clearQuietSyncTimer() {
    if (quietSyncTimerRef.current !== null) {
      window.clearTimeout(quietSyncTimerRef.current);
      quietSyncTimerRef.current = null;
    }
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

    const saved = saveSpark({
      id: editor.id,
      text: editor.text
    });

    setSparks(listSparks());
    setEditor(null);
    setSavedMessage(`Iskra uložená ${formatDate(saved.updatedAt)}`);
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

      {editor ? (
        <section className="editor-panel" aria-labelledby="editor-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{isEditing ? "Upraviť" : "Zachytiť"}</p>
              <h2 id="editor-title">
                {isEditing && activeSpark ? sparkTitle(activeSpark) : "Nová iskra"}
              </h2>
            </div>
            <button className="ghost-action" type="button" onClick={closeEditor}>
              Zavrieť
            </button>
          </div>

          <label className="spark-label" htmlFor="spark-text">
            Čo práve nechceš stratiť?
          </label>
          <textarea
            id="spark-text"
            className="spark-input"
            autoFocus
            placeholder="Obraz, veta, pocit, kus melódie v hlave..."
            value={editor.text}
            onChange={(event) =>
              setEditor((current) =>
                current ? { ...current, text: event.target.value } : current
              )
            }
          />

          <div className="editor-actions">
            <button
              className="save-action"
              type="button"
              disabled={!canSave}
              onClick={handleSave}
            >
              Uložiť iskru
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

        {sparks.length ? (
          <div className="spark-list">
            {sparks.map((spark) => (
              <button
                className="spark-card"
                key={spark.id}
                type="button"
                onClick={() => openSpark(spark)}
              >
                <span className="spark-card-title">{sparkTitle(spark)}</span>
                <span className="spark-card-preview">{sparkPreview(spark)}</span>
                <span className="spark-card-time">
                  Úprava {formatDate(spark.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Zatiaľ tu nie je žiadna iskra.</p>
            <p>Jedno tlačidlo hore stačí. Zachyť len to najnutnejšie.</p>
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
