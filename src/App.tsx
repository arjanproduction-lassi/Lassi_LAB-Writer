import { useMemo, useState } from "react";
import { listSparks, saveSpark } from "./storage";
import type { Spark } from "./types";

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
  const [sparks, setSparks] = useState<Spark[]>(() => listSparks());
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [savedMessage, setSavedMessage] = useState("");

  const activeSpark = useMemo(
    () => sparks.find((spark) => spark.id === editor?.id),
    [editor?.id, sparks]
  );

  const isEditing = Boolean(editor?.id);
  const canSave = Boolean(editor?.text.trim());

  function startNewSpark() {
    setEditor({ text: "" });
    setSavedMessage("");
  }

  function openSpark(spark: Spark) {
    setEditor({ id: spark.id, text: spark.text });
    setSavedMessage("");
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
    </main>
  );
}
