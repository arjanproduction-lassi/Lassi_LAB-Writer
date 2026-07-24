# Writer Product Architecture Review

## Status And Scope

This document defines the product and information architecture for the next
phase of LassiLAB Writer. Phase A now has an isolated fixture-only shell for
evaluating that direction; it is not the production Writer runtime or a final
visual design.

Current published baseline:

- commit `aa2c631022269e63cf3615d8cc4dae9d07b264c3`
- one coordinated Writer DB v1/v2 import path
- Google Drive sync remains v1 and Sparks-only
- Writer DB harness: 284/284 at the published baseline

This review changes no runtime code, data format, storage key, import behavior,
recovery behavior, export behavior, or sync behavior.

## Local Phase A Prototype

A separate static product shell exists at `/product-shell.html`. Its source is
kept outside the production `index.html`, `src/main.tsx`, and `src/App.tsx`
entry path, so the production build and navigation do not expose it.

The shell uses only presentation fixtures and local React state. It does not
read or write production storage, load real Sparks or WriterPackages, connect
Google Drive, or call import/export/recovery code. Reloading may discard every
prototype edit.

Its purpose is to evaluate the information architecture and working feeling of
Knižnica, Dielňa, and Dáta. Manual PC and mobile review approved that structure
as the baseline for further development. It is not a final visual design, and
this approval does not authorize connection to real data.

## Evidence And Review Limits

The inventory is grounded in:

- the complete current `src/App.tsx` and `src/index.css`
- current Spark, WriterPackage, local storage, import, and Google Drive modules
- the current product, UX, data-model, implementation, task, and worklog docs
- the live production DOM at `https://lassi-lab-writer.vercel.app`

The live production flow was inspected as four structural steps: capture,
recent Sparks, Spark editing, and Data/Google sync. Browser screenshot capture
failed in the audit environment, so this document does not make pixel-level,
contrast-compliance, or complete accessibility claims. Keyboard, screen-reader,
zoom, and real-device behavior remain implementation verification tasks.

## Product Verdict

The current app is technically honest and safe, but its visible structure still
reflects the order in which features were built:

1. capture a Spark
2. filter Spark cards by stage
3. edit one Spark text field
4. administer local data, import/export, and Google sync

That order makes a useful engineering prototype, but not yet an author's
workshop. The main screen treats creation, status management, data transport,
and diagnostics as peer sections in one long form. A WriterPackage already
exists as the correct target model, but the product surface still speaks mainly
in legacy Spark records and stage filters.

The next product must be:

> An author's workshop for one creative work, from the first Spark to the
> accepted text.

Its primary mental model is not a card moving between four states. It is one
creative package growing through four connected layers:

```text
[Iskra] [Poznámky] [Dielňa] [Text OK]
```

The package keeps one stable ID. The original Spark is the birth certificate of
the work and remains available as context. Notes, workshop text, and final text
do not overwrite it.

## Five Largest Problems In The Current Experience

### 1. The screen has no product-level places

Capture, the Spark list, editing, database transfer, import diagnostics, and
Google sync all live in one vertical page. The author cannot form a simple
map such as “my works live in the Library; I write in the Workshop; technical
operations live under Data.”

### 2. The stage model looks like the creative workflow

The filters `Iskra`, `Poznámky`, `Dielňa`, and `Text OK` suggest that a record is
moved between buckets. The selector labelled `Zošit` reinforces that idea.
This conflicts with the WriterPackage truth: one work contains all four layers
at once.

### 3. The editor edits a record, not a work

The current editor is a single textarea for the current Spark text. It cannot
show the protected original Spark beside notes or the working draft, and it
does not express which layer of one work the author is shaping.

### 4. Technical tools occupy the main creative route

Manual v1 export, v2 test export, coordinated import, recovery messages, and
Google sync appear directly below the creative list. Safe technical detail is
valuable, but its permanent presence makes the product feel like a database
console and gives maintenance controls the same visual importance as writing.

### 5. Desktop space is deliberately unused

The current shell is capped at a narrow single column. That is appropriate for
the first mobile capture loop, but it prevents the defining desktop benefit:
seeing the active layer and its neighbouring context together.

## Current Flow Inventory

### Structural steps and health

1. **Capture a new Spark — healthy foundation, incomplete destination.**
   The primary action is obvious and the recovery draft protects early text.
   Saving still creates a legacy Spark rather than opening a package workflow.
2. **Browse recent Sparks — usable, structurally misleading.**
   Recent work is visible and cards are easy to reopen, but stage filters make
   four labels look like four destinations instead of four layers of one work.
3. **Edit a saved Spark — safe, too shallow for the target product.**
   ID and timestamps are preserved, cancellation is clear, and deletion is
   deliberate. The single text field cannot represent package growth.
4. **Manage Data and Google sync — technically strong, wrongly placed.**
   Import states and sync safety copy are explicit. Their permanent location on
   the main writing page overwhelms the creative hierarchy.

### Element-by-element decision

| Current element | Decision | Target treatment |
| --- | --- | --- |
| `⚡ Nová iskra` | **ZACHOVAŤ + PREMENOVAŤ KONTEXT** | Keep as the fastest entry. It becomes creation of a new creative package, while the visible action can remain `Nová iskra`. |
| New-Spark recovery draft | **ZACHOVAŤ** | Keep the quiet `Obnoviť / Zahodiť` protection. Present it on Home/Library, not as a database event. |
| `Posledné iskry` | **ZLÚČIŤ + PREMENOVAŤ** | Becomes the Library's recent and in-progress WriterPackages. Legacy Sparks appear through the existing adapter. |
| Stage filter row | **NESKÔR ODSTRÁNIŤ Z HLAVNEJ NAVIGÁCIE** | Keep `legacy.stage` as metadata during transition; do not use it as the primary browse or writing model. |
| Stage badge on each card | **SKRYŤ / NAHRADIŤ** | Replace with calm package progress such as “má poznámky” or “Text OK”, derived from real layer content only when useful. |
| `Zošit` selector | **NESKÔR ODSTRÁNIŤ** | Do not move a work between layers. The Workshop switcher chooses which layer is visible; it does not mutate a stage. |
| Spark card `Upraviť` | **PREMENOVAŤ** | Prefer `Otvoriť` because the destination is the complete work, not a record-edit form. |
| Single Spark textarea | **PRESUNÚŤ A ROZDELIŤ PODĽA VRSTVY** | The original Spark has its own protected layer. Notes, workshop text, and final text receive their own editing surfaces. |
| Delete Spark | **PRESUNÚŤ** | Put destructive package actions in a secondary package menu, never beside everyday writing actions. Keep tombstone semantics unchanged. |
| Save confirmation | **ZACHOVAŤ + STÍŠIŤ** | Use one calm autosave state in the open-work header: `Uložené`, `Ukladám…`, or a real error. |
| App hero and slogan | **ZACHOVAŤ, ZMENŠIŤ PO VSTUPE DO PRÁCE** | The promise belongs on Home. Inside a work, title, context, and editing space take priority. |
| App header | **PRESTAVAŤ AKO NAVIGAČNÝ SHELL** | Provide `Knižnica`, contextual `Dielňa`, and `Dáta`; show the current work title only in Workshop. |
| Manual v1 export | **SKRYŤ DO DÁTA A SYNC** | Keep unchanged initially as a compatibility and safety operation. |
| Manual v2 test export | **SKRYŤ DO DETAILOV / NESKÔR ODSTRÁNIŤ** | It is a technical test tool, not a normal author action. Do not promote v2 as a public format without a separate decision. |
| Coordinated v1/v2 import | **SKRYŤ DO DÁTA A SYNC** | Preserve the safe flow exactly; move only its entry point in a later reviewed runtime change. |
| Recovery blocking messages | **PRESUNÚŤ, ALE GLOBÁLNE SIGNALIZOVAŤ** | Show a calm blocking banner/link anywhere a relevant operation is attempted; full detail belongs in Data. |
| Google connection | **SKRYŤ DO DÁTA A SYNC** | Connection and manual sync controls live in Data. A small global sync indicator may remain visible. |
| Last-sync and pending status | **ZLÚČIŤ** | One unobtrusive status near the app shell: `Lokálne uložené`, `Čaká na sync`, `Offline`, or `Sync problém`. |
| Database version/counts/marker terminology | **SKRYŤ DO DETAILOV** | Reveal only for a real problem or an explicit `Technické detaily` disclosure. |
| Empty Spark list | **PREMENOVAŤ** | Library empty state offers `Nová iskra` and explains that the first package will appear here. |
| Filter empty state | **NESKÔR ODSTRÁNIŤ** | It disappears with stage filters; future search/archival empty states explain the active query instead. |
| Mobile one-column layout | **ZACHOVAŤ PRINCÍP, ZMENIŤ OBSAH** | Keep one active panel at a time, but give it package-aware navigation and a larger editing surface. |
| Settings | **VYTVORIŤ AŽ PRI REÁLNEJ POTREBE** | Settings contain user preferences only. Database tools never masquerade as settings. |

## Target Product Model

### One creative unit

The visible unit in the product is a WriterPackage:

- one stable `id`
- one title
- one protected `sparkText`
- multiple notes
- one `workshopText`
- one `finalText`
- one package-level created/updated history

The author should not need to know whether the visible package is a real stored
WriterPackage or a legacy Spark adapted into a read-only package view. That is
an implementation concern.

### Four layers, not four statuses

- **Iskra** answers: “What must not be forgotten?”
- **Poznámky** collect fragments, images, context, phrases, and alternatives.
- **Dielňa** is the long, messy shaping surface.
- **Text OK** is the clean accepted text.

The four names are navigation within one package. They are not global database
filters and do not imply moving or copying records.

### Package progress

Progress is inferred from content, not managed as a project workflow. Examples:

- only `sparkText` exists: recently captured
- notes exist: developing
- `workshopText` exists: in progress
- `finalText` exists: has accepted text

These descriptions may help Library scanning, but there is no compulsory
workflow, Kanban state, due date, tag system, or completion percentage.

## Recommended Information Architecture

Three primary entries are enough:

1. **Knižnica** — find, create, and reopen creative packages.
2. **Dielňa** — work inside the currently open package.
3. **Dáta** — connection, sync, import/export, backup, and recovery information.

`Nastavenia` should not be a fourth primary destination until real user
preferences exist. It can later be a small secondary entry from the app menu.

### Navigation rules

- Opening the app goes to **Knižnica**.
- Creating a Spark creates or prepares one package and opens its **Dielňa**.
- Opening a Library item opens that package's **Dielňa** at the last useful
  layer, with a predictable fallback to `Iskra`.
- `Dielňa` is contextual. With no open package, it routes to Knižnica instead
  of showing an empty technical shell.
- `Dáta` is always reachable but never occupies permanent space inside the
  writing canvas.
- A small sync state may be visible globally. Clicking it opens `Dáta`.

## Home And Library

The first screen supports two dominant intentions without looking like an
enterprise dashboard:

1. capture something before it disappears
2. continue the last meaningful work

### Recommended content order

1. compact Writer identity and calm sync status
2. large `Nová iskra` action
3. `Pokračovať` with the last one or two opened packages
4. `Rozpracované` or the full Library list
5. simple search once the catalog is large enough
6. archive/trash only later, after their behavior is designed

### Library item

A package row/card should show only what helps recognition:

- title
- a short Spark or current-text excerpt
- last edited time
- a quiet content-derived hint such as `3 poznámky` or `Text OK`
- action `Otvoriť`

Do not show schema versions, storage origins, package versions, raw IDs,
tombstone counts, or legacy status badges.

### Empty state

Recommended copy:

> Ešte tu nie je žiadne dielo. Zachyť prvú iskru; Writer ju bude držať spolu s
> poznámkami, pracovným textom a finálnou verziou.

Primary action: `Nová iskra`.

## WriterPackage Workflow

Target user flow:

```text
Nová iskra
→ vznik jedného WriterPackage s jedným ID
→ otvorenie Dielne na vrstve Iskra
→ pridávanie viacerých poznámok
→ rozvíjanie workshopText
→ zápis alebo prijatie finalText
→ pokojné označenie, že dielo má Text OK
```

The package grows additively. No step moves the package out of the preceding
layer, and no later edit overwrites the original Spark.

## Desktop Workshop

### Header of the open work

The Workshop header contains:

- `← Knižnica`
- editable or clearly displayed package title
- compact autosave state
- compact sync state only when it differs from normal local safety
- a secondary package menu for rare actions

Import, export, Google authorization, schema details, and database counts never
appear in this header.

### Layer switcher

The four-layer switcher remains visible and always refers to the same package:

```text
Iskra  |  Poznámky  |  Dielňa  |  Text OK
```

Selecting a layer changes focus and panel emphasis. It does not change a
package stage field.

### Panel behavior

On a wide PC screen:

- the active panel receives roughly two-thirds to three-quarters of the useful
  width
- the immediately previous or most relevant neighbouring panel remains visible
  as context
- the author can move left/right through the layer sequence
- the active editor is not nested inside multiple decorative cards
- context panels may be collapsed to a narrow readable rail, but never become
  ambiguous icons without labels

Examples:

```text
[Iskra: context, 30%] [Poznámky: active, 70%]
[Poznámky: context, 35%] [Dielňa: active, 65%]
[Dielňa: context, 35%] [Text OK: active, 65%]
```

At least two panels are visible when the viewport supports comfortable text.
The previous layer is the default context, but the author may deliberately
choose another layer.

### Small notebook behavior

When two readable text columns no longer fit:

- keep the explicit four-layer switcher
- show one active editor plus a narrow labelled context preview, if readable
- otherwise fall back to one panel without hiding navigation
- never squeeze two textareas into unusable columns
- never introduce horizontal page scrolling as the only navigation method

The exact breakpoint is an implementation and testing decision, not a product
contract.

## Mobile Workshop

Mobile shows one layer at a time.

### Mobile header

- back to Knižnica
- package title, truncated only when necessary
- a quiet autosave state
- no permanent database or sync-control panel

### Layer navigation

Use an always understandable labelled switcher:

```text
Iskra | Poznámky | Dielňa | Text OK
```

It may be horizontally scrollable if labels cannot fit, but the active layer
must remain visibly selected. Swipe may be an optional shortcut only after the
labelled control exists; it must not be the sole discovery mechanism.

### Mobile priorities

- capture a Spark quickly
- add a note in seconds
- make a short edit
- read workshop or final text comfortably
- reopen the original Spark as context

The active editor gets most of the viewport. Autosave messages are silent when
healthy and interrupt only for a real risk of lost work.

PC remains the primary surface for long development, comparison, restructuring,
and finalization.

## Notes Inside A Package

Notes should feel lighter than a task manager:

- one prominent `Pridať poznámku`
- newest or most recently edited notes easy to reach
- each note has text and a calm time label
- tap/click expands a note into direct editing
- collapse returns to a short readable excerpt
- deleting a note is secondary and deliberate

First version explicitly excludes tags, tables, priorities, workflow states,
assignees, due dates, and complex sorting. Multiple notes are material around a
work, not a second product-management system.

## Data And Sync

`Dáta` is a separate maintenance destination with progressive disclosure.

### Normal view

- **Lokálne uloženie:** healthy / warning
- **Google Drive:** connected / waiting / offline / problem
- **Posledný sync:** human-readable time
- `Synchronizovať teraz`
- `Pripojiť Google` when needed
- `Importovať databázu`
- `Exportovať databázu`

### Advanced details

Collapsed by default:

- database envelope version
- compatibility export actions such as v2 test export
- backup availability
- recovery blocking details
- verified record counts
- technical error details useful for support

The author should see `schemaVersion`, transaction-marker state, tombstone
counts, merge terminology, or warning codes only when a real problem requires
it or when `Technické detaily` is explicitly expanded.

### Global signals

Outside `Dáta`, show only status that changes the author's next action:

- normal: no message or `Uložené`
- pending: `Čaká na sync`
- offline: `Offline — uložené lokálne`
- auth needed: `Pripojiť Google`
- database/recovery block: concise warning with `Otvoriť Dáta`

Google Drive remains v1/Sparks-only until a separate v2 sync design and safety
review. Moving controls does not authorize a payload change.

## Legacy Stage Recommendation

Keep the current Spark `stage` field as historical metadata during transition.

Do:

- keep parsing and preserving it
- keep it in v1 export/import and Google v1 sync while those formats remain
- retain it under `WriterPackage.legacy.stage` in adapted views
- use it only as a temporary fallback hint if a product decision explicitly
  needs one

Do not:

- show it as the main Library navigation
- require the author to move a package through four statuses
- copy current Spark text automatically into notes, workshop, or final layers
- delete or rewrite it in an automatic migration
- infer lost historical versions from it

A later safe UX transition may explain that old `Zošit` values were preserved
but that new work now grows inside one package. Cleanup of legacy metadata must
be a separate data decision after the package workflow is proven.

## Text Wireframes

These are information-architecture diagrams, not visual specifications.

### 1. PC — Knižnica

```text
┌──────────────────────────────────────────────────────────────────────┐
│ LassiLAB Writer     Knižnica   Dielňa   Dáta      Uložené / Sync ● │
├──────────────────────────────────────────────────────────────────────┤
│ Rýchlejšie než zabudnutie.                                          │
│ [ + Nová iskra ]                                                     │
│                                                                      │
│ Pokračovať                                                           │
│ ┌───────────────────────────┐  ┌───────────────────────────┐         │
│ │ Názov diela               │  │ Názov diela               │         │
│ │ posledný úryvok           │  │ posledný úryvok           │         │
│ │ Upravené dnes   [Otvoriť] │  │ 3 poznámky      [Otvoriť] │         │
│ └───────────────────────────┘  └───────────────────────────┘         │
│                                                                      │
│ Knižnica                                      [Hľadať____________]  │
│ Názov / úryvok / posledná úprava / jemný obsahový stav              │
│ Názov / úryvok / posledná úprava / jemný obsahový stav              │
└──────────────────────────────────────────────────────────────────────┘
```

### 2. PC — otvorený WriterPackage

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Knižnica     Názov diela                  Uložené     Sync ●  ⋯ │
├──────────────────────────────────────────────────────────────────────┤
│ Iskra        Poznámky        Dielňa        Text OK                   │
├──────────────────────┬───────────────────────────────────────────────┤
│ POZNÁMKY — KONTEXT   │ DIELŇA — AKTÍVNA                              │
│                      │                                               │
│ • prvý fragment      │ Veľký pokojný editor pracovného textu…       │
│ • druhý fragment     │                                               │
│ • obraz a nálada     │                                               │
│                      │                                               │
│ [Pridať poznámku]    │                                               │
└──────────────────────┴───────────────────────────────────────────────┘
```

### 3. Mobil — Knižnica

```text
┌──────────────────────────────┐
│ Writer   Knižnica     Sync ● │
├──────────────────────────────┤
│ [ + Nová iskra             ] │
│                              │
│ Pokračovať                   │
│ ┌──────────────────────────┐ │
│ │ Názov diela             │ │
│ │ krátky úryvok           │ │
│ │ Upravené dnes  [Otvoriť]│ │
│ └──────────────────────────┘ │
│                              │
│ Všetky diela       [Hľadať]  │
│ Názov / úryvok / čas         │
│ Názov / úryvok / čas         │
│                              │
│ Knižnica     Dielňa     Dáta │
└──────────────────────────────┘
```

### 4. Mobil — otvorená Iskra

```text
┌──────────────────────────────┐
│ ← Knižnica   Názov   Uložené │
├──────────────────────────────┤
│ Iskra | Poznámky | Dielňa ›  │
├──────────────────────────────┤
│ ISKRA                        │
│ Pôvodný text — rodný list    │
│ diela.                       │
│                              │
│ [text iskry / chránený       │
│  kontext podľa fázy]         │
│                              │
│ [Pokračovať do Poznámok]     │
└──────────────────────────────┘
```

### 5. Mobil — Poznámky

```text
┌──────────────────────────────┐
│ ← Knižnica   Názov   Uložené │
├──────────────────────────────┤
│ ‹ Iskra | Poznámky | Dielňa  │
├──────────────────────────────┤
│ POZNÁMKY                     │
│ [ + Pridať poznámku        ] │
│                              │
│ ┌──────────────────────────┐ │
│ │ text poznámky…           │ │
│ │ Upravené 10:42  [Otvoriť]│ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ďalší fragment…          │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 6. Dáta a sync

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Knižnica                      Dáta a sync                  │
├──────────────────────────────────────────────────────────────┤
│ Lokálne uloženie     V poriadku                              │
│ Google Drive         Nepripojené     [Pripojiť Google]       │
│ Posledný sync        Zatiaľ nie      [Synchronizovať teraz]  │
├──────────────────────────────────────────────────────────────┤
│ Prenos databázy                                             │
│ [Importovať databázu] [Exportovať databázu]                 │
├──────────────────────────────────────────────────────────────┤
│ Backup a recovery     Bez aktívneho problému                 │
│ [Technické detaily ▾]                                       │
└──────────────────────────────────────────────────────────────┘
```

## Migration UX Plan

Each phase is a separate, reviewable implementation slice. None is implemented
by this document.

### Phase A — static shell and navigation with test data

- Build only the visual/product shell for `Knižnica`, contextual `Dielňa`, and
  `Dáta` using fixture data.
- No localStorage, import, sync, migration, or production package writes.
- Keep the current production UI available until the shell is reviewed.
- Validate desktop two-panel intent and mobile one-panel navigation.

Acceptance: navigation and hierarchy can be evaluated without touching user
data or pretending the fixtures are real packages.

Status: implemented as a separate fixture-only entry and manually reviewed on
PC and mobile. The isolated Phase B read-only Knižnica is now also published;
production navigation remains unchanged.

### Phase B — Library reads the existing package catalog

- Read `loadWriterPackageCatalog()` only.
- Show real WriterPackages and adapted legacy Sparks in one Library.
- No editing, creation, migration, or storage writes.

Acceptance: the same-id preference and legacy adapter behavior remain intact;
opening is not yet allowed to mutate data.

Status: B1-B4 are published through
`08b06848e712bac3499d397e50cee5ca4c62a439`. Exact DEV
`?mode=real-read-only` performs one catalog load before React render and shows
the real Knižnica without writes. The B5 read-only detail remains docs-only and
is specified in `WRITER_LIBRARY_READ_ONLY_DETAIL_REVIEW.md`.

### Phase C — open one real package read-only

- Open a selected catalog item in the Workshop.
- Display Iskra, notes, workshop text, and final text read-only.
- Clearly handle legacy adapted packages whose later layers are empty.
- Select only an immutable detail from the same single startup catalog snapshot;
  do not reload storage on click, return, or layer change.

Acceptance: one package ID remains the visible context across every layer and
no stage mutation occurs.

### Phase D — edit individual layers with autosave

- Add editing one layer at a time, with explicit storage ownership and tests.
- Preserve the original Spark rule and note identities.
- Define autosave failure/recovery behavior before enabling writes.
- Do not change Google sync payloads as an accidental side effect.

Acceptance: refresh, failure, and cross-device implications are understood for
each editable field before enabling the next one.

### Phase E — New Spark creates a WriterPackage directly

- Make `Nová iskra` create the new primary package type.
- Keep the quick-capture and draft-recovery comfort.
- Define how new packages travel between devices before calling this complete.

Acceptance: no duplicate Spark/Package truth is created, and the package can be
reopened safely on supported devices.

### Phase F — hide or safely relocate the legacy Spark UX

- Remove stage filters and the `Zošit` selector from primary navigation.
- Keep legacy data readable and compatible.
- Move old-only maintenance entry points behind a deliberate compatibility
  surface if still needed.
- Delete no data and run no automatic migration.

Acceptance: there is one visible package workflow, while legacy Sparks remain
recoverable, exportable, and understandable.

## Implementation Order And Gates

Recommended order:

1. Phase A: static shell with fixture data
2. Phase B: read-only Library catalog
3. Phase C: read-only real package Workshop
4. Phase D: isolated layer editing and autosave
5. Phase E: direct package creation
6. Phase F: legacy Spark UX retirement

Do not combine Phase A with storage wiring. The smallest first implementation
commit is a static, route-like shell with three destinations and fixture-only
Library/Workshop states, while the current runtime remains untouched.

## Accessibility And Verification Risks

Visible semantic strengths in the current DOM include named regions, headings,
button elements, labelled editor fields, and `aria-live` on important import
and sync results.

Risks to verify during future implementation:

- logical focus order between global navigation, layer switcher, context panel,
  and active editor
- persistent visible focus, especially where current hover/focus styling
  removes the default outline
- keyboard access to every layer without relying on swipe
- active-layer announcement and selected state
- heading order when one or two panels are visible
- readable reflow at 200% zoom and on small notebook widths
- minimum touch targets for the mobile layer switcher
- non-colour status communication for autosave and sync
- screen-reader clarity for the visually hidden file input; the current live DOM
  exposes an English `Choose File` control in addition to the Slovak custom
  action
- contrast testing with real rendered screenshots before visual sign-off

No WCAG-compliance claim is made by this review.

## Explicitly Out Of Scope

- runtime code or CSS changes
- App.tsx redesign
- data migration or deletion
- new storage keys or data formats
- Google Drive v2 sync
- changes to v1/Sparks-only Google sync
- import, export, persistence, recovery, or rollback changes
- per-note merge
- AI or Kováč
- image, voice, or melody capture
- Songbook or Storyboard integration
- collaboration, sharing, or publishing workflow
- a new editor framework or large dependency
- final colours, icons, typography tokens, or pixel measurements
- fantasy workshop decoration
- commit, push, deployment, or publication

## Decision Summary

The new Writer should not add more controls to the current long page. It should
first establish three understandable places:

```text
Knižnica → Dielňa → Dáta
```

Inside Dielňa, one WriterPackage owns four connected layers. Desktop shows the
active layer with neighbouring context; mobile shows one labelled layer at a
time. Technical safety remains strong but moves out of the creative workspace.
Legacy stage metadata remains preserved, hidden from primary navigation, and
untouched by automatic migration.
