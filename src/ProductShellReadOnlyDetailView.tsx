import {
  createWriterLibraryDetailLayerPresentation,
  getWriterLibraryDetailContextLayer,
  WRITER_LIBRARY_DETAIL_LAYER_OPTIONS
} from "./productShellReadOnlyDetail";
import { getWriterLibraryOriginLabel } from "./productShellReadOnlyLibrary";
import type { WriterLibraryDetail } from "./writerLibraryDetailViewModel";
import type { WriterLibraryDetailLayer } from "./writerLibraryReadOnlySelection";

type ProductShellReadOnlyDetailViewProps = Readonly<{
  detail: WriterLibraryDetail;
  activeLayer: WriterLibraryDetailLayer;
  onSelectLayer: (layer: WriterLibraryDetailLayer) => void;
  onReturnToLibrary: () => void;
}>;

function formatReadOnlyDate(value: string) {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function ReadOnlyLayer({
  detail,
  layer,
  mode
}: Readonly<{
  detail: WriterLibraryDetail;
  layer: WriterLibraryDetailLayer;
  mode: "active" | "context";
}>) {
  const presentation = createWriterLibraryDetailLayerPresentation(detail, layer);
  const titleId = `read-only-${mode}-${layer}-title`;

  return (
    <section
      className="prototype-layer-content prototype-read-only-layer"
      aria-labelledby={titleId}
      data-layer={layer}
    >
      <div className="prototype-layer-heading">
        <p className="prototype-eyebrow">{presentation.eyebrow}</p>
        <h2 id={titleId}>{presentation.label}</h2>
      </div>

      {presentation.kind === "notes" ? (
        presentation.notes.length > 0 ? (
          <div className="prototype-note-list">
            {presentation.notes.map((note, index) => (
              <article className="prototype-note-preview" key={note.id}>
                <strong>Poznámka {index + 1}</strong>
                <p className="prototype-read-only-text">{note.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="prototype-empty-copy">{presentation.emptyText}</p>
        )
      ) : presentation.text.trim().length > 0 ? (
        <div className="prototype-read-only-text">{presentation.text}</div>
      ) : (
        <p className="prototype-empty-copy">{presentation.emptyText}</p>
      )}
    </section>
  );
}

export function ProductShellReadOnlyDetailView({
  detail,
  activeLayer,
  onSelectLayer,
  onReturnToLibrary
}: ProductShellReadOnlyDetailViewProps) {
  const contextLayer = getWriterLibraryDetailContextLayer(activeLayer);
  const originLabel = getWriterLibraryOriginLabel(detail.origin);

  return (
    <main
      className="prototype-page prototype-workshop-page prototype-read-only-detail"
      id="prototype-main"
    >
      <header className="prototype-work-titlebar prototype-read-only-titlebar">
        <button
          className="prototype-back-button"
          type="button"
          onClick={onReturnToLibrary}
        >
          ← Knižnica
        </button>
        <div className="prototype-read-only-title">
          <p className="prototype-eyebrow">Dielo iba na čítanie</p>
          <h1>{detail.title}</h1>
          <div className="prototype-read-only-title-labels">
            <span className="prototype-status-chip">Read-only</span>
            {originLabel ? (
              <span className="prototype-origin-chip">{originLabel}</span>
            ) : null}
          </div>
        </div>
        <p className="prototype-read-only-updated">
          Upravené {formatReadOnlyDate(detail.updatedAt)}
        </p>
      </header>

      <nav className="prototype-layer-tabs" aria-label="Vrstvy diela iba na čítanie">
        {WRITER_LIBRARY_DETAIL_LAYER_OPTIONS.map((layer) => (
          <button
            type="button"
            key={layer.id}
            aria-pressed={activeLayer === layer.id}
            onClick={() => onSelectLayer(layer.id)}
          >
            {layer.label}
          </button>
        ))}
      </nav>

      <div className="prototype-workspace prototype-read-only-workspace">
        <aside
          className="prototype-panel prototype-context-panel"
          aria-label="Kontextová vrstva iba na čítanie"
        >
          <span className="prototype-panel-role">Kontext</span>
          <ReadOnlyLayer detail={detail} layer={contextLayer} mode="context" />
        </aside>
        <section
          className="prototype-panel prototype-active-panel"
          aria-label="Aktívna vrstva iba na čítanie"
        >
          <span className="prototype-panel-role">Aktívna vrstva</span>
          <ReadOnlyLayer detail={detail} layer={activeLayer} mode="active" />
        </section>
      </div>
    </main>
  );
}
