# Writer Library Read-Only Detail Review

## Status And Scope

This document defines the proposed Phase B5 contract for opening one work from
the already loaded read-only Writer Library snapshot. The contract was
published at `e40eb9b5d7b8724818e9c975956013f50efc91b8`. B5.1 is published at
`bbdebc1779faeb355d785245780f9f11e0aa0b64` as a pure, deeply immutable
detail adapter. B5.2 is published at
`8ec9fe3431ee71aab78085cca07661dc25c31633` as the one-load immutable snapshot
and provider result. B5.3 is published at
`22973efd5c0b6a49f51d0a954073ffb603b31345` as the pure immutable selection,
layer, and resolution model. B5.4 is prepared locally as the isolated read-only
React detail UI over that model and the already-loaded snapshot. It is not
staged, committed, pushed, or deployed. B5.5 remains pending.

The only future runtime in scope is the isolated development entry:

```text
product-shell.html?mode=real-read-only
```

Fixture mode must remain unchanged. Production `index.html`, `src/main.tsx`,
`src/App.tsx`, storage, Writer DB, import/export, recovery, persistence, and
Google Drive remain outside B5.

## Actual Published B4 Boundary

The proposal below is based on the published B4 implementation at
`08b06848e712bac3499d397e50cee5ca4c62a439`.

### What B2 returns today

`loadWriterLibraryReadOnly(loader)` currently returns:

```ts
type WriterLibraryReadOnlyResult =
  | Readonly<{
      status: "ready";
      items: readonly WriterLibraryItem[];
    }>
  | Readonly<{
      status: "failed";
      reason: "catalog-load-failed";
    }>;
```

The provider invokes its injected loader inside one `try` block, passes the
returned catalog to the snapshot builder, and returns only the typed snapshot.
The public contract intentionally maps both a thrown loader error and a snapshot
construction or invariant-validation error to `failed/catalog-load-failed`.
It exposes neither the exception nor an internal distinction to the UI.
Because current lower-level loaders can also turn malformed or invalid stored
data into empty arrays, an empty ready result is not reliable evidence that the
underlying collections were healthy.

### What B4 preserves and discards

Each `WriterLibraryItem` preserves only presentation data needed by Knižnica:

- ID and normalized human title;
- deterministic excerpt;
- creation and update timestamps;
- human-facing origin category;
- progress, note count, and layer-presence flags;
- a defensive deleted flag used before visible items are returned.

B4 intentionally discards the full layer content after mapping:

- the complete `sparkText`;
- individual live note IDs, texts, and timestamps;
- `workshopText`;
- `finalText`;
- `packageVersion`, `legacy.stage`, and other storage-facing structure.

The item excerpt is not a detail snapshot. It selects only one compact value in
the order `finalText -> workshopText -> sparkText` and cannot reconstruct all
four layers.

### Whether a WriterPackage snapshot remains available

No. Inside B2, `catalog` is a local variable. Once
`buildWriterLibraryItems(catalog)` has returned, the ready result contains only
`WriterLibraryItem[]`. `assembleProductShellData()` wraps that provider result,
and React receives only `data.library`. No `WriterPackage` catalog snapshot is
available to the current real read-only component.

### Where the one catalog load happens

`src/productShellMain.tsx` resolves the mode before React render. For exact DEV
`real-read-only`, it passes `loadWriterPackageCatalog` as the injected
`catalogLoader` to `assembleProductShellData()`. The assembly selects B2, and B2
contains the single actual invocation:

```ts
const catalog = loader();
```

This whole operation happens before `createRoot(root).render(...)`. React
StrictMode therefore cannot repeat the storage read by re-rendering the
component. Fixture mode calls neither the provider nor the loader.

### How B4 reaches React

The current flow is:

```text
productShellMain
  -> resolveProductShellDataMode
  -> assembleProductShellData
  -> loadWriterLibraryReadOnly(injected loader)
  -> buildWriterLibraryItems(catalog)
  -> ProductShellData { mode: "real-read-only", library: result }
  -> ProductShellPrototype
  -> ProductShellReadOnlyLibraryView
  -> createWriterLibraryPresentation
```

The presentation selects the first already sorted live item for `Pokračovať`
and passes the same items to Knižnica. It does not load or retain detail data.

### What clicking a real B4 card does

Nothing. Both the `Pokračovať` card and Knižnica cards are disabled buttons.
They have no `onClick`, no selected ID, and no detail component. `Nová iskra`
is also disabled. B4 cannot open, edit, clone, or save a real package.

## Primary Safety Decision: One Load, One Snapshot

B5 must not read storage again when the author opens a work. The catalog must
still be loaded exactly once before React render. That same in-memory catalog
must produce both:

- the B1-ordered Knižnica items;
- immutable read-only detail view models keyed by the same visible IDs.

Opening a card performs only an in-memory lookup. It must not call:

- `getWriterPackageById()`;
- `loadWriterPackageCatalog()` a second time;
- `loadWriterPackages()` or `listSparks()`;
- direct `window.localStorage`;
- a React effect that reloads catalog data.

A full page reload is a new page lifetime and may perform the existing single
startup load again. Card click, layer selection, and return to Knižnica must not
reload anything.

## Snapshot Architecture Options

### Option A: extend the existing B2 provider result

Recommended flow:

```text
injected loader() exactly once
  -> catalog local variable
  -> pure buildWriterLibraryReadOnlySnapshot(catalog)
       -> existing buildWriterLibraryItems(catalog)
       -> new immutable detailsById from the same catalog
  -> one typed ready result
  -> React
```

Advantages:

- preserves B2 as the one owner of loader invocation and failure handling;
- makes one-load behavior explicit and testable;
- returns one coherent typed ready result;
- keeps raw storage-shaped objects out of React;
- avoids a second provider or a parallel error model.

Risk:

- the published B2 ready contract changes and all current B2/B4 consumers and
  checks must be updated together;
- the new snapshot builder must retain every existing B1 ordering, filtering,
  fallback, privacy, and immutability rule.

This is a focused contract evolution, not a new data source. It is the smallest
safe option because B2 already owns the exact boundary that B5 needs.

### Option B: add a new B5 assembly layer over one catalog

Possible flow:

```text
loader()
  -> catalog
  -> buildWriterLibraryItems(catalog)
  -> buildWriterLibraryDetails(catalog)
```

This can leave the B2 type untouched only by moving loader ownership above B2
or bypassing B2. That would duplicate or relocate the existing error handling
and create two ways to assemble a real Library. A second provider-like owner
would make it easier to call the loader twice or let B4 and B5 drift.

This option is acceptable only as a pure helper used *inside* the existing B2
provider. Once placed there, it is effectively the implementation detail of
Option A rather than a parallel B5 provider.

### Option C: pass raw WriterPackages to React

Rejected. `WriterPackage` contains mutable arrays and storage-facing fields.
Passing raw objects to React would:

- expose deleted notes, tombstone metadata, package version, and legacy metadata
  beyond what detail presentation needs;
- rely on TypeScript conventions instead of a runtime immutable boundary;
- make accidental mutation or editable cloning easier;
- couple the UI to storage format and future migrations;
- make privacy review harder because React receives more content and metadata
  than it displays.

B5 should pass a deliberately minimal, deeply frozen detail view model instead.

## Recommended Snapshot Contract

Recommended contract:

```ts
type WriterLibraryReadOnlySnapshot = Readonly<{
  items: readonly WriterLibraryItem[];
  detailsById: Readonly<Record<string, WriterLibraryDetail>>;
}>;

type WriterLibraryReadOnlyResult =
  | Readonly<{
      status: "ready";
      snapshot: WriterLibraryReadOnlySnapshot;
    }>
  | Readonly<{
      status: "failed";
      reason: "catalog-load-failed";
    }>;
```

`items` remains the authoritative ordered Knižnica sequence produced by B1.
`detailsById` is an immutable lookup index only; it does not define Library
order. A lookup must use an own-property check and must not fall through to an
object prototype.

The record is preferred over a details array because selection is by ID and the
Library already owns ordering. It avoids repeated linear searches without
introducing a mutable `Map`. The record, each detail, every note, and every note
array must be frozen at runtime; TypeScript `Readonly` alone is not sufficient.

The snapshot builder must assert through tests that every visible item ID has
exactly one detail and that no detail exists for a tombstone. It does not invent
new duplicate-ID resolution. The existing catalog owns same-ID collision rules
before B5 receives its input.

## Detail View Model

Recommended names adapted to current project types:

```ts
type WriterLibraryDetailNote = Readonly<{
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}>;

type WriterLibraryDetail = Readonly<{
  id: string;
  title: string;
  origin: WriterLibraryOrigin;
  createdAt: string;
  updatedAt: string;
  sparkText: string;
  notes: readonly WriterLibraryDetailNote[];
  workshopText: string;
  finalText: string;
}>;
```

Mapping rules:

- the adapter is pure and deterministic;
- it reads no browser global, storage, network, clock, or randomness;
- it never changes the input package or nested notes;
- it creates new deeply frozen detail and note objects;
- it preserves layer text exactly and never copies text between layers;
- it excludes notes with `deletedAt` without deleting or rewriting them;
- the live snapshot builder excludes top-level packages with `deletedAt`;
- title uses the same normalized `Bez názvu` fallback as B1, preferably through
  one shared pure helper rather than a second almost-equal rule;
- `origin` retains the existing presentation meaning, not storage provenance;
- `legacy.stage`, `packageVersion`, and `deletedAt` are not exposed to detail UI.

The detail does not need `excerpt` or `progress`. Those are Library summary
fields already available in `items`. Adding them to detail would duplicate
derived state without serving the read-only layer UI.

## Item And Detail Invariants

For every ready snapshot:

1. every live `WriterLibraryItem` has one detail with the same ID;
2. every detail corresponds to a visible Library item;
3. `items` keeps the exact B1 order and deterministic tie-breaking;
4. `detailsById` is used only for lookup, never for ordering;
5. item title, detail title, origin, and timestamps agree;
6. tombstoned top-level records enter neither structure;
7. deleted notes enter neither detail notes nor B1 note counts;
8. no B5 function migrates data or claims physical storage provenance.

The existing `loadWriterPackageCatalog()` resolves same-ID collisions: a
visible real WriterPackage wins over a visible Spark; a tombstoned package is
filtered before collision handling, so a live same-ID Spark may remain. B5
must preserve that result and must not resolve collisions again.

## Local Selection Model

Real detail selection is ephemeral presentation state:

```ts
selectedPackageId: string | null
```

Rules:

- initial value is `null`, which displays Knižnica;
- card click stores only the ID of the already visible item in React state;
- detail rendering performs an own-property lookup in `detailsById`; a missing
  entry enters the documented local error state without another load;
- the selected detail remains the frozen object from the startup snapshot;
- no editable copy is created;
- no localStorage, sessionStorage, cookie, query route, or new key is used;
- page reload may return to Knižnica and perform the normal single startup load;
- `← Knižnica` sets only `selectedPackageId` back to `null`;
- return, layer selection, and repeated opening never invoke the loader.

The active layer may be a second local presentation state with the four allowed
layer IDs. It has the same no-storage rule. Opening a different work should
start from a documented default layer, preferably `spark`, without changing the
detail object.

## Read-Only Dielňa UX

### Shared header

- action `← Knižnica`;
- normalized title of the selected work;
- clear `Read-only` or `Iba na čítanie` label;
- optional human-formatted `updatedAt`;
- quiet `Pôvodná Iskra` label when `origin === "legacy-spark"`;
- no `Uložené`, autosave, sync, or editable-status copy.

The four visible layer tabs are `Iskra`, `Poznámky`, `Dielňa`, and `Text OK`.
Layer values are rendered as semantic static text, paragraphs, articles, or
blockquotes. Avoid textarea and input controls. If a textarea is ever retained
for layout reasons, it must have real `readOnly`, no `onChange`, and an explicit
read-only label.

### PC

Preserve the approved workshop principle:

- one active read-only panel;
- one contextual read-only panel;
- the active layer owns visual emphasis;
- the context layer supports orientation but never duplicates content into the
  active layer;
- no edit, add-note, save, delete, migrate, import, export, or sync action.

The real read-only component may share neutral visual primitives and layer
labels with the fixture shell, but it must not reuse fixture mutation handlers
or fixture package state.

### Mobile

- show exactly one content panel at a time;
- keep the four-layer switch visible and keyboard/touch reachable;
- keep `← Knižnica` reachable;
- avoid global horizontal scrolling at approximately 360 px;
- use readable static text blocks rather than desktop-width editors;
- do not place the hidden context panel off-screen.

## Legacy Spark Detail

For a detail whose origin is `legacy-spark`:

- **Iskra:** show the current original Spark text exposed as `sparkText`;
- **Poznámky:** show no invented notes;
- **Dielňa:** show no invented working text;
- **Text OK:** show no invented final text;
- show the quiet human label `Pôvodná Iskra`.

Do not use `adapted Spark`, `legacy storage record`, `schema v1`, or
`migration candidate` in the UI. `origin` describes presentation history and
must not be presented as proven storage provenance.

## Empty Layer Copy

Use calm statements about the visible snapshot:

- Iskra: `Pôvodná iskra nemá text.`
- Poznámky: `K tomuto dielu zatiaľ nie sú poznámky.`
- Dielňa: `Pracovný text zatiaľ nie je uložený.`
- Text OK: `Finálny text zatiaľ nie je uložený.`

The copy does not claim corruption, migration, historical loss, or deletion.
It must be used from the actual selected layer value, never by copying fallback
text from a different layer.

## Missing And Inconsistent Detail States

If `selectedPackageId` is not an own key of `detailsById`, or the snapshot
breaks its item/detail invariant, render:

> Dielo sa v tomto načítaní nepodarilo otvoriť.

Action:

> Späť do Knižnice

The action clears local selection only. B5 must not retry the loader, query
storage by ID, alter any storage state, or expose a stack, raw ID, key name,
schema name, or record content. A missing detail is an in-memory presentation
failure, not proof that user data was deleted or damaged.

## Fixture And Real-Read-Only Isolation

`ProductShellPrototype` remains the top-level mode boundary:

- `fixture` continues to render the existing `FixtureProductShellPrototype`;
- fixture packages, local fixture editing, fixture Dielňa, and fixture state
  remain unchanged;
- fixture mode calls no real loader;
- `real-read-only` receives only the typed snapshot result;
- real mode renders real Knižnica and read-only detail, never fixture packages;
- `Nová iskra` remains disabled;
- `Dáta` remains a static mock;
- real components import no fixture mutation functions.

Recommended component boundary:

```text
ProductShellPrototype
  |- fixture -> FixtureProductShellPrototype (unchanged)
  `- real-read-only -> ProductShellReadOnlyLibraryExperience
       |- selectedPackageId === null -> ProductShellReadOnlyLibraryView
       `- selectedPackageId !== null -> ProductShellReadOnlyDetailView
```

The real experience owns only local selection and active-layer presentation
state. It receives no loader or storage API.

## Privacy Boundary

Real author content may exist only in the in-memory snapshot for the current
page lifetime. B5 must not:

- log titles, layer text, notes, or raw snapshot objects;
- include real content in test output, snapshots, screenshots, docs, fixtures,
  or committed artifacts;
- send content to Google Drive, analytics, an API, or any network;
- persist selection or detail data in any browser storage;
- expose content in thrown errors.

Automated and synthetic integration checks use only clearly artificial text.
Manual real-data review remains local and must not capture author content in
repository artifacts.

## Verification Plan

### Pure detail checks

1. real WriterPackage maps to the exact detail fields;
2. legacy-origin package has content only in `sparkText` when later layers are
   empty;
3. deleted notes are absent while live notes retain IDs, text, and timestamps;
4. spark, notes, workshop, and final content are never copied between layers;
5. blank title uses the same `Bez názvu` fallback as Knižnica;
6. input package and nested notes are unchanged;
7. detail, note objects, note array, index, and result array/object are frozen;
8. equivalent input produces an equivalent result;
9. each item and detail agrees on ID, title, origin, and timestamps;
10. a top-level tombstone enters neither items nor details;
11. the adapter uses no storage, browser global, time, randomness, or network.

### Provider and assembly checks

1. injected loader is still called exactly once for real-read-only startup;
2. items and details are built from the exact same catalog object/result;
3. ready snapshot satisfies the item/detail ID invariant;
4. click performs no loader call;
5. `← Knižnica` performs no loader call;
6. changing any of four layers performs no loader call;
7. fixture mode calls neither provider nor loader;
8. missing detail produces the typed/local error presentation without a load;
9. thrown loader or snapshot construction/invariant failure returns only
   `failed/catalog-load-failed` and logs no record content;
10. no raw WriterPackage is returned to React.

### UI and isolation checks

1. clicking a Library card opens the matching read-only detail;
2. `Pokračovať` opens the same snapshot detail for its item ID;
3. return displays the original in-memory Library without reloading;
4. all four layers switch and display only their own content;
5. PC shows read-only context plus active panel;
6. mobile shows one panel and has no global horizontal scroll;
7. legacy detail shows `Pôvodná Iskra` and truthful empty later layers;
8. every empty layer uses its human copy;
9. inconsistent selection shows the safe error and return action;
10. there is no editable input, change handler, save/update/delete/migrate API,
    Google Drive call, import/export call, or new storage key;
11. fixture behavior and local fixture editing remain unchanged;
12. production App, entry, and navigation do not reference B5.

### Synthetic integration check

Use a separate clean browser profile and artificial catalog containing a real
package, an adapted legacy Spark, a top-level tombstone, one live note, and one
deleted note. Record only relevant key count and an anonymous hash before load,
after card click, after layer changes, after return, and after reload. The hash
must stay unchanged throughout one page lifetime; no new key may appear. Remove
only the synthetic data and close the profile afterward.

## Proposed B5 Implementation Phases

### B5.1 - pure detail adapter and checks

- Published at `bbdebc1779faeb355d785245780f9f11e0aa0b64` in
  `src/writerLibraryDetailViewModel.ts` with artificial checks in
  `src/writerLibraryDetailViewModelChecks.ts`.
- Adds `WriterLibraryDetail` and `WriterLibraryDetailNote`.
- Maps a supplied package without storage or React.
- Reuses the published B1 item adapter for the shared title fallback and origin
  rules without changing the B1 contract.
- Filters deleted notes and top-level tombstones in the pure array builder.
- Preserves live input order without sorting or deduplication.
- Deeply freezes the detail, copied notes, notes array, and detail result array.
- Adds 24 pure checks and 3 static isolation checks, bringing the product-shell
  harness from 85/85 to 112/112.

This published slice does not create `detailsById`, change B2, or expose detail
data to React. Those boundaries remain unchanged inside B5.1.

### B5.2 - one immutable Library snapshot

- Published at `8ec9fe3431ee71aab78085cca07661dc25c31633` in
  `src/writerLibraryReadOnlySnapshot.ts` with artificial checks in
  `src/writerLibraryReadOnlySnapshotChecks.ts`.
- Evolves the B2 ready result to one `WriterLibraryReadOnlySnapshot` after the
  injected loader is called exactly once.
- Builds the existing B1 `items` and B5.1 details from that same catalog.
- Stores details as own properties of a frozen null-prototype object, including
  safe string IDs such as `__proto__`.
- Requires exactly one detail for every visible item and rejects invalid
  duplicate IDs rather than silently choosing one.
- Maps that invalid direct-catalog invariant failure through the existing public
  provider reason `catalog-load-failed`, shared intentionally with loader and
  other snapshot-construction failures.
- Preserves current failed/empty semantics and all B2/B4 isolation checks.
- Passes no loader or raw package objects onward; B4 reads only
  `snapshot.items` and still exposes no detail selection.
- Adds 28 snapshot checks and 3 isolation checks, bringing the complete
  product-shell harness from 112/112 to 143/143.

Keep B5.1 and B5.2 separate. B5.1 is a pure mapping contract; B5.2 changes the
published provider result and deserves an independent review.

### B5.3 - published selection model

- Published at `22973efd5c0b6a49f51d0a954073ffb603b31345` in
  `src/writerLibraryReadOnlySelection.ts` with artificial
  checks in `src/writerLibraryReadOnlySelectionChecks.ts`.
- Adds one frozen state with `selectedPackageId` and `activeLayer`, initially
  `null / spark`.
- Selecting an ID and returning to Knižnica both reset the active layer to
  `spark`; layer transitions preserve the selected ID.
- Resolves only against the supplied `snapshot.detailsById` through a safe
  own-property lookup and returns `library`, `detail`, or `missing-detail`.
- Reuses the existing frozen B5.1 detail without cloning or changing it.
- Adds 26 behavior checks and 5 isolation checks, bringing the complete
  product-shell harness from 143/143 to 174/174.
- Performs no loader/provider call, storage read/write, persistence, logging,
  network, React, UI, or CSS work. `selectedPackageId` is not persisted and
  is now consumed only as local React state by the uncommitted B5.4 UI.

### B5.4 - read-only detail UI

- Prepared locally in the isolated exact DEV `real-read-only` experience only.
- Enables the real Library cards and `Pokračovať` only to select an ID in local
  React state; every open starts on `Iskra` and resolves against the existing
  `snapshot.detailsById` without another loader call.
- Adds a separate presentational detail component with four pressed-state layer
  buttons, PC context plus active panels, and a mobile active panel only.
- Renders exact static text, live notes in existing order, truthful empty-layer
  copy, `Pôvodná Iskra`, and the safe `missing-detail` return state.
- Keeps `Nová iskra` disabled and adds no input, editor, save, autosave,
  persistence, storage API, production wiring, or Google Drive behavior.
- Adds 17 artificial detail-presentation checks and expands the static
  read-only isolation group from 8 to 17, bringing the harness from 174/174 to
  200/200.

### B5.5 - synthetic integration and final isolation review

- verify one loader call;
- verify click, return, and layer changes without storage change;
- verify fixture and production isolation;
- use only artificial content;
- add no feature beyond closing verification gaps.

## Explicitly Out Of Scope

B5 does not add:

- editing, editable clones, autosave, or draft recovery;
- `Nová iskra` or package creation;
- Spark-to-WriterPackage migration;
- delete, restore, archive, or Kôš;
- Google Drive, import/export, recovery, or persistence changes;
- per-note merge;
- search;
- a router dependency or production route;
- a new storage key;
- production product-shell wiring;
- AI/Kováča;
- publishing or social features.

## Decision Summary

Evolve the existing B2 ready result rather than create a second provider. One
injected `loadWriterPackageCatalog()` call before React render will produce one
deeply immutable snapshot: existing ordered B1 items plus a frozen detail index
for those same live IDs. React receives only presentation models. Opening,
returning, and switching layers are local in-memory actions that never read or
write storage. Published B5.1 supplies the pure immutable detail
and array builder, and published B5.2 supplies the one-call
`items + detailsById` provider snapshot. Published B5.3 supplies the pure
selection/layer/resolution model. Local B5.4 now connects that model to static
detail presentation over the same snapshot only; it remains uncommitted and
unpublished. The smallest next step is B5.5 synthetic integration and final
isolation review, without adding product behavior.
