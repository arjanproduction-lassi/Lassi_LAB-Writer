import type { WriterLibraryReadOnlyResult } from "./writerLibraryReadOnlyProvider";
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
  variant
}: Readonly<{
  item: WriterLibraryItem;
  variant: "continue" | "library";
}>) {
  const progressLabel = getWriterLibraryProgressLabel(item.progress);
  const originLabel = getWriterLibraryOriginLabel(item.origin);

  if (variant === "continue") {
    return (
      <button
        className="prototype-continue-card prototype-read-only-card"
        type="button"
        disabled
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
          Read-only otvorenie príde v ďalšom kroku
        </span>
      </button>
    );
  }

  return (
    <button
      className="prototype-package-card prototype-read-only-card"
      type="button"
      disabled
    >
      <span className="prototype-read-only-card-labels">
        <span className="prototype-progress">{progressLabel}</span>
        {originLabel ? <span className="prototype-origin-chip">{originLabel}</span> : null}
      </span>
      <strong>{item.title}</strong>
      <span>{item.excerpt}</span>
      {item.hasNotes ? <small>Poznámky: {item.noteCount}</small> : null}
      <small>Upravené {formatReadOnlyDate(item.updatedAt)}</small>
      <span className="prototype-card-action">Read-only otvorenie príde v B5</span>
    </button>
  );
}

export function ProductShellReadOnlyLibraryView({
  result
}: ProductShellReadOnlyLibraryProps) {
  const presentation = createWriterLibraryPresentation(result);

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
        <nav className="prototype-main-nav" aria-label="Hlavná navigácia read-only režimu">
          <button type="button" aria-current="page" disabled>
            Knižnica
          </button>
          <button type="button" disabled title="Read-only detail príde v B5">
            Dielňa
          </button>
          <button type="button" disabled title="Statická maketa bez živých akcií">
            Dáta · maketa
          </button>
        </nav>
        <span className="prototype-sync-indicator">Iba na čítanie</span>
      </header>

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
                <ReadOnlyLibraryCard item={presentation.continueItem} variant="continue" />
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
                    <ReadOnlyLibraryCard item={item} variant="library" key={item.id} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
