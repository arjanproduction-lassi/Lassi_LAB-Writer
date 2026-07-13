# Writer Package v1

## Status

This is a design proposal, not an implementation task.

The current four-notebook `stage` model works technically, but it is not the
target Writer workflow. It treats one saved spark like a card that moves between
labels:

```text
Iskra -> Poznámky -> Dielňa -> Text OK
```

That is useful as a first orientation layer, but the author confirmed that the
real target is different:

One creative package has one identity and contains the whole growth of a work
from first spark to finished text.

The working name:

```text
WriterPackage
```

Slovak product name:

```text
Tvorivá jednotka
```

The original spark is the birth certificate of the work. It must not disappear,
be overwritten by later notes, or get hidden just because the work moved into a
later phase.

Core product principle:

```text
Každé dielo má svoje počatie.
Writer ho nesmie roztrhať na kartičky.
Má ho niesť v jednom balíku od prvej iskry až po hotový text.
```

Product model definition:

```text
LassiLAB Writer neukladá poznámky ako voľné kartičky.
Ukladá tvorivé jednotky — balíky s jedinečným ID, v ktorých pôvodná iskra rastie
cez poznámky a dielňu až do publikovateľného textu.
```

## Why Stage Is Not Enough

The stage model answers:

```text
Where is this card now?
```

Writer needs to answer:

```text
How is this work growing?
```

In the real notebook workflow, the author does not want the spark to stop
existing when notes are added. The spark should stay visible while notes grow
beside it. Notes should stay visible while workshop text is shaped. Workshop
material should stay visible while the final text is cleaned.

A single `stage` can say "this is now in Dielňa", but it cannot comfortably show:

- the original spark as the origin
- several development notes
- rough workshop material
- clean accepted text
- the relationship between those layers

So `stage` should be treated as a temporary legacy/orientation field, not the
final workspace model.

## Target Model

A Writer Package is one creative unit with a single id.

Minimum target fields:

```ts
type WriterPackage = {
  id: string;
  title: string;
  sparkText: string;
  notes: WriterNote[];
  workshopText: string;
  finalText: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  packageVersion: 1;
  legacy?: {
    source: "spark";
    stage?: SparkStage;
  };
};

type WriterNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};
```

Implementation direction:

- Add `WriterPackage` as the new primary model.
- Keep `Spark` readable as a legacy model.
- New captures should be saved as `WriterPackage`, not as new legacy `Spark`
  records.
- Old `Spark` records should be displayed through a simple package adapter with
  the Iskra layer filled.
- Build the PC horizontal workspace only after the package model is stable.

The important part is the mental model:

```text
one id
one work
many layers of growth
```

The package can later grow with optional fields, but those are not part of the
first implementation:

- musical dramaturgy / Suno prompt
- visual prompt / storyboard note
- publication notes
- export or booklet metadata

Those future fields should remain optional layers on the package, not reasons to
connect Writer directly to Songbook or Storyboard.

## Layers

### Title

The title belongs to the package, not to one note.

Rules:

- It is visible above the workspace.
- It can be edited deliberately.
- If empty, Writer can derive a display title from the first useful line of
  `sparkText`.
- Editing title updates package `updatedAt`.
- Title travels with sync, export, and import.

### Iskra

`sparkText` is the original spark.

This is the birth certificate of the work:

- it starts the package
- it should remain readable later
- it should not be overwritten by notes or workshop edits
- it can be corrected carefully, but the UX should make it feel like origin
  material, not a disposable draft field

For old data, the current `Spark.text` becomes `sparkText`. Legacy `stage` can
remain visible as orientation, but it should not automatically move old text
into notes, workshop, or final.

### Poznámky

`notes` are development notes.

They can contain:

- image
- mood
- fragments
- phrases
- rhymes
- context
- a continuation that is not ready to become a workshop text

Notes are an array because there may be more than one. The first implementation
can support simple add/edit only. Explicit ordering, note deletion tombstones,
and advanced note structure can wait.

### Dielňa

`workshopText` is the shaping space.

It can be messy:

- raw material
- partial versions
- moved lines
- fragments copied from notes
- half-finished text

For v1, one comfortable editor is enough. Do not build version history before
the basic layered table feels right.

### Text OK

`finalText` is the clean accepted text.

It is separated from `workshopText` because the old physical notebook became too
crossed out and confusing. This layer protects the relief of having a clean
version.

## PC UX

PC is the main workbench.

Target desktop layout:

```text
[ Iskra ] [ Poznámky ] [ Dielňa ] [ Text OK ]
```

Rules:

- The author opens one package.
- The package title stays visible above the table.
- Layers are panels in a horizontally scrollable work table.
- At least two panels should fit side by side on a normal monitor.
- Each writing panel needs a comfortable editor.
- The author can use the left panel as reference and the right panel as the
  active writing surface.

Typical PC flows:

- left: Iskra, right: Poznámky
- left: Poznámky, right: Dielňa
- left: Dielňa, right: Text OK

This is not a kanban board and not project management. It is a writing desk.

## Mobile UX

Mobile keeps the same package and layers, but shows one layer at a time.

Target order:

```text
Iskra -> Poznámky -> Dielňa -> Text OK
```

Rules:

- The main mobile action remains fast capture.
- Opening a package shows one layer on screen.
- Switching can be simple tabs, a segmented control, or horizontal swipe.
- Mobile should let the author catch and continue.
- Mobile must not become an organizing burden.

Device roles stay:

```text
mobile = chytiť
sync = preniesť
PC = upratať
tablet = čítať a tvarovať
```

## Sync, Export, And Import

The whole package should travel as one record.

Manual JSON export/import and Google Drive appDataFolder sync can keep the same
overall bridge idea:

- no backend
- no custom accounts
- no shared databases
- one author across several devices
- local backup before merge
- deleted tombstones preserved

Future DB payload can eventually contain:

```ts
{
  app: "LassiLAB Writer";
  schemaVersion: 2;
  exportedAt: string;
  packages: WriterPackage[];
  legacySparks?: Spark[];
}
```

For the first code step, a full schema jump is not required. The safer path is
to add package/layer data additively while keeping existing Spark records and
storage readable.

## Migration From Current Sparks

Do not destroy old `Spark` records.

Safe compatibility rules:

- Keep `Spark` as a legacy type that Writer can still read.
- Display each old Spark as a simple Writer Package.
- Use the current Spark `id` as the displayed package `id` when possible.
- Preserve `createdAt`, `updatedAt`, and `deletedAt`.
- Put the old Spark current text into `sparkText`.
- Keep `notes`, `workshopText`, and `finalText` empty at first.
- Use existing `title` if it exists; otherwise derive a display title from the
  first useful line.
- Treat `stage` as legacy metadata/orientation only, not as proof that the text
  should be moved into notes, workshop, or final.
- Keep a backup before any real one-time migration.

Initial legacy view:

| Legacy Spark field | Package view |
| --- | --- |
| `id` | `id` |
| `title` | `title`, or derived title if missing |
| `text` | `sparkText` |
| `createdAt` | `createdAt` |
| `updatedAt` | `updatedAt` |
| `deletedAt` | `deletedAt` |
| `stage` | legacy metadata only |

This deliberately avoids a clever stage-based migration. A user may have marked
a spark as `workshop` while the text still contains the original spark. The
first package pass should protect the text by treating old Sparks as origins,
not by splitting them into layers automatically.

Important historical truth:

- Old `Spark` records contain only one current text layer.
- If the user already edited a Spark, Writer cannot reconstruct its original
  historical spark or intermediate writing path.
- The legacy adapter therefore uses the current Spark text as the initial
  `sparkText` view.
- That title and package view are not persisted by the adapter.
- New `WriterPackage` records can preserve the layers separately later.

## Legacy Adapter v1

The first implemented bridge is a pure adapter:

```ts
adaptSparkToWriterPackage(spark: Spark): WriterPackage
```

It follows this path:

```text
old Spark
   -> legacy adapter
WriterPackage
```

Rules:

- Same `id`.
- Same `createdAt`.
- Same `updatedAt`.
- Same `deletedAt` when present.
- Spark current `text` becomes `sparkText`.
- `notes` starts as an empty array.
- `workshopText` starts empty.
- `finalText` starts empty.
- Spark `stage` is preserved only as `legacy.stage`.
- The title is derived from the first non-empty Spark text line.
- The adapter does not write to storage.
- The adapter does not change export/import/sync payloads.
- The adapter does not run a migration.

## Package Storage Foundation v1

The next infrastructure layer keeps old and new records separate:

```text
legacy Sparks storage
   -> read-only adapter
      \
       shared read-only catalog
      /
WriterPackage storage
```

Storage keys:

```text
legacy Sparks:   lassilab-writer:v0.1:sparks
WriterPackage:   lassilab-writer:v0.1:packages
```

Rules:

- Old Sparks remain untouched in the Spark storage.
- Writer Packages have their own storage key.
- The shared catalog is a read-only view that can show both.
- The catalog never migrates data.
- The catalog never writes adapted Sparks back as packages.
- If a real Writer Package and a legacy Spark have the same id, the real
  Writer Package wins in the catalog.
- The catalog sorts by `updatedAt`, newest first.

This prepares the future UI to see one list of works without forcing an
immediate database migration.

## What Happens To Stage

Keep `stage` for now.

Recommended role:

- legacy compatibility
- old list filters
- orientation while the package model is being tested
- migration hint only

Do not remove `stage` until old exports, imports, and synced Google Drive DB
files can be read safely by the package model.

Long term, stage should be replaced by the visible content of the package
layers. The author should not have to choose whether a work "is" notes or
workshop. It can contain both.

## UpdatedAt Rules

The package has a top-level `updatedAt`.

Minimum v1 rules:

- Editing title updates package `updatedAt`.
- Editing `sparkText` updates package `updatedAt`.
- Adding or editing a note updates note `updatedAt` and package `updatedAt`.
- Editing `workshopText` updates package `updatedAt`.
- Editing `finalText` updates package `updatedAt`.
- Soft delete sets package `deletedAt` and package `updatedAt`.

For simple v1 sync, package-level `updatedAt` can still decide which full
package wins.

Long term, safer sync should consider per-layer timestamps so a mobile note does
not overwrite a PC workshop edit made at nearly the same time.

## Minimal Implementation Plan

Do not start with a full data rewrite.

Smallest safe code path:

1. Add the new `WriterPackage` type.
2. Keep `Spark` as a legacy readable type.
3. Save new captures as `WriterPackage`.
4. Show old Spark records as simple packages with `sparkText` filled from the
   old Spark text.
5. Keep existing sync/export/import behavior compatible while both record
   shapes exist.
6. Add a simple package detail screen.
7. Only after that, design and implement the PC horizontal workspace.
8. On mobile, keep one package layer on screen with simple switching.
9. After real use, decide whether to run a one-time migration and bump the DB
   schema.

## Risks

Main risks:

- Losing the original spark while migrating to layers.
- Mapping old staged text into the wrong layer.
- Turning the mobile app into an organizer instead of a capture net.
- Changing sync/export/import too early.
- Building notes, versions, publishing metadata, and future media layers all at
  once.
- Letting the package model accidentally become Songbook or Storyboard
  integration.

## Do Not Do In One Step

- Do not remove the current Spark model immediately.
- Do not remove `stage` immediately.
- Do not change Google sync architecture.
- Do not change manual JSON export/import into a final public export schema yet.
- Do not add backend or custom accounts.
- Do not add AI/Kováč.
- Do not add voice, melody, or image upload.
- Do not add Songbook or Storyboard integration.
- Do not build version history before the basic package table feels right.

## Guardrails

- The original spark stays protected.
- The whole package travels as one record.
- Manual JSON export/import remains a fallback.
- Google Drive sync remains a bridge for one author across devices.
- Mobile remains fast capture first.
- PC becomes the larger work table.
- Tablet becomes the reading and shaping bench.
- Writer should feel like a friendly writing table, not a database admin panel.
