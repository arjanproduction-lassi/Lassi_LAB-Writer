import { useEffect, useState } from "react";
import type { ProductShellDataMode } from "./productShellDataMode";
import {
  PRODUCT_SHELL_LAYERS,
  PRODUCT_SHELL_NAV_ITEMS,
  PRODUCT_SHELL_NEW_PACKAGE_ID,
  createEmptyProductShellPackage,
  createInitialProductShellState,
  createProductShellFixtures,
  getProductShellContextLayer,
  getProductShellProgress,
  transitionProductShell,
  type ProductShellEvent,
  type ProductShellLayer,
  type ProductShellPackage
} from "./productShellPrototypeModel";

function formatPrototypeDate(value: string) {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function excerpt(value: string, length = 118) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Táto vrstva je zatiaľ prázdna.";
  }
  return compact.length > length ? `${compact.slice(0, length).trimEnd()}…` : compact;
}

type ProductShellPrototypeProps = Readonly<{
  dataMode: ProductShellDataMode;
}>;

function ProductShellRealReadOnlyPlaceholder() {
  return (
    <div className="product-shell-root">
      <a className="prototype-skip-link" href="#prototype-main">
        Preskočiť na obsah
      </a>
      <div className="prototype-banner" role="note">
        Vývojový režim – bez načítania dát
      </div>
      <main className="prototype-page prototype-mode-placeholder" id="prototype-main">
        <section
          className="prototype-mode-placeholder-card"
          aria-labelledby="prototype-mode-placeholder-title"
        >
          <p className="prototype-eyebrow">Vývojový režim – bez načítania dát</p>
          <h1 id="prototype-mode-placeholder-title">Read-only režim je pripravený.</h1>
          <p>Pripojenie katalógu príde v ďalšom kroku.</p>
        </section>
      </main>
    </div>
  );
}

export function ProductShellPrototype({ dataMode }: ProductShellPrototypeProps) {
  return dataMode === "real-read-only" ? (
    <ProductShellRealReadOnlyPlaceholder />
  ) : (
    <FixtureProductShellPrototype />
  );
}

function FixtureProductShellPrototype() {
  const [packages, setPackages] = useState<ProductShellPackage[]>(() =>
    createProductShellFixtures()
  );
  const [shellState, setShellState] = useState(createInitialProductShellState);

  const selectedPackage = packages.find(
    (candidate) => candidate.id === shellState.selectedPackageId
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [shellState.view, shellState.selectedPackageId]);

  function dispatch(event: ProductShellEvent) {
    setShellState((current) => transitionProductShell(current, event));
  }

  function openPackage(packageId: string) {
    dispatch({ type: "open-package", packageId });
  }

  function openNewSpark() {
    setPackages((current) => {
      const withoutPreviousBlank = current.filter(
        (candidate) => candidate.id !== PRODUCT_SHELL_NEW_PACKAGE_ID
      );
      return [createEmptyProductShellPackage(), ...withoutPreviousBlank];
    });
    dispatch({ type: "new-spark" });
  }

  function updateSelectedPackage(
    update: (current: ProductShellPackage) => ProductShellPackage
  ) {
    if (!selectedPackage) {
      return;
    }

    setPackages((current) =>
      current.map((candidate) =>
        candidate.id === selectedPackage.id ? update(candidate) : candidate
      )
    );
  }

  function addFixtureNote() {
    if (!selectedPackage) {
      return;
    }

    updateSelectedPackage((current) => ({
      ...current,
      notes: [
        ...current.notes,
        {
          id: `local-note-${current.notes.length + 1}`,
          text: "Nová lokálna prototypová poznámka.",
          updatedAt: "2026-07-21T09:15:00.000Z"
        }
      ]
    }));
  }

  function updateNote(noteId: string, text: string) {
    updateSelectedPackage((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId ? { ...note, text } : note
      )
    }));
  }

  function renderLayer(
    layer: ProductShellLayer,
    writerPackage: ProductShellPackage,
    mode: "active" | "context"
  ) {
    const isActive = mode === "active";

    if (layer === "spark") {
      return (
        <section className="prototype-layer-content" aria-labelledby={`${mode}-spark-title`}>
          <div className="prototype-layer-heading">
            <p className="prototype-eyebrow">Pôvodný impulz</p>
            <h2 id={`${mode}-spark-title`}>Iskra</h2>
          </div>
          <p className="prototype-layer-intro">
            Rodný list diela. Ďalšie vrstvy ho neprepisujú.
          </p>
          {isActive ? (
            <label className="prototype-field">
              <span>Text iskry</span>
              <textarea
                value={writerPackage.sparkText}
                placeholder="Čo práve nechceš stratiť?"
                onChange={(event) =>
                  updateSelectedPackage((current) => ({
                    ...current,
                    sparkText: event.target.value
                  }))
                }
              />
            </label>
          ) : (
            <blockquote className="prototype-spark-quote">
              {excerpt(writerPackage.sparkText, 260)}
            </blockquote>
          )}
        </section>
      );
    }

    if (layer === "notes") {
      return (
        <section className="prototype-layer-content" aria-labelledby={`${mode}-notes-title`}>
          <div className="prototype-layer-heading prototype-layer-heading-row">
            <div>
              <p className="prototype-eyebrow">Materiál okolo diela</p>
              <h2 id={`${mode}-notes-title`}>Poznámky</h2>
            </div>
            {isActive ? (
              <button className="prototype-secondary-button" type="button" onClick={addFixtureNote}>
                Pridať poznámku
              </button>
            ) : null}
          </div>
          {writerPackage.notes.length ? (
            <div className="prototype-note-list">
              {writerPackage.notes.map((note, index) =>
                isActive ? (
                  <label className="prototype-note" key={note.id}>
                    <span>Poznámka {index + 1}</span>
                    <textarea
                      value={note.text}
                      aria-label={`Poznámka ${index + 1}`}
                      onChange={(event) => updateNote(note.id, event.target.value)}
                    />
                    <small>Fixture čas: {formatPrototypeDate(note.updatedAt)}</small>
                  </label>
                ) : (
                  <article className="prototype-note-preview" key={note.id}>
                    <strong>Poznámka {index + 1}</strong>
                    <p>{excerpt(note.text)}</p>
                  </article>
                )
              )}
            </div>
          ) : (
            <p className="prototype-empty-copy">
              Zatiaľ bez poznámok. V prototype ich môžeš pridať bez uloženia.
            </p>
          )}
        </section>
      );
    }

    if (layer === "workshop") {
      return (
        <section className="prototype-layer-content" aria-labelledby={`${mode}-workshop-title`}>
          <div className="prototype-layer-heading">
            <p className="prototype-eyebrow">Pracovný text</p>
            <h2 id={`${mode}-workshop-title`}>Dielňa</h2>
          </div>
          {isActive ? (
            <label className="prototype-field prototype-editor-field">
              <span>Rozvíjanie a tvarovanie textu</span>
              <textarea
                value={writerPackage.workshopText}
                placeholder="Tu vzniká pracovný text…"
                onChange={(event) =>
                  updateSelectedPackage((current) => ({
                    ...current,
                    workshopText: event.target.value
                  }))
                }
              />
            </label>
          ) : (
            <p className="prototype-context-text">
              {excerpt(writerPackage.workshopText, 420)}
            </p>
          )}
        </section>
      );
    }

    return (
      <section className="prototype-layer-content" aria-labelledby={`${mode}-final-title`}>
        <div className="prototype-layer-heading">
          <p className="prototype-eyebrow">Čistá prijatá verzia</p>
          <h2 id={`${mode}-final-title`}>Text OK</h2>
        </div>
        <p className="prototype-layer-intro">
          Oddelené od pracovného textu. Bez publikovania a exportných akcií.
        </p>
        {isActive ? (
          <label className="prototype-field prototype-editor-field">
            <span>Finálny text</span>
            <textarea
              value={writerPackage.finalText}
              placeholder="Čistá verzia bude bývať tu…"
              onChange={(event) =>
                updateSelectedPackage((current) => ({
                  ...current,
                  finalText: event.target.value
                }))
              }
            />
          </label>
        ) : (
          <p className="prototype-context-text">{excerpt(writerPackage.finalText, 420)}</p>
        )}
      </section>
    );
  }

  function renderLibrary() {
    const continuePackage = packages.find(
      (candidate) => candidate.id !== PRODUCT_SHELL_NEW_PACKAGE_ID
    ) ?? packages[0];

    return (
      <main className="prototype-page prototype-library" id="prototype-main">
        <section className="prototype-library-hero" aria-labelledby="prototype-library-title">
          <div>
            <p className="prototype-eyebrow">Autorská dielňa</p>
            <h1 id="prototype-library-title">Rýchlejšie než zabudnutie.</h1>
            <p>
              Zachyť iskru alebo sa vráť k dielu, ktoré už čaká na ďalšiu vrstvu.
            </p>
          </div>
          <button className="prototype-primary-button" type="button" onClick={openNewSpark}>
            Nová iskra
          </button>
        </section>

        {continuePackage ? (
          <section className="prototype-section" aria-labelledby="prototype-continue-title">
            <div className="prototype-section-heading">
              <div>
                <p className="prototype-eyebrow">Posledné otvorené</p>
                <h2 id="prototype-continue-title">Pokračovať</h2>
              </div>
            </div>
            <button
              className="prototype-continue-card"
              type="button"
              onClick={() => openPackage(continuePackage.id)}
            >
              <span>
                <strong>{continuePackage.title}</strong>
                <small>{excerpt(continuePackage.workshopText || continuePackage.sparkText)}</small>
              </span>
              <span className="prototype-card-meta">
                {getProductShellProgress(continuePackage)} · {formatPrototypeDate(continuePackage.updatedAt)}
              </span>
              <span className="prototype-card-action">Otvoriť Dielňu</span>
            </button>
          </section>
        ) : null}

        <section className="prototype-section" aria-labelledby="prototype-packages-title">
          <div className="prototype-section-heading">
            <div>
              <p className="prototype-eyebrow">Tvorivé balíky</p>
              <h2 id="prototype-packages-title">Knižnica</h2>
            </div>
            <span className="prototype-count">{packages.length}</span>
          </div>
          <div className="prototype-package-grid">
            {packages.map((writerPackage) => (
              <button
                className="prototype-package-card"
                type="button"
                key={writerPackage.id}
                onClick={() => openPackage(writerPackage.id)}
              >
                <span className="prototype-progress">{getProductShellProgress(writerPackage)}</span>
                <strong>{writerPackage.title}</strong>
                <span>{excerpt(writerPackage.sparkText)}</span>
                <small>Upravené {formatPrototypeDate(writerPackage.updatedAt)}</small>
                <span className="prototype-card-action">Otvoriť</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  function renderWorkshop() {
    if (!selectedPackage) {
      return renderLibrary();
    }

    const contextLayer = getProductShellContextLayer(shellState.activeLayer);

    return (
      <main className="prototype-page prototype-workshop-page" id="prototype-main">
        <header className="prototype-work-titlebar">
          <button
            className="prototype-back-button"
            type="button"
            onClick={() => dispatch({ type: "back-to-library" })}
          >
            Späť do Knižnice
          </button>
          <label className="prototype-title-field">
            <span>Názov diela</span>
            <input
              value={selectedPackage.title}
              onChange={(event) =>
                updateSelectedPackage((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </label>
          <p className="prototype-save-state" role="status">
            Prototyp – neukladá sa
          </p>
        </header>

        <nav className="prototype-layer-tabs" aria-label="Vrstvy tvorivého balíka">
          {PRODUCT_SHELL_LAYERS.map((layer) => (
            <button
              type="button"
              key={layer.id}
              aria-pressed={shellState.activeLayer === layer.id}
              onClick={() => dispatch({ type: "select-layer", layer: layer.id })}
            >
              {layer.label}
            </button>
          ))}
        </nav>

        <div className="prototype-workspace">
          <aside className="prototype-panel prototype-context-panel" aria-label="Kontextová vrstva">
            <span className="prototype-panel-role">Kontext</span>
            {renderLayer(contextLayer, selectedPackage, "context")}
          </aside>
          <section className="prototype-panel prototype-active-panel" aria-label="Aktívna vrstva">
            <span className="prototype-panel-role">Aktívna vrstva</span>
            {renderLayer(shellState.activeLayer, selectedPackage, "active")}
          </section>
        </div>
      </main>
    );
  }

  function renderData() {
    return (
      <main className="prototype-page prototype-data-page" id="prototype-main">
        <header className="prototype-data-hero">
          <p className="prototype-eyebrow">Mimo tvorivého priestoru</p>
          <h1>Dáta a sync</h1>
          <p>
            Statická maketa. Ovládacie prvky nie sú pripojené k žiadnej produkčnej operácii.
          </p>
        </header>

        <div className="prototype-data-groups">
          <section className="prototype-data-group">
            <div>
              <p className="prototype-eyebrow">Lokálne uloženie</p>
              <h2>V poriadku</h2>
            </div>
            <p>Fixture úpravy žijú iba v pamäti tejto otvorenej stránky.</p>
            <span className="prototype-status-chip">Prototyp – neukladá sa</span>
          </section>

          <section className="prototype-data-group">
            <div>
              <p className="prototype-eyebrow">Google Drive sync</p>
              <h2>Pripojené</h2>
            </div>
            <p>Fixture stav: posledná synchronizácia pred 3 minútami.</p>
            <button type="button" disabled>Synchronizovať teraz — maketa</button>
          </section>

          <section className="prototype-data-group">
            <div>
              <p className="prototype-eyebrow">Prenos databázy</p>
              <h2>Import a export</h2>
            </div>
            <p>Skutočné bezpečné operácie zostávajú iba v produkčnej aplikácii.</p>
            <div className="prototype-data-actions">
              <button type="button" disabled>Importovať — maketa</button>
              <button type="button" disabled>Exportovať — maketa</button>
            </div>
          </section>

          <section className="prototype-data-group">
            <div>
              <p className="prototype-eyebrow">Bezpečnostná vrstva</p>
              <h2>Backup a recovery</h2>
            </div>
            <p>Fixture stav: bez aktívneho problému.</p>
            <details>
              <summary>Technické detaily</summary>
              <p>
                Táto sekcia iba skúša hierarchiu informácií. Nečíta markery, backupy ani databázové verzie.
              </p>
            </details>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="product-shell-root">
      <a className="prototype-skip-link" href="#prototype-main">
        Preskočiť na obsah
      </a>
      <div className="prototype-banner" role="note">
        Lokálny product shell · iba umelé fixture dáta · nič sa neukladá
      </div>
      <header className="prototype-app-header">
        <button
          className="prototype-brand"
          type="button"
          onClick={() => dispatch({ type: "navigate", view: "library" })}
        >
          <span>LassiLAB</span>
          <strong>Writer</strong>
        </button>
        <nav className="prototype-main-nav" aria-label="Hlavná navigácia prototypu">
          {PRODUCT_SHELL_NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={shellState.view === item.id ? "page" : undefined}
              onClick={() => dispatch({ type: "navigate", view: item.id })}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          className="prototype-sync-indicator"
          type="button"
          onClick={() => dispatch({ type: "navigate", view: "data" })}
        >
          Fixture sync v poriadku
        </button>
      </header>

      {shellState.view === "library"
        ? renderLibrary()
        : shellState.view === "workshop"
          ? renderWorkshop()
          : renderData()}
    </div>
  );
}
