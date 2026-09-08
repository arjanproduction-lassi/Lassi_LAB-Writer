import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";
import {
  createWriterLibraryDetailLayerPresentation,
  getWriterLibraryDetailContextLayer,
  WRITER_LIBRARY_DETAIL_LAYER_OPTIONS
} from "./productShellReadOnlyDetail";
import {
  createWriterLibraryPresentation,
  getWriterLibraryOriginLabel,
  getWriterLibraryProgressLabel
} from "./productShellReadOnlyLibrary";
import type {
  ProductShellWorkshopEditReadOnlyReason,
  ProductShellWorkshopEditRefreshBlockedReason,
  ProductShellWorkshopEditRuntime
} from "./productShellWorkshopEditRuntime";
import type {
  WriterPackageWorkshopEditingSession,
  WriterPackageWorkshopEditingSessionView
} from "./writerPackageWorkshopEditingSession";
import type { WriterLibraryDetail } from "./writerLibraryDetailViewModel";
import type { WriterLibraryReadOnlyResult } from "./writerLibraryReadOnlyProvider";
import {
  createWriterLibraryReadOnlySelectionState,
  resolveWriterLibraryReadOnlySelection,
  returnToWriterLibrary,
  selectWriterLibraryDetail,
  setWriterLibraryDetailLayer,
  type WriterLibraryDetailLayer,
  type WriterLibraryReadOnlySelectionState
} from "./writerLibraryReadOnlySelection";
import type { WriterLibraryItem } from "./writerLibraryViewModel";
import type { WriterPackageWorkshopAutosaveState } from "./writerPackageWorkshopAutosaveState";
import type {
  WriterPackageWorkshopBeforeUnloadGuard,
  WriterPackageWorkshopDebounceScheduler
} from "./writerPackageWorkshopBrowserAdapters";

type EditableWorkshopView = Extract<
  WriterPackageWorkshopEditingSessionView,
  { status: "editable" }
>;

type WorkshopEditorState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "opening"; packageId: string }>
  | Readonly<{
      status: "read-only";
      packageId: string;
      reason: ProductShellWorkshopEditReadOnlyReason;
    }>
  | Readonly<{
      status: "editable";
      packageId: string;
      expectedUpdatedAt: string;
      session: WriterPackageWorkshopEditingSession;
      view: EditableWorkshopView;
      refreshIssue?: ProductShellWorkshopEditRefreshBlockedReason;
    }>;

type ProductShellWorkshopEditViewProps = Readonly<{
  result: WriterLibraryReadOnlyResult;
  runtime: ProductShellWorkshopEditRuntime;
}>;

function formatEditDate(value: string) {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function readOnlyReasonLabel(reason: ProductShellWorkshopEditReadOnlyReason): string {
  switch (reason) {
    case "legacy-spark-adapted":
      return "Iba na čítanie: adaptovaná pôvodná Iskra";
    case "web-locks-unavailable":
      return "Iba na čítanie: zámok pre lokálny zápis nie je dostupný";
    case "web-lock-denied":
      return "Iba na čítanie: iné okno drží lokálny zámok";
    case "web-lock-request-failed":
      return "Iba na čítanie: lokálny zámok sa nepodarilo overiť";
    case "write-ownership-unavailable":
      return "Iba na čítanie: chýba aktívne oprávnenie na zápis";
    case "package-not-found":
      return "Iba na čítanie: Package už nie je v úložisku";
    case "package-deleted":
      return "Iba na čítanie: Package je označený ako zmazaný";
    case "stale-revision":
      return "Iba na čítanie: otvorená verzia je zastaraná";
    case "invalid-package":
      return "Iba na čítanie: Package nie je kompatibilný";
    default:
      return "Iba na čítanie: lokálnu editáciu sa nepodarilo bezpečne otvoriť";
  }
}

function autosaveStateLabel(state: WriterPackageWorkshopAutosaveState): string {
  switch (state.status) {
    case "dirty":
      return "Neuložené";
    case "saving":
      return "Ukladám...";
    case "conflict":
      return "Konflikt";
    case "failed-safe":
      return "Uloženie zlyhalo bezpečne";
    case "failed-unsafe":
      return "Stav úložiska je neistý";
    case "clean":
    case "saved":
      return "Uložené";
    case "read-only":
      return "Iba na čítanie";
  }
}

function refreshIssueLabel(reason: ProductShellWorkshopEditRefreshBlockedReason): string {
  switch (reason) {
    case "stale-revision":
      return "Uložené, ale lokálny náhľad sa neobnovil pre novšiu revíziu.";
    case "package-storage-missing":
    case "package-storage-read-failed":
      return "Uložené, ale lokálny náhľad sa nepodarilo znova načítať.";
    default:
      return "Uložené, ale lokálny náhľad zostal na predchádzajúcej revízii.";
  }
}

function LibraryCard({
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
          {progressLabel} · {formatEditDate(item.updatedAt)}
          {originLabel ? ` · ${originLabel}` : ""}
        </span>
        <span className="prototype-card-action">Otvoriť lokálnu Dielňu</span>
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
      <small>Upravené {formatEditDate(item.updatedAt)}</small>
      <span className="prototype-card-action">Otvoriť</span>
    </button>
  );
}

function WorkshopEditShellFrame({
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
        DEV lokálna Dielňa · posledný overený autosave prežije reload · Google sync je stále iba Sparks v1
      </div>
      <header className="prototype-app-header">
        <button
          className="prototype-brand"
          type="button"
          onClick={onReturnToLibrary}
        >
          <span>LassiLAB</span>
          <strong>Writer</strong>
        </button>
        <nav
          className="prototype-main-nav"
          aria-label="Hlavná navigácia DEV edit režimu"
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
          <button type="button" disabled title="Google sync v tomto kroku zostáva Sparks-only">
            Dáta · Sparks-only
          </button>
        </nav>
        <span className="prototype-sync-indicator">Lokálny DEV zápis</span>
      </header>
      {children}
    </div>
  );
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
  const titleId = `workshop-edit-${mode}-${layer}-title`;

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

function WorkshopTextEditor({
  detail,
  editorState,
  onChange
}: Readonly<{
  detail: WriterLibraryDetail;
  editorState: WorkshopEditorState;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}>) {
  if (editorState.status === "opening") {
    return (
      <section className="prototype-read-only-status" role="status">
        <h2>Otváram lokálnu Dielňu.</h2>
        <p>Údaje sa zatiaľ nemenia.</p>
      </section>
    );
  }

  if (editorState.status === "editable" && editorState.packageId === detail.id) {
    return (
      <section
        className="prototype-layer-content prototype-workshop-edit-layer"
        aria-labelledby="workshop-edit-active-workshop-title"
        data-layer="workshop"
      >
        <div className="prototype-layer-heading">
          <p className="prototype-eyebrow">Pracovný text</p>
          <h2 id="workshop-edit-active-workshop-title">Dielňa</h2>
        </div>
        <label className="prototype-field prototype-editor-field">
          <span>Rozvíjanie a tvarovanie textu</span>
          <textarea
            value={editorState.view.workshopText}
            placeholder="Tu vzniká pracovný text..."
            onChange={onChange}
          />
        </label>
      </section>
    );
  }

  return (
    <>
      <ReadOnlyLayer detail={detail} layer="workshop" mode="active" />
      {editorState.status === "read-only" && editorState.packageId === detail.id ? (
        <section className="prototype-read-only-status" role="status">
          <p>{readOnlyReasonLabel(editorState.reason)}</p>
        </section>
      ) : null}
    </>
  );
}

function EditableDetail({
  detail,
  activeLayer,
  editorState,
  onSelectLayer,
  onReturnToLibrary,
  onWorkshopTextChange,
  onSaveNow,
  onRetrySave,
  onResetDraft
}: Readonly<{
  detail: WriterLibraryDetail;
  activeLayer: WriterLibraryDetailLayer;
  editorState: WorkshopEditorState;
  onSelectLayer: (layer: WriterLibraryDetailLayer) => void;
  onReturnToLibrary: () => void;
  onWorkshopTextChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onSaveNow: () => void;
  onRetrySave: () => void;
  onResetDraft: () => void;
}>) {
  const contextLayer = getWriterLibraryDetailContextLayer(activeLayer);
  const originLabel = getWriterLibraryOriginLabel(detail.origin);
  const displayDetail =
    editorState.status === "editable" && editorState.packageId === detail.id
      ? Object.freeze({
          ...detail,
          workshopText: editorState.view.workshopText
        })
      : detail;
  const statusLabel =
    editorState.status === "editable" && editorState.packageId === detail.id
      ? autosaveStateLabel(editorState.view.autosaveState)
      : editorState.status === "opening" && editorState.packageId === detail.id
        ? "Otváram..."
        : editorState.status === "read-only" && editorState.packageId === detail.id
          ? readOnlyReasonLabel(editorState.reason)
          : "Iba na čítanie";
  const canSave =
    editorState.status === "editable" &&
    editorState.packageId === detail.id &&
    editorState.view.canSave;
  const canRetry =
    editorState.status === "editable" &&
    editorState.packageId === detail.id &&
    editorState.view.canRetry;

  function renderActiveLayer() {
    return activeLayer === "workshop" ? (
      <WorkshopTextEditor
        detail={detail}
        editorState={editorState}
        onChange={onWorkshopTextChange}
      />
    ) : (
      <ReadOnlyLayer detail={displayDetail} layer={activeLayer} mode="active" />
    );
  }

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
          <p className="prototype-eyebrow">DEV lokálna Dielňa</p>
          <h1>{detail.title}</h1>
          <div className="prototype-read-only-title-labels">
            <span className="prototype-status-chip">
              {detail.origin === "writer-package" ? "Package" : "Read-only"}
            </span>
            {originLabel ? (
              <span className="prototype-origin-chip">{originLabel}</span>
            ) : null}
          </div>
        </div>
        <div className="prototype-workshop-edit-status">
          <p className="prototype-save-state" role="status">
            {statusLabel}
          </p>
          <div className="prototype-workshop-edit-actions">
            <button
              className="prototype-secondary-button"
              type="button"
              disabled={!canSave}
              onClick={onSaveNow}
            >
              Uložiť teraz
            </button>
            {canRetry ? (
              <button
                className="prototype-secondary-button"
                type="button"
                onClick={onRetrySave}
              >
                Skúsiť znova
              </button>
            ) : null}
            <button
              className="prototype-secondary-button"
              type="button"
              disabled={editorState.status !== "editable"}
              onClick={onResetDraft}
            >
              Resetovať návrh
            </button>
          </div>
          <p className="prototype-read-only-updated">
            Upravené {formatEditDate(displayDetail.updatedAt)}
          </p>
        </div>
      </header>

      {editorState.status === "editable" && editorState.refreshIssue ? (
        <section className="prototype-read-only-status" role="status">
          <p>{refreshIssueLabel(editorState.refreshIssue)}</p>
        </section>
      ) : null}

      <nav className="prototype-layer-tabs" aria-label="Vrstvy diela v DEV edit režime">
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
          <ReadOnlyLayer detail={displayDetail} layer={contextLayer} mode="context" />
        </aside>
        <section
          className="prototype-panel prototype-active-panel"
          aria-label="Aktívna vrstva DEV Dielne"
        >
          <span className="prototype-panel-role">Aktívna vrstva</span>
          {renderActiveLayer()}
        </section>
      </div>
    </main>
  );
}

export function ProductShellWorkshopEditView({
  result,
  runtime
}: ProductShellWorkshopEditViewProps) {
  const [libraryResult, setLibraryResultState] = useState(result);
  const libraryResultRef = useRef(libraryResult);
  const [selectionState, setSelectionStateValue] = useState(
    createWriterLibraryReadOnlySelectionState
  );
  const selectionStateRef = useRef<WriterLibraryReadOnlySelectionState>(
    selectionState
  );
  const [editorStateValue, setEditorStateValue] = useState<WorkshopEditorState>(
    Object.freeze({ status: "idle" as const })
  );
  const editorStateRef = useRef<WorkshopEditorState>(editorStateValue);
  const schedulerRef = useRef<WriterPackageWorkshopDebounceScheduler | null>(null);
  const beforeUnloadGuardRef = useRef<WriterPackageWorkshopBeforeUnloadGuard | null>(
    null
  );
  const openRevisionRef = useRef(0);
  const presentation = createWriterLibraryPresentation(libraryResult);
  const resolvedSelection =
    libraryResult.status === "ready"
      ? resolveWriterLibraryReadOnlySelection(
          libraryResult.snapshot,
          selectionState
        )
      : undefined;

  useEffect(() => {
    return () => {
      const current = editorStateRef.current;
      if (current.status === "editable") {
        current.session.requestExit("unload", true);
      }
      clearEditingEffects();
    };
  }, []);

  function setLibraryResult(next: WriterLibraryReadOnlyResult) {
    libraryResultRef.current = next;
    setLibraryResultState(next);
  }

  function setSelectionState(next: WriterLibraryReadOnlySelectionState) {
    selectionStateRef.current = next;
    setSelectionStateValue(next);
  }

  function setEditorState(next: WorkshopEditorState) {
    editorStateRef.current = next;
    setEditorStateValue(next);
    beforeUnloadGuardRef.current?.sync();
  }

  function ensureBeforeUnloadGuard() {
    if (beforeUnloadGuardRef.current) {
      return;
    }

    beforeUnloadGuardRef.current = runtime.createBeforeUnloadGuard({
      shouldWarn() {
        const current = editorStateRef.current;
        return (
          current.status === "editable" &&
          runtime.shouldWarnBeforeUnload(current.view.autosaveState)
        );
      }
    });
  }

  function clearEditingEffects() {
    schedulerRef.current?.cancel();
    schedulerRef.current = null;
    beforeUnloadGuardRef.current?.dispose();
    beforeUnloadGuardRef.current = null;
  }

  function clearEditingSession() {
    clearEditingEffects();
    setEditorState(Object.freeze({ status: "idle" as const }));
  }

  function requestCurrentExit(
    action: "package-switch" | "layer-switch" | "library-return" | "reset"
  ): boolean {
    const current = editorStateRef.current;
    if (current.status !== "editable") {
      return true;
    }

    const firstExit = current.session.requestExit(action);
    if (firstExit.view.status === "editable") {
      setEditorState(Object.freeze({ ...current, view: firstExit.view }));
    }
    if (firstExit.decision.allowed) {
      if (action !== "layer-switch") {
        openRevisionRef.current += 1;
        clearEditingSession();
      }
      return true;
    }
    if (!firstExit.decision.requiresConfirmation) {
      return false;
    }
    if (!runtime.confirmUnsavedExit(action)) {
      return false;
    }

    const confirmedExit = current.session.requestExit(action, true);
    if (confirmedExit.view.status === "editable") {
      setEditorState(Object.freeze({ ...current, view: confirmedExit.view }));
    }
    if (!confirmedExit.decision.allowed) {
      return false;
    }
    if (action !== "layer-switch") {
      openRevisionRef.current += 1;
      clearEditingSession();
    }
    return true;
  }

  function refreshSelectedPackage(view: EditableWorkshopView) {
    if (view.refresh === "none" || view.autosaveState.status === "read-only") {
      return;
    }

    const currentEditor = editorStateRef.current;
    const currentLibrary = libraryResultRef.current;
    if (currentEditor.status !== "editable" || currentLibrary.status !== "ready") {
      return;
    }

    const refresh = runtime.refreshSelectedPackage({
      snapshot: currentLibrary.snapshot,
      packageId: currentEditor.packageId,
      expectedUpdatedAt: view.autosaveState.baseUpdatedAt
    });
    if (refresh.status === "blocked") {
      setEditorState(
        Object.freeze({
          ...currentEditor,
          refreshIssue: refresh.reason
        })
      );
      return;
    }

    setLibraryResult(
      Object.freeze({
        status: "ready" as const,
        snapshot: refresh.snapshot
      })
    );
    setEditorState(
      Object.freeze({
        ...currentEditor,
        view,
        expectedUpdatedAt: view.autosaveState.baseUpdatedAt,
        refreshIssue: undefined
      })
    );
  }

  function applySessionView(view: WriterPackageWorkshopEditingSessionView) {
    const current = editorStateRef.current;
    if (current.status !== "editable") {
      return;
    }
    if (view.status !== "editable") {
      clearEditingSession();
      return;
    }

    setEditorState(Object.freeze({ ...current, view, refreshIssue: undefined }));
    refreshSelectedPackage(view);
  }

  function requestAutosave() {
    const current = editorStateRef.current;
    if (current.status !== "editable") {
      return;
    }
    const result = current.session.requestAutosave();
    applySessionView(result.view);
  }

  function scheduleAutosave() {
    if (!schedulerRef.current) {
      schedulerRef.current = runtime.createAutosaveScheduler();
    }
    schedulerRef.current.schedule(requestAutosave);
  }

  function handleWorkshopTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const current = editorStateRef.current;
    if (current.status !== "editable") {
      return;
    }

    const result = current.session.editWorkshopText(event.target.value);
    applySessionView(result.view);
    if (result.accepted) {
      scheduleAutosave();
    }
  }

  function saveNow() {
    const current = editorStateRef.current;
    if (current.status !== "editable") {
      return;
    }
    schedulerRef.current?.cancel();
    const result = current.session.requestAutosave();
    applySessionView(result.view);
  }

  function retrySave() {
    const current = editorStateRef.current;
    if (current.status !== "editable") {
      return;
    }
    const result = current.session.retryAutosave();
    applySessionView(result.view);
  }

  function resetDraft() {
    const packageId = selectionStateRef.current.selectedPackageId;
    if (!packageId || !requestCurrentExit("reset")) {
      return;
    }
    void openDetail(packageId);
  }

  async function openDetail(packageId: string) {
    const currentEditor = editorStateRef.current;
    if (
      (currentEditor.status === "opening" ||
        currentEditor.status === "editable") &&
      currentEditor.packageId === packageId
    ) {
      return;
    }
    const currentLibrary = libraryResultRef.current;
    if (currentLibrary.status !== "ready") {
      return;
    }

    const detail = currentLibrary.snapshot.detailsById[packageId];
    if (!requestCurrentExit("package-switch")) {
      return;
    }

    setSelectionState(
      selectWriterLibraryDetail(selectionStateRef.current, packageId)
    );
    if (!detail) {
      setEditorState(Object.freeze({ status: "idle" as const }));
      return;
    }

    if (detail.origin !== "writer-package") {
      setEditorState(
        Object.freeze({
          status: "read-only" as const,
          packageId,
          reason: "legacy-spark-adapted" as const
        })
      );
      return;
    }

    const openRevision = openRevisionRef.current + 1;
    openRevisionRef.current = openRevision;
    setEditorState(Object.freeze({ status: "opening" as const, packageId }));

    const opened = await runtime.openSession({
      packageId,
      expectedUpdatedAt: detail.updatedAt
    });
    if (openRevisionRef.current !== openRevision) {
      if (opened.status === "editable") {
        opened.session.requestExit("reset", true);
      }
      return;
    }

    if (opened.status === "read-only") {
      setEditorState(
        Object.freeze({
          status: "read-only" as const,
          packageId,
          reason: opened.reason
        })
      );
      return;
    }

    const view = opened.session.getViewModel();
    if (view.status !== "editable") {
      setEditorState(
        Object.freeze({
          status: "read-only" as const,
          packageId,
          reason: view.status === "read-only" ? view.reason : "session-closed"
        })
      );
      return;
    }

    schedulerRef.current = runtime.createAutosaveScheduler();
    ensureBeforeUnloadGuard();
    setEditorState(
      Object.freeze({
        status: "editable" as const,
        packageId,
        expectedUpdatedAt: detail.updatedAt,
        session: opened.session,
        view
      })
    );
  }

  function selectLayer(layer: WriterLibraryDetailLayer) {
    if (selectionStateRef.current.activeLayer === layer) {
      return;
    }
    if (!requestCurrentExit("layer-switch")) {
      return;
    }
    setSelectionState(
      setWriterLibraryDetailLayer(selectionStateRef.current, layer)
    );
  }

  function returnToLibrary() {
    if (!requestCurrentExit("library-return")) {
      return;
    }
    openRevisionRef.current += 1;
    clearEditingEffects();
    setEditorState(Object.freeze({ status: "idle" as const }));
    setSelectionState(returnToWriterLibrary(selectionStateRef.current));
  }

  if (resolvedSelection?.status === "detail") {
    return (
      <WorkshopEditShellFrame
        currentView="detail"
        onReturnToLibrary={returnToLibrary}
      >
        <EditableDetail
          detail={resolvedSelection.detail}
          activeLayer={resolvedSelection.activeLayer}
          editorState={editorStateValue}
          onSelectLayer={selectLayer}
          onReturnToLibrary={returnToLibrary}
          onWorkshopTextChange={handleWorkshopTextChange}
          onSaveNow={saveNow}
          onRetrySave={retrySave}
          onResetDraft={resetDraft}
        />
      </WorkshopEditShellFrame>
    );
  }

  if (resolvedSelection?.status === "missing-detail") {
    return (
      <WorkshopEditShellFrame
        currentView="detail"
        onReturnToLibrary={returnToLibrary}
      >
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
      </WorkshopEditShellFrame>
    );
  }

  return (
    <WorkshopEditShellFrame
      currentView="library"
      onReturnToLibrary={returnToLibrary}
    >
      <main className="prototype-page prototype-library" id="prototype-main">
        <section className="prototype-library-hero" aria-labelledby="prototype-library-title">
          <div>
            <p className="prototype-eyebrow">DEV lokálna Dielňa</p>
            <h1 id="prototype-library-title">Rýchlejšie než zabudnutie.</h1>
            <p>Skutočný miestny katalóg je otvorený len pre pracovný text existujúcich Packages.</p>
          </div>
          <button className="prototype-primary-button" type="button" disabled>
            Nová iskra · mimo D4d
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
                <LibraryCard
                  item={presentation.continueItem}
                  variant="continue"
                  onOpen={(id) => void openDetail(id)}
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
                    <LibraryCard
                      item={item}
                      variant="library"
                      key={item.id}
                      onOpen={(id) => void openDetail(id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </WorkshopEditShellFrame>
  );
}
