import { type ChangeEvent, useMemo, useRef, useState } from "react";
import {
  connectGoogleDrive,
  isGoogleDriveSyncConfigured,
  syncGoogleDrive
} from "./googleDriveSync";
import {
  createWriterDbExport,
  getWriterDbExportFileName,
  importWriterDb,
  listSparks,
  saveSpark
} from "./storage";
import type { RemoteSyncStatus, Spark } from "./types";

type EditorState = {
  id?: string;
  text: string;
};

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

export default function App() {
  const googleSyncAvailable = isGoogleDriveSyncConfigured();
  const [sparks, setSparks] = useState<Spark[]>(() => listSparks());
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [googleSyncStatus, setGoogleSyncStatus] = useState<RemoteSyncStatus>(
    googleSyncAvailable ? "idle" : "unavailable"
  );
  const [googleSyncMessage, setGoogleSyncMessage] = useState(
    googleSyncAvailable
      ? ""
      : "Google Drive sync este nie je nakonfigurovany. Chyba VITE_GOOGLE_CLIENT_ID."
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  const activeSpark = useMemo(
    () => sparks.find((spark) => spark.id === editor?.id),
    [editor?.id, sparks]
  );

  const isEditing = Boolean(editor?.id);
  const canSave = Boolean(editor?.text.trim());
  const isGoogleSyncBusy =
    googleSyncStatus === "authorizing" || googleSyncStatus === "syncing";

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
    } catch {
      setDataMessage("Import zlyhal. Aktuálne iskry ostali nezmenené.");
    }
  }

  async function handleConnectGoogle() {
    if (!googleSyncAvailable) {
      setGoogleSyncStatus("unavailable");
      setGoogleSyncMessage(
        "Google Drive sync este nie je nakonfigurovany. Chyba VITE_GOOGLE_CLIENT_ID."
      );
      return;
    }

    setGoogleSyncStatus("authorizing");
    setGoogleSyncMessage("Otváram Google pripojenie...");

    try {
      await connectGoogleDrive();
      setGoogleSyncStatus("connected");
      setGoogleSyncMessage("Google je pripojený. Teraz môžeš synchronizovať.");
    } catch {
      setGoogleSyncStatus("error");
      setGoogleSyncMessage("Pripojenie Google zlyhalo alebo bolo zrušené.");
    }
  }

  async function handleGoogleSync() {
    if (!googleSyncAvailable) {
      setGoogleSyncStatus("unavailable");
      setGoogleSyncMessage(
        "Google Drive sync este nie je nakonfigurovany. Chyba VITE_GOOGLE_CLIENT_ID."
      );
      return;
    }

    setGoogleSyncStatus("syncing");
    setGoogleSyncMessage("Synchronizujem cez Google Drive...");

    try {
      const result = await syncGoogleDrive();
      setSparks(listSparks());
      setEditor(null);
      setSavedMessage("");
      setGoogleSyncStatus(result.status === "upload-warning" ? "error" : "connected");
      setGoogleSyncMessage(
        `${result.message} Pridane ${result.counts.added}, aktualizovane ${result.counts.updated}, ponechane ${result.counts.kept}.`
      );
    } catch {
      setGoogleSyncStatus("error");
      setGoogleSyncMessage(
        "Synchronizacia zlyhala. Lokalne iskry ostali chranene; ak bol vzdialeny subor neplatny, nic sa neprepisalo."
      );
    }
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
            Experimentálne. Pre jedného autora a viac zariadení. Google účet slúži
            len na prístup k skrytému appDataFolder súboru.
          </p>
          <div className="data-actions">
            <button
              className="data-action"
              type="button"
              disabled={!googleSyncAvailable || isGoogleSyncBusy}
              onClick={handleConnectGoogle}
            >
              Pripojiť Google
            </button>
            <button
              className="data-action"
              type="button"
              disabled={!googleSyncAvailable || isGoogleSyncBusy}
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
