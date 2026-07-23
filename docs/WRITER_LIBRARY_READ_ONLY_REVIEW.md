# Writer Library Read-Only Review

## Status And Scope

This document defines Phase B: a read-only Knižnica backed by the existing
WriterPackage catalog. B1 is published as a pure presentation adapter and B2
is published as a read-only provider with an injected loader. B3 is prepared
locally as a development-only fixture/real-read-only mode boundary, but it
does not connect B2 or load real data. None of these steps writes storage or
changes production App, import, export, recovery, persistence, or Google Drive.

Phase B may read existing local content and display it in the isolated
`product-shell.html` experience. It may not create, edit, migrate, delete,
restore, autosave, or otherwise persist any Spark or WriterPackage.

## Evidence And Existing Contracts

The proposal is grounded in the current implementations in:

- `src/types.ts`
- `src/writerPackage.ts`
- `src/writerPackageStorage.ts`
- `src/storage.ts`
- `src/writerDb.ts`
- `src/ProductShellPrototype.tsx`
- `src/productShellPrototypeModel.ts`

### `loadWriterPackages()`

Current signature:

```ts
loadWriterPackages(): WriterPackage[]
```

It reads `lassilab-writer:v0.1:packages` from `window.localStorage`, parses an
array, and keeps only records accepted by `isWriterPackage`. Invalid records
are ignored. Missing storage, malformed JSON, or a non-array value returns an
empty array. The function does not filter package tombstones and preserves the
stored order.

This is not the recommended Library source because it omits legacy Sparks.

### `loadWriterPackageCatalog()`

Current signature:

```ts
loadWriterPackageCatalog(): WriterPackage[]
```

It is the recommended Phase B source. It:

1. loads real WriterPackages;
2. removes WriterPackages with `deletedAt`;
3. loads visible legacy Sparks through `listSparks()`;
4. adapts a Spark only when the visible package map does not already contain
   the same `id`;
5. sorts the combined catalog by `updatedAt`, newest first.

Therefore a visible real WriterPackage wins over an adapted visible Spark with
the same ID. One exact edge case must remain explicit: a tombstoned
WriterPackage is removed before collision handling, so a still-live Spark with
the same ID can appear as an adapted catalog item. Phase B must not change or
repair that state.

The catalog reads local storage indirectly but performs no writes. It already
filters Spark tombstones because `listSparks()` returns visible Sparks only.

### `getWriterPackageById(id)`

Current signature:

```ts
getWriterPackageById(id: string): WriterPackage | undefined
```

It searches only `loadWriterPackages()`. It can return a tombstoned real
WriterPackage and cannot find a legacy Spark that exists only as an adapted
catalog item. Phase B must not use this helper as the universal open-detail
path. Read-only detail should open the selected item from the catalog snapshot,
or reload the complete catalog and find the ID there.

### `adaptSparkToWriterPackage(spark)`

Current signature:

```ts
adaptSparkToWriterPackage(spark: Spark): WriterPackage
```

It is pure and deterministic for one Spark. It:

- preserves `id`, `createdAt`, `updatedAt`, and optional `deletedAt`;
- copies the Spark's current `text` to `sparkText`;
- creates empty `notes`, `workshopText`, and `finalText`;
- sets `packageVersion: 1`;
- stores the historical origin under `legacy.source: "spark"`;
- preserves optional Spark `stage` only as `legacy.stage`;
- derives a temporary title from the first non-empty normalized text line;
- truncates that title to 72 characters with `...`;
- falls back to `Bez názvu` for empty text;
- does not use or persist the optional Spark `title`.

The adapter cannot reconstruct an original historical Spark when the legacy
record was edited. It presents the current Spark text as read-only `sparkText`
without claiming that later package layers ever existed.

### Actual `WriterPackage` shape

The current type contains:

```ts
interface WriterPackage {
  id: string;
  title: string;
  sparkText: string;
  notes: WriterPackageNote[];
  workshopText: string;
  finalText: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  packageVersion: 1;
  legacy?: {
    source: "spark";
    stage?: "spark" | "notes" | "workshop" | "final";
  };
}
```

`legacy.source` records historical origin. It is not a guaranteed statement
about which storage collection supplied the current catalog object, because a
stored real WriterPackage may legally retain legacy metadata. Phase B should
not expose storage provenance or the words “adapted legacy Spark” in the UI.

## Catalog Source Decision

Use `loadWriterPackageCatalog()` for Phase B.

Compared with `loadWriterPackages()`, it is the only existing API that gives
one Library both visible real WriterPackages and visible legacy Sparks while
preserving the current same-ID preference. Omitting legacy Sparks would make
existing work disappear from the proposed Library and would undermine trust.

The trade-off is accepted: a compatibility view is not a migration. The UI may
show the quiet human label `Pôvodná Iskra` when `legacy.source === "spark"`,
but it must not imply that notes, workshop text, or final text historically
existed or that the Spark was converted in storage.

## Phase B Read-Only Boundary

Allowed behavior:

- call one injected catalog loader;
- map the returned WriterPackages into a pure presentation model;
- exclude tombstones defensively;
- sort visible items by `updatedAt` descending;
- display the Library and one selected package read-only;
- keep the existing fixture mode available.

Forbidden behavior:

- `saveWriterPackages`, `upsertWriterPackage`, or any Spark save/delete API;
- direct `window.localStorage` access from the product shell;
- Spark-to-WriterPackage migration or cleanup;
- creating a new package or enabling `Nová iskra`;
- editing any layer or keeping a fake editable React copy;
- autosave, draft recovery, sync, import/export, recovery, or persistence;
- new storage keys, production navigation, or a production route.

## Pure Library View Model

Recommended presentation contract:

```ts
type WriterLibraryOrigin = "writer-package" | "legacy-spark";

type WriterLibraryProgress =
  | "empty"
  | "spark"
  | "notes"
  | "workshop"
  | "final";

type WriterLibraryItem = Readonly<{
  id: string;
  title: string;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
  origin: WriterLibraryOrigin;
  progress: WriterLibraryProgress;
  noteCount: number;
  hasNotes: boolean;
  hasWorkshopText: boolean;
  hasFinalText: boolean;
  deleted: boolean;
}>;
```

`origin` is presentation history, derived from `legacy.source`, not physical
storage provenance. Do not name it `storageSource`.

Implemented B1 functions:

```ts
function toWriterLibraryItem(
  writerPackage: Readonly<WriterPackage>
): WriterLibraryItem;

function buildWriterLibraryItems(
  catalog: readonly Readonly<WriterPackage>[]
): readonly WriterLibraryItem[];
```

They must not read storage, time, randomness, browser globals, or mutate their
inputs. `buildWriterLibraryItems` filters `deleted === true`, sorts newest
first, and uses a deterministic ID tie-break when timestamps are equal. B1
returns newly allocated frozen items and a frozen result array containing only
presentation scalars.

### Mapping rules

Title:

- collapse whitespace and trim `title`;
- use the normalized title when non-empty;
- otherwise use `Bez názvu`;
- never derive a second title in the view adapter because the legacy adapter
  already owns its deterministic title rule.

Excerpt:

- choose the first non-empty trimmed value in this order:
  `finalText`, `workshopText`, `sparkText`;
- collapse whitespace before truncation;
- keep the prototype's existing 118-character default and append an ellipsis
  only when needed;
- use `Zatiaľ bez textu.` when every layer is empty;
- never include notes automatically, because note text is separate material
  and may expose more private content than a Library card needs.

Progress:

- non-empty `finalText` -> `final`;
- otherwise non-empty `workshopText` -> `workshop`;
- otherwise at least one non-deleted, non-empty note -> `notes`;
- otherwise non-empty `sparkText` -> `spark`;
- otherwise -> `empty`.

Notes:

- `noteCount` counts only notes without `deletedAt`;
- `hasNotes` is `noteCount > 0`;
- deleted notes are absent from read-only detail and progress.

Dates:

- keep the validated `createdAt` and `updatedAt` strings in the view model;
- format human-readable dates only in the UI boundary;
- do not call the current clock or rewrite timestamps.
- assume normal inputs come from the validated catalog;
- if an unexpected invalid `updatedAt` reaches B1, sort valid dates first and
  place invalid dates deterministically by ID without repairing the input.

Legacy item:

- `origin` is `legacy-spark` when `legacy?.source === "spark"`;
- later-layer indicators remain false for a freshly adapted Spark;
- optional `legacy.stage` is not progress and is never shown as a Library
  category.

Tombstone:

- `deleted` is `Boolean(deletedAt)`;
- normal selectors remove it before `Pokračovať` or `Knižnica` is built;
- no Phase B action deletes, restores, or rewrites the record.

## Knižnica UX

### Pokračovať

For the smallest Phase B, show exactly the first visible item from the
already-sorted Library. This retains the approved prototype hierarchy without
adding a second ranking algorithm. It shows title, excerpt, last update, and a
quiet content-derived progress label. Tombstones never qualify.

The data contract can later allow up to three items, but Phase B should not add
recency heuristics, “last opened” persistence, or another storage key.

### Knižnica

Show every visible item, ordered by `updatedAt` descending. Each item includes:

- recognizable title;
- restrained excerpt;
- human-readable last update;
- one quiet progress hint;
- `Pôvodná Iskra` only when historical origin helps avoid confusion;
- action `Otvoriť`.

Do not show raw IDs, package/schema versions, storage names, `legacy.stage`,
tombstone counts, or database terminology.

### Empty state

Use:

> Zatiaľ tu nie je žiadne dielo.

Phase B cannot create a package. `Nová iskra` must be disabled and labelled
`Pripravujeme`, or omitted from real-data mode. It must not remain visually
active if clicking it cannot safely save.

## Read-Only Dielňa

Clicking a Library item may open a read-only detail from the catalog snapshot.
The selected package ID remains the context across all four layers.

For a real WriterPackage:

- **Iskra:** display `sparkText`;
- **Poznámky:** display only non-deleted notes;
- **Dielňa:** display `workshopText`;
- **Text OK:** display `finalText`.

For an item with legacy Spark origin:

- **Iskra:** display the current legacy Spark text;
- **Poznámky:** show no invented notes;
- **Dielňa:** show no invented workshop text;
- **Text OK:** show no invented final text;
- show the quiet context `Pôvodná Iskra · iba na čítanie` when useful.

Use static text blocks or genuinely `readOnly` controls. Do not attach
`onChange`, create editable local clones, show autosave, or claim `Uložené`.
The header should say `Iba na čítanie`.

The universal open path must not call `getWriterPackageById`, because that API
cannot return adapted legacy items and can return tombstones. Use the selected
visible catalog snapshot. If a fresh reload is required, reload the complete
catalog and find the ID there.

### Empty layer copy

- Notes, real package: `Zatiaľ bez poznámok.`
- Workshop, real package: `Zatiaľ bez pracovného textu.`
- Final, real package: `Zatiaľ bez Textu OK.`
- Notes, legacy origin: `Táto pôvodná Iskra nemá samostatné poznámky.`
- Workshop, legacy origin: `Táto pôvodná Iskra nemá samostatný pracovný text.`
- Final, legacy origin: `Táto pôvodná Iskra nemá samostatný Text OK.`

These sentences describe the visible record. They do not claim that a layer
historically existed and was later lost.

## Tombstones And Deleted Content

- Tombstoned Sparks and WriterPackages never appear in normal Library results.
- Tombstoned notes never appear in read-only detail or note counts.
- Phase B adds no Kôš, restore, permanent delete, or cleanup action.
- Tombstones remain untouched in their current storage and data flows.
- Counts and diagnostics belong in Dáta, not Knižnica.

The current catalog already filters top-level tombstones. The pure adapter
filters defensively as a second read-only guard, not as a mutation.

## Empty And Error States

Human-facing copy:

- empty Library: `Zatiaľ tu nie je žiadne dielo.`
- unexpected loader failure: `Knižnicu sa nepodarilo načítať. Nič sme nezmenili.`
- known damaged local collection: `Lokálne dáta sa nepodarilo bezpečne prečítať. Nič sme nezmenili. Podrobnosti nájdeš v Dáta.`
- missing selected item: `Dielo sa už v Knižnici nenachádza.`
- empty Notes, Workshop, and Final: use the layer-specific copy above.

Do not show stack traces, keys, schema names, parser codes, or malformed user
content.

Current limitation: `loadWriterPackages()` and the Spark loader convert
malformed JSON into empty arrays and ignore invalid records. Therefore the
existing catalog cannot reliably distinguish a genuinely empty Library from a
damaged collection. Phase B must not invent a corruption warning from an empty
array. The dedicated damaged-data copy is reserved for a future read-only
diagnostic provider that can truthfully return that state.

## Safe Fixture / Real Read-Only Mode

Keep `product-shell.html` as the only entry. The product shell receives a
provider instead of importing production storage directly:

```ts
type WriterPackageCatalogLoader = () => readonly WriterPackage[];

type WriterLibraryReadOnlyResult =
  | { status: "ready"; items: readonly WriterLibraryItem[] }
  | { status: "failed"; reason: "catalog-load-failed" };

function loadWriterLibraryReadOnly(
  loader: WriterPackageCatalogLoader
): WriterLibraryReadOnlyResult;
```

Recommended providers:

- fixture provider returns the existing artificial package objects;
- local read-only provider receives `loadWriterPackageCatalog` by dependency
  injection, calls it once, and passes its result to the B1 adapter;
- neither provider exposes save, upsert, delete, sync, import, or recovery.

B2 catches a thrown loader error and returns only `catalog-load-failed`; it
does not expose a stack or record content. An empty loader result is a
successful empty Library. Because the current catalog loader may also collapse
damaged collections to an empty array, B2 cannot reinterpret that empty result
as a reliable corruption diagnosis.

Safe mode selection:

- fixture remains the default;
- the exact URL query `?mode=real-read-only` selects the development-only
  read-only placeholder;
- honor real-data mode only when `import.meta.env.DEV` is true;
- do not store the choice in localStorage or create another key;
- fail closed to fixture mode for an absent, unknown, or production-mode value;
- keep `index.html`, `src/main.tsx`, and `src/App.tsx` unaware of the shell;
- keep the shell absent from production navigation and the default production
  build.

Real mode must display `Lokálne dáta · iba na čítanie · nič sa neukladá` and
must never log package titles, excerpts, layer text, or notes.

## Privacy And Verification

- Automated checks use only artificial records.
- Never snapshot, log, print, export, or commit real author text.
- Failure messages contain no record content.
- Test reports may contain fixture IDs and counts, but not real payloads.
- Manual real-catalog checks stay local and create no screenshots or exports in
  the repository.
- Console logging of catalog values is forbidden even in development mode.

## Test Plan

### Pure adapter checks

B1 now covers the applicable mapping and visible-list rules with artificial
data in `writerLibraryViewModelChecks.ts`; the production catalog is never
loaded by the checks. Provider and read-only detail integration remain future
checks.

1. real WriterPackage maps to the expected Library item;
2. legacy-origin package maps to a read-only `Pôvodná Iskra` item;
3. an already resolved real same-ID winner maps to one package item;
4. top-level tombstone is excluded from visible results;
5. deleted notes are excluded from counts and detail;
6. items sort by `updatedAt` descending with deterministic ties;
7. blank title falls back to `Bez názvu`;
8. the 118-character excerpt rule is deterministic and whitespace-safe;
9. final/workshop/notes/spark/empty progress precedence is correct;
10. empty content uses safe fallback copy;
11. inputs and nested notes are not mutated;
12. adapter touches no storage, browser global, time, or randomness.

### Integration checks

B2 covers the injected-loader, ready/failed, one-call, immutability,
no-logging, and provider-isolation rules with artificial loaders. Local B3
covers the fail-closed mode resolver and an isolated product-shell placeholder;
provider loading and real-data rendering remain future checks.

1. fixture mode remains the default and unchanged;
2. unknown or production-mode query cannot activate local real data;
3. real mode calls only the injected catalog loader;
4. loader is called once per explicit load or reload;
5. artificial real Package plus Spark with the same ID yields the visible real
   Package, matching the existing catalog owner of that rule;
6. a tombstoned Package plus live same-ID Spark preserves the documented
   current catalog edge case without mutation;
7. no save, upsert, delete, Spark mutation, or draft API is imported;
8. no Google Drive, import/export, recovery, or persistence API is imported;
9. no new storage key exists;
10. `Nová iskra` is disabled or absent in real mode;
11. selected detail is read-only and contains no change/autosave handler;
12. product shell remains absent from production entries and navigation;
13. tests use artificial content and do not print package payloads.

The same-ID winner belongs to the catalog/provider integration boundary, not
the presentation adapter, because `loadWriterPackageCatalog()` resolves the
collision before the view model receives its input.

## Implementation Phases

### B1 — Pure catalog-to-view-model adapter

Published at `4158a9ebc491886b44ae171e5d1130b504f9fe06`. It
contains only the pure types, mapping, visible filtering, sorting, progress,
title, and excerpt rules. It does not call `loadWriterPackageCatalog()` and has
no loader, React, storage, browser, current-time, network, or CSS dependency.

### B2 — Read-only provider with injected loader

Published at `207801b17665a7669ffe52adb4887b5ed262b6b9`. The provider receives a
synchronous catalog loader as a dependency, calls it exactly once, and passes
the returned catalog directly to `buildWriterLibraryItems()`. It returns only
typed `ready` or `failed/catalog-load-failed` results, logs nothing, exposes no
write operation, and has no React, direct storage, browser, network, sync, or
Google Drive dependency. Checks use injected artificial loaders only. B2 is
not connected to `ProductShellPrototype`.

### B3 — Development-only mode selection

Prepared locally. Fixture mode remains the default. The pure resolver accepts
injected development state and query text; the isolated shell entry alone
reads `import.meta.env.DEV` and `window.location.search`. The exact,
non-persistent `?mode=real-read-only` query selects a truthful no-data
placeholder only in development. Production, absent, blank, unknown, and
case-mismatched values fail closed to fixtures. B3 does not call the B2
provider, the catalog loader, storage, or any real-data API.

### B4 — Real read-only Knižnica

Render the provider result through the pure view model. Disable or remove
`Nová iskra`, display human empty/error states, show at most one `Pokračovať`
item initially, and expose no edit or save behavior.

### B5 — Read-only package detail

Open a selected visible catalog snapshot in Dielňa. Render all four layers and
non-deleted notes read-only, with truthful legacy and empty-layer copy. Do not
use `getWriterPackageById` as the universal path.

B3 is kept separate as a reviewed fail-closed boundary before any catalog is
loaded. B4 may connect the published provider only after B3 passes its own
checks and manual mode-selection review. Keep B5 separate because opening real
author content adds a larger privacy and interaction surface.

## Explicitly Out Of Scope

- runtime or CSS work in this documentation phase;
- production `App.tsx` or navigation changes;
- WriterPackage or Spark writes;
- creation through `Nová iskra`;
- layer editing, local editable copies, autosave, or drafts;
- migration, deletion, restore, archive, or Kôš;
- Google Drive or Writer DB import/export changes;
- recovery, persistence, rollback, or per-note merge;
- new data formats, dependencies, routes, or storage keys;
- screenshots, snapshots, logs, or fixtures containing real author text;
- commit, push, deploy, or publication of this local B3 implementation slice.

## Decision Summary

Phase B should read `loadWriterPackageCatalog()` through one injected provider,
map its visible package-shaped results through the published pure B1 adapter,
and keep the isolated shell read-only. Published B2 provides that injected
boundary but is not connected to the shell. Local B3 adds only the explicit,
non-persistent, development-only mode selector and a truthful no-data state;
fixture mode remains the default. The smallest next implementation is B4:
connect the B2 provider only inside the isolated real-read-only shell mode and
render a read-only Knižnica.
