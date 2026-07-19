# UX Notes

## UX North Star

Writer must be faster than forgetting.

The first screen should help the author capture, continue, or revisit work
without making them choose a complex structure first.

## Four Notebook Comfort

Writer should recreate the comfort of the author's old 3-4 physical notebook
workflow without forcing the physical mess into a database-shaped UI.

The product model is:

1. **Iskra**
   - Fastest possible capture.
   - No organizing pressure.
   - Mobile-first.
   - Faster than forgetting.
2. **Poznámky**
   - Image, mood, fragments, phrases, rhymes, and context.
   - A place to expand the spark without needing a finished text.
   - The author can add material before knowing what it is.
3. **Dielňa / Rozpracované**
   - Shaping text.
   - Trying versions.
   - Crossing out, moving, restructuring.
   - Desktop and tablet friendly.
4. **Text OK**
   - Clean accepted version.
   - Separated from messy drafts because the old third notebook became too
     crossed out and confusing.

The goal is not to create four heavy admin categories. The goal is to preserve
the psychological comfort of separate spaces: catch, expand, shape, accept.

In the first app version this is represented by one gentle `stage` on a saved
spark:

- **Iskra** = this was only caught.
- **Poznámky** = this is being expanded with fragments, mood, rhymes, or
  context.
- **Dielňa** = this is being shaped into working text.
- **Text OK** = this is the clean accepted version.

These are not separate databases and not a project-management system. In the
first stage UI they are only a light orientation layer, not the final model of
the work.

Important correction after first use: the stage/filter model is not the final
workflow. It helps orientation, but it still feels like moving one card between
labels.

The desired Writer workspace is **Tvorivá jednotka / Writer Package**: one
creative package with one id and connected layers. The original spark is the
birth certificate of the work. It should remain visible and protected while the
work grows into notes, workshop material, and final text.

```text
[Iskra] [Poznámky] [Dielňa] [Text OK]
```

On desktop, at least two layers should be visible side by side when possible.
The author can read the spark while writing notes, read notes while shaping
Dielňa, and read Dielňa while polishing Text OK.

On mobile, the same layers appear one at a time with simple switching. Mobile
still catches and continues; PC remains the broader work table.

The UX rule:

```text
not "move this card to another label"
but "open this work and grow it layer by layer"
```

Product principle:

```text
Každé dielo má svoje počatie.
Writer ho nesmie roztrhať na kartičky.
Má ho niesť v jednom balíku od prvej iskry až po hotový text.
```

Workspace wording:

```text
LassiLAB Writer neukladá poznámky ako voľné kartičky.
Ukladá tvorivé jednotky — balíky s jedinečným ID, v ktorých pôvodná iskra rastie
cez poznámky a dielňu až do publikovateľného textu.
```

Transition UX:

- New captures should feel like new packages from the start.
- Old saved Sparks should still open naturally as packages with the Iskra layer
  filled.
- The author should not need to know whether a record began life as legacy
  `Spark` or new `WriterPackage`.
- The PC horizontal work table comes after this unified package feeling is
  stable.

## Device Roles

- Mobile = chytiť.
- Sync = preniesť.
- PC = upratať.
- Tablet = čítať a tvarovať.

Mobile is the net for sparks, quick capture, quick continuation, and minimal
decisions. It must never become an organizing burden.

Tablet is the reading and shaping bench. It should feel comfortable for medium
editing, comparing, and continuing text without the weight of the full desktop
workspace.

PC/Desktop is the main workbench for organizing, merging, cleaning, versioning,
and separating accepted text from draft noise.

Sync or another bridge is essential because a spark captured on mobile must be
able to wait safely for PC or tablet later.

## Keep-Like Svitok Comfort

The author's desired feeling is close to Google Keep: write, close, continue
later on another device without performing technical rituals.

Writer should not make the author think like a database admin. The comfort rule:

- Mobile = chytiť.
- Sync = preniesť.
- PC = upratať.
- Tablet = čítať a tvarovať.

Google Drive Svitok is the first bridge for this. Manual sync remains as a
safety fallback, but the long-term direction is quiet sync on open and after
save whenever Google allows it without interrupting the author.

Tichý Svitok v2 moves closer to that feeling:

- Try sync on app open if Svitok is enabled and an access token is still active
  in memory.
- Try sync when returning to the app if local changes are waiting or the last
  sync is stale.
- Debounce sync briefly after save/delete/import so Writer does not sync on
  every tiny action.
- Show offline and waiting states calmly: the author can keep writing because
  local save is the first safety layer.

Tokens must not be stored. If Google needs fresh consent or an expired token
must be renewed, Writer should continue locally, show a calm waiting state, and
let the author reconnect intentionally.

Quiet sync never means opening a Google popup without a user action.

## Draft Recovery Comfort

Autosave for a new unsaved spark protects the most fragile moment: the author is
still thinking, has not committed the text, and a refresh, accidental close, or
mobile interruption could lose the idea.

The recovery UX should feel like a quiet note on the table:

- Save the new spark draft locally while typing.
- Show "Našiel som rozpísanú iskru" on return.
- Let the author choose **Obnoviť** or **Zahodiť**.
- Clear the draft after the spark is saved.
- Keep the draft local only; it is not synced and not part of export/import.

## Manual Writer DB Import Preview

Current implementation boundary: the separate **Náhľad importu DB v1/v2**
action now covers file selection, file reading, `parseWriterDbJson`, pure
preview, ready/blocked presentation, and cancellation. It reads complete local
Sparks plus real WriterPackages. It does not show an active import command and
does not merge, back up, persist, inspect recovery, migrate, or sync anything.
The confirmation and result states below remain the future execution contract.

The preview now also offers **Skontrolovať pripravenosť**. This read-only action
reloads current Sparks and real WriterPackages, inspects recovery through an
injected get-only storage adapter, and runs the pure preflight. A ready result
confirms only that the preview is current. A stale result displays the refreshed
preview and requires another readiness check. Recovery-required,
recovery-blocked, or newly blocked preview states prevent readiness. None of
these states exposes **Importovať** or writes data.

The future v1/v2 importer is a deliberate administrative flow, not an instant
file action. Selecting a JSON file only reads, parses, and previews it. Until
the author presses **Importovať**, no backup, merge, storage write, migration,
sync, or recovery action may run. **Zrušiť** closes the preview and leaves all
data unchanged.

The visible flow is:

1. **Vybrať súbor** opens the platform file picker.
2. While reading, show **Načítavam súbor…** and its file name.
3. A valid file opens a read-only **Import databázy** preview.
4. A blocked file shows a human-readable error and only **Vybrať iný súbor**
   and **Zavrieť**.
5. A ready preview offers **Importovať** and **Zrušiť**. One explicit
   **Importovať** press is enough; do not use `window.confirm` or a second
   generic confirmation.
6. On confirmation, refresh local data and recompute the preview. If anything
   changed, do not write; show **Miestne dáta sa medzitým zmenili. Skontrolujte
   aktualizovaný náhľad a potvrďte import znova.**
7. Only an unchanged, ready preview proceeds through merge, backup, guarded
   persistence, read-back validation, and a success or failure result.

### Ready preview copy

Title: **Import databázy**

- **Súbor:** `{fileName}`
- **Verzia databázy:** `Writer DB v1` or `Writer DB v2`
- Safety note: **Výber súboru zatiaľ nič nezmenil. Skontrolujte náhľad a až
  potom potvrďte import.**

Show separate **Iskry** and **Tvorivé balíky** sections. Each section lists
**Nové**, **Aktualizované**, **Nezmenené**, **Staršie – ignorované**, and
**Zmazania v súbore**. The last value is the number of incoming tombstones; it
does not claim that every tombstone will change local data. For v1, replace the
package counts with **Tvorivé balíky zostanú nedotknuté.**

Map preview warnings to calm Slovak copy:

- `v1-packages-untouched`: **Tento Writer DB v1 súbor nemení tvorivé balíky.**
- `count-mismatch`: **Počty uvedené v súbore nesedia s jeho obsahom. Rozhodujú
  overené záznamy v súbore.**
- `cross-model-id-overlap`: **Rovnaké ID sa nachádza medzi Iskrou a Tvorivým
  balíkom. Sú to samostatné typy záznamov a oba zostanú zachované.**
- `contains-tombstones`: **Súbor obsahuje záznamy o zmazaní. Novšie zmazania
  môžu nahradiť staršie miestne záznamy.**
- `empty-import`: **Súbor neobsahuje žiadne záznamy na import.**

Tombstones or a large update count get a stronger warning panel inside the
same preview, not another modal. Suggested copy: **Tento import obsahuje
zmazania alebo väčší počet zmien. Pred importom si pozorne skontrolujte súhrn.**
The action remains one deliberate **Importovať** press.

### Blocked preview copy

Title: **Tento súbor sa nedá importovať**

Lead text: **Nič nebolo zmenené. Skontrolujte súbor alebo vyberte iný.** Never
show an enabled import action. Translate the blocking reason without a stack
trace, for example:

- invalid JSON: **Súbor nie je platný JSON.**
- unsupported schema: **Táto verzia Writer DB zatiaľ nie je podporovaná.**
- invalid Spark: **Súbor obsahuje poškodenú Iskru.**
- invalid WriterPackage: **Súbor obsahuje poškodený Tvorivý balík.**
- duplicate same-collection ID: **Súbor obsahuje duplicitné ID v rovnakej
  kolekcii, preto sa nedá bezpečne zlúčiť.**

Actions: **Vybrať iný súbor** and **Zavrieť**.

### Result copy

Success title: **Import dokončený**

Show **Iskry** and **Tvorivé balíky** with **Vytvorené**, **Aktualizované**, and
**Staršie – ignorované** counts. Add **Backup pôvodných dát bol vytvorený.**
For v1 add **Tvorivé balíky zostali nedotknuté.** The only action is
**Hotovo**.

Failure states must be visibly distinct:

- Before any production write: **Import sa nepodarilo pripraviť. Nič nebolo
  zmenené. Môžete súbor skontrolovať a skúsiť znova.**
- Write failed, rollback succeeded: **Import sa nepodarilo dokončiť. Pôvodné
  dáta boli bezpečne obnovené a backup zostal k dispozícii.**
- Write failed, rollback failed: **Import sa nepodarilo dokončiť a pôvodné dáta
  sa nepodarilo úplne obnoviť. Nič ďalšie automaticky neurobíme. Pred ďalším
  importom bude potrebná kontrola obnovy.**

Use **Zavrieť** for a safe pre-write or successfully rolled-back failure. For
failed rollback add **Nový import zostane zablokovaný, kým sa predchádzajúca
operácia nevyrieši.** Do not add recovery controls in this slice.

### Recovery gate and responsive layout

Before opening a future import flow, recovery inspection must run. `clean` may
continue. A `recoverable` or `blocked` transaction marker must stop the new
import before file selection and explain: **Predchádzajúci import nebol úplne
dokončený. Najprv treba skontrolovať jeho obnovu.** Recovery UI and automatic
rollback remain separate future work.

On PC, use a modal or large centered card; Iskry and Tvorivé balíky may sit in
two columns with warnings and actions spanning the full width. On mobile, use
one vertical panel: file and safety note, Iskry, Tvorivé balíky, warnings, then
large actions that remain clearly reachable. Never use a wide table or require
horizontal scrolling or zooming. The flow may be denser than the Iskra editor,
but headings, spacing, and one primary action must keep it calm.

## Existing Spark Editing

Saved sparks should remain easy to revisit without turning Writer into a large
editor. The author can open a spark from **Posledne iskry**, adjust the text,
and save the change deliberately.

Editing an existing spark is different from creating a new spark:

- The existing spark keeps its `id` and `createdAt`.
- Saving changes updates `updatedAt` so sync can carry the newer version.
- Saving changes marks local sync preferences as pending local changes.
- New spark draft recovery stays only for a new unsaved spark.
- Cancelling an edit leaves the saved spark unchanged and does not overwrite the
  new-spark recovery draft.

## Workspace UX Rules

- Main mobile action remains fast capture.
- Organization can be richer on PC than on mobile.
- The product is for one author across multiple devices, not multi-user
  collaboration.
- Comfort of writing is as important as technical storage.
- The app should feel like a friendly work table, not a database admin panel.

## Future UX Order

The next larger UX steps should happen in this order:

1. Google Drive Svitok sync.
2. Autosave rozpisanej iskry.
3. Gentle spark status: Iskra / Poznámky / Dielňa / Text OK as temporary
   orientation.
4. Writer Package workspace: one work with visible layers.
5. Only then build deeper editors for notes and versions.

This protects the real workflow: catch first, move safely between devices,
avoid losing unfinished writing, then add structure.

## Mobile-First Priorities

- One large, obvious capture action in v0.1.
- Minimal typing before saving.
- Autosave or save-without-thinking behavior.
- Recent sparks available immediately.
- Works well with one hand.
- No layout that depends on desktop width.
- Offline-friendly behavior from the beginning if technically practical.

## First Comes The Image

Images should feel like starting points for writing.

For v0.1, this can be expressed through language and prompts rather than image
file handling. The app can ask what the author saw, heard, felt, or remembered.

Later possible flows:

- Capture image, then write.
- Choose existing image, then write.
- Start a fragment from an image detail.
- Keep image and text visible together when shaping a draft.

## Voice And Melody Sparks

Voice sparks and melody sparks are core future concepts. The UX should leave room
for them, but they should not be visible as unfinished controls in v0.1.

Future capture actions may include:

- Record voice spark.
- Record melody spark.
- Add quick transcript or note.
- Link audio spark to draft.

## Kováč UX Principle

Kováč is a future helper, not the author.

When AI is eventually introduced, it should be framed as optional workshop help:

- sharpen
- question
- suggest
- compare
- transform
- translate
- continue only when asked

It should not imply ownership, replacement authorship, or automatic completion.

## Screen Concepts

Potential early screens:

- Capture: quick text spark entry.
- Recent: latest sparks.
- Spark detail: saved spark plus edit state.

Later screens:

- Image-first capture.
- Voice or melody capture.
- Draft editor.
- Export bridge.

## UX Risks

- Too many categories before capture.
- Too much setup before writing.
- AI controls visible too early.
- Desktop-first layouts that feel heavy on mobile.
- Treating image, voice, or melody as attachments instead of creative origins.
