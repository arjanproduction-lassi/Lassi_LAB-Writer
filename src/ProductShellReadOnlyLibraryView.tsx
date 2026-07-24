import { useState, type ReactNode } from "react";
import { ProductShellReadOnlyDetailView } from "./ProductShellReadOnlyDetailView";
import type { WriterLibraryReadOnlyResult } from "./writerLibraryReadOnlyProvider";
import {
  createWriterLibraryReadOnlySelectionState,
  resolveWriterLibraryReadOnlySelection,
  returnToWriterLibrary,
  selectWriterLibraryDetail,
  setWriterLibraryDetailLayer
} from "./writerLibraryReadOnlySelection";
import type { WriterLibraryItem } from "./writerLibraryViewModel";
import {
  createWriterLibraryPresentation,
  getWriterLibraryOriginLabel,
  getWriterLibraryProgressLabel
} from "./productShellReadOnlyLibrary";

type ProductShellReadOnlyLibraryProps = Readonly<{
  result: WriterLibraryReadOnlyResult;
}>;

function formatReadOnlyDate(value: string) {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function ReadOnlyLibraryCard({
  item,
  variant,
  onOpen
}: Readonly<{
  item: WriterLibraryItem;
  variant: "continue" | "library";
  onOpen: (packageId: string) => void;
}>) {
  const progressLabel = getWriterLibraryProgressLabel(item.progress);
  const originLabel = getWriterLibraryOriginLabel(item.origin);

  if (variant === "continue") {
    return (
      <button
        className="prototype-continue-card prototype-read-only-card"
        type="button"
        onClick={() => onOpen(item.id)}
      >
        <span>
          <strong>{item.title}</strong>
          <small>{item.excerpt}</small>
        </span>
        <span className="prototype-card-meta">
          {progressLabel} · {formatReadOnlyDate(item.updatedAt)}
          {originLabel ? ` · ${originLabel}` : ""}
        </span>
        <span className="prototype-card-action">
          Otvoriť read-only Dielňu
        </span>
      </button>
    );
  }

  return (
    <button
      className="prototype-package-card prototype-read-only-card"
      type="button"
      onClick={() => onOpen(item.id)}
    >
      <span className="prototype-read-only-card-labels">
        <span className="prototype-progress">{progressLabel}</span>
        {originLabel ? <span className="prototype-origin-chip">{originLabel}</span> : null}
      </span>
      <strong>{item.title}</strong>
      <span>{item.excerpt}</span>
      {item.hasNotes ? <small>Poznámky: {item.noteCount}</small> : null}
      <small>Upravené {formatReadOnlyDate(item.updatedAt)}</small>
      <span className="prototype-card-action">Otvoriť read-only</span>
    </button>
  );
}

function ReadOnlyShellFrame({
  currentView,
  onReturnToLibrary,
  children
}: Readonly<{
  currentView: "library" | "detail";
  onReturnToLibrary: () => void;
  children: ReactNode;
}>) {
  return (
    <div className="product-shell-root">
      <a className="prototype-skip-link" href="#prototype-main">
        Preskočiť na obsah
      </a>
      <div className="prototype-banner" role="note">
        Vývojový read-only režim · lokálne dáta · nič sa neukladá
      </div>
      <header className="prototype-app-header">
        <div className="prototype-brand" aria-label="LassiLAB Writer">
          <span>LassiLAB</span>
          <strong>Writer</strong>
        </div>
        <nav
          className="prototype-main-nav"
          aria-label="Hlavná navigácia read-only režimu"
        >
          <button
            type="button"
            aria-current={currentView === "library" ? "page" : undefined}
            disabled={currentView === "library"}
            onClick={onReturnToLibrary}
          >
            Knižnica
          </button>
          <button
            type="button"
            aria-current={currentView === "detail" ? "page" : undefined}
            disabled
          >
            Dielňa
          </button>
          <button type="button" disabled title="Statická maketa bez živých akcií">
            Dáta · maketa
          </button>
        </nav>
        <span className="prototype-sync-indicator">Iba na čítanie</span>
      </header>
      {children}
    </div>
  );
}

export function ProductShellReadOnlyLibraryView({
  result
}: ProductShellReadOnlyLibraryProps) {
  const [selectionState, setSelectionState] = useState(
    createWriterLibraryReadOnlySelectionState
  );
  const presentation = createWriterLibraryPresentation(result);
  const resolvedSelection =
    result.status === "ready"
      ? resolveWriterLibraryReadOnlySelection(result.snapshot, selectionState)
      : undefined;

  function openDetail(packageId: string) {
    setSelectionState((current) =>
      selectWriterLibraryDetail(current, packageId)
    );
  }

  function returnToLibrary() {
    setSelectionState((current) => returnToWriterLibrary(current));
  }

  if (resolvedSelection?.status === "detail") {
    return (
      <ReadOnlyShellFrame currentView="detail" onReturnToLibrary={returnToLibrary}>
        <ProductShellReadOnlyDetailView
          detail={resolvedSelection.detail}
          activeLayer={resolvedSelection.activeLayer}
          onReturnToLibrary={returnToLibrary}
          onSelectLayer={(layer) =>
            setSelectionState((current) =>
              setWriterLibraryDetailLayer(current, layer)
            )
          }
        />
      </ReadOnlyShellFrame>
    );
  }

  if (resolvedSelection?.status === "missing-detail") {
    return (
      <ReadOnlyShellFrame currentView="detail" onReturnToLibrary={returnToLibrary}>
        <main className="prototype-page prototype-workshop-page" id="prototype-main">
          <section className="prototype-read-only-status" role="alert">
            <h1>Dielo sa v tomto načítaní nepodarilo otvoriť.</h1>
            <button
              className="prototype-secondary-button"
              type="button"
              onClick={returnToLibrary}
            >
              Späť do Knižnice
            </button>
          </section>
        </main>
      </ReadOnlyShellFrame>
    );
  }

  return (
    <ReadOnlyShellFrame currentView="library" onReturnToLibrary={returnToLibrary}>
      <main className="prototype-page prototype-library" id="prototype-main">
        <section className="prototype-library-hero" aria-labelledby="prototype-library-title">
          <div>
            <p className="prototype-eyebrow">Vývojový read-only režim</p>
            <h1 id="prototype-library-title">Rýchlejšie než zabudnutie.</h1>
            <p>Skutočný miestny katalóg je zobrazený iba na čítanie.</p>
          </div>
          <button className="prototype-primary-button" type="button" disabled>
            Nová iskra · Pripravujeme
          </button>
        </section>

        {presentation.status === "failed" ? (
          <section className="prototype-read-only-status" role="alert">
            <h2>Knižnicu sa nepodarilo načítať.</h2>
            <p>Žiadne údaje neboli zmenené.</p>
          </section>
        ) : (
          <>
            <section className="prototype-section" aria-labelledby="prototype-continue-title">
              <div className="prototype-section-heading">
                <div>
                  <p className="prototype-eyebrow">Najnovšie živé dielo</p>
                  <h2 id="prototype-continue-title">Pokračovať</h2>
                </div>
              </div>
              {presentation.status === "ready" ? (
                <ReadOnlyLibraryCard
                  item={presentation.continueItem}
                  variant="continue"
                  onOpen={openDetail}
                />
              ) : (
                <p className="prototype-empty-copy">Nie je na čom pokračovať.</p>
              )}
            </section>

            <section className="prototype-section" aria-labelledby="prototype-packages-title">
              <div className="prototype-section-heading">
                <div>
                  <p className="prototype-eyebrow">Tvorivé balíky</p>
                  <h2 id="prototype-packages-title">Knižnica</h2>
                </div>
                <span className="prototype-count">{presentation.items.length}</span>
              </div>
              {presentation.status === "empty" ? (
                <p className="prototype-empty-copy">Zatiaľ tu nie je žiadne dielo.</p>
              ) : (
                <div className="prototype-package-grid">
                  {presentation.items.map((item) => (
                    <ReadOnlyLibraryCard
                      item={item}
                      variant="library"
                      key={item.id}
                      onOpen={openDetail}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ReadOnlyShellFrame>
  );
}
