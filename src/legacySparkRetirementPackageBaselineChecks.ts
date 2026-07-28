import type { WriterPackage, WriterPackageNote } from "./types";
import {
  buildLegacySparkRetirementPackageBaseline,
  type LegacySparkRetirementPackageBaselineInput,
  type LegacySparkRetirementPackageBaselineResult
} from "./legacySparkRetirementPackageBaseline";

function fakeSha256(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return Array.from({ length: 8 }, (_, index) =>
    ((a + Math.imul(b ^ index, 0x27d4eb2d)) >>> 0).toString(16).padStart(8, "0")
  ).join("");
}

function note(overrides: Partial<WriterPackageNote> = {}): WriterPackageNote {
  return {
    id: "synthetic-note",
    text: "Synthetic note text",
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    ...overrides
  };
}

function writerPackage(overrides: Partial<WriterPackage> = {}): WriterPackage {
  return {
    id: "synthetic-package",
    title: "Synthetic title",
    sparkText: "Synthetic spark text",
    notes: [],
    workshopText: "Synthetic workshop text",
    finalText: "Synthetic final text",
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    packageVersion: 1,
    ...overrides
  };
}

function hasReason(
  result: LegacySparkRetirementPackageBaselineResult,
  reason: string
): boolean {
  return result.status === "invalid" && result.reasons.includes(reason as never);
}

async function runChecks(): Promise<number> {
  let passed = 0;
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
    passed += 1;
  };
  const build = (
    packages: readonly WriterPackage[],
    overrides: Partial<LegacySparkRetirementPackageBaselineInput> = {}
  ) => buildLegacySparkRetirementPackageBaseline({
    packages,
    hashCanonicalUtf8Sha256: fakeSha256,
    ...overrides
  });
  const fingerprint = async (packages: readonly WriterPackage[]) => {
    const result = await build(packages);
    if (result.status !== "baseline-built") throw new Error("Expected synthetic baseline.");
    return result.baseline.semanticPackageSha256;
  };

  const empty = await build([]);
  check(empty.status === "baseline-built", "An empty Package collection must build a baseline.");
  if (empty.status !== "baseline-built") throw new Error("Expected empty baseline.");
  check(empty.baseline.packageCount === 0 && empty.baseline.packageLiveCount === 0 && empty.baseline.packageTombstoneCount === 0, "Empty counts must be zero.");
  check(/^[0-9a-f]{64}$/.test(empty.baseline.semanticPackageSha256), "Empty Packages need a hash.");

  const live = await build([writerPackage()]);
  check(live.status === "baseline-built" && live.baseline.packageLiveCount === 1, "Live Package count.");
  const tombstone = writerPackage({ deletedAt: "2026-07-28T11:00:00.000Z", notes: [note()] });
  const tombstoned = await build([tombstone]);
  check(tombstoned.status === "baseline-built" && tombstoned.baseline.packageTombstoneCount === 1 && tombstoned.baseline.packageLiveCount === 0, "Package tombstone retained.");
  const mixed = await build([writerPackage({ id: "live" }), writerPackage({ id: "deleted", deletedAt: "2026-07-28T11:00:00.000Z" })]);
  check(mixed.status === "baseline-built" && mixed.baseline.packageCount === 2 && mixed.baseline.packageLiveCount === 1 && mixed.baseline.packageTombstoneCount === 1, "Mixed counts.");

  const notesPackage = writerPackage({ notes: [note({ id: "live-note" }), note({ id: "deleted-note", deletedAt: "2026-07-28T11:00:00.000Z" }), note({ id: "empty-note", text: "" })] });
  const notesBaseline = await build([notesPackage]);
  check(notesBaseline.status === "baseline-built" && notesBaseline.baseline.noteCount === 3, "All notes counted.");
  check(notesBaseline.status === "baseline-built" && notesBaseline.baseline.deletedNoteCount === 1, "Deleted notes counted.");
  check(await fingerprint([notesPackage]) !== await fingerprint([writerPackage({ notes: [note({ id: "live-note" }), note({ id: "empty-note", text: "" })] })]), "Deleted note fingerprints.");
  check(await fingerprint([writerPackage({ notes: [note({ text: "" })] })]) !== await fingerprint([writerPackage({ notes: [] })]), "Empty live note fingerprints.");

  const sorted = await build([writerPackage({ id: "z" }), writerPackage({ id: "a" })]);
  check(sorted.status === "baseline-built" && sorted.baseline.packageIds.join(",") === "a,z", "IDs sorted.");
  check(await fingerprint([writerPackage({ id: "z" }), writerPackage({ id: "a" })]) === await fingerprint([writerPackage({ id: "a" }), writerPackage({ id: "z" })]), "Package order irrelevant.");
  check(hasReason(await build([writerPackage({ id: "duplicate" }), writerPackage({ id: "duplicate" })]), "DUPLICATE_PACKAGE_ID"), "Duplicate IDs fail.");
  check(hasReason(await build([{ ...writerPackage(), title: 7 } as unknown as WriterPackage]), "PACKAGE_DATA_INVALID"), "Invalid Package fails.");
  check(hasReason(await build([writerPackage({ notes: [{ ...note(), text: 7 } as unknown as WriterPackageNote] })]), "PACKAGE_DATA_INVALID"), "Invalid note fails.");
  check(hasReason(await build([writerPackage({ updatedAt: "bad-date" })]), "PACKAGE_DATA_INVALID"), "Invalid Package timestamp fails.");
  check(hasReason(await build([writerPackage({ notes: [note({ deletedAt: "bad-date" })] })]), "PACKAGE_DATA_INVALID"), "Invalid note timestamp fails.");
  check(hasReason(await build([{ ...writerPackage(), extra: "unsupported" } as WriterPackage]), "PACKAGE_DATA_INVALID"), "Unknown fields fail.");
  check(hasReason(await build([{ ...writerPackage(), deletedAt: undefined } as WriterPackage]), "PACKAGE_DATA_INVALID"), "Explicit undefined fails.");

  const base = writerPackage();
  const reordered: WriterPackage = { finalText: base.finalText, id: base.id, title: base.title, sparkText: base.sparkText, notes: base.notes, workshopText: base.workshopText, createdAt: base.createdAt, updatedAt: base.updatedAt, packageVersion: 1 };
  check(await fingerprint([base]) === await fingerprint([reordered]), "Key insertion order irrelevant.");
  const packageMutations: Array<[string, WriterPackage]> = [
    ["id", writerPackage({ id: "changed-id" })],
    ["title", writerPackage({ title: "changed title" })],
    ["sparkText", writerPackage({ sparkText: "changed spark" })],
    ["workshopText", writerPackage({ workshopText: "changed workshop" })],
    ["finalText", writerPackage({ finalText: "changed final" })],
    ["createdAt", writerPackage({ createdAt: "2026-07-28T09:00:00.000Z" })],
    ["updatedAt", writerPackage({ updatedAt: "2026-07-28T11:00:00.000Z" })],
    ["deletedAt", writerPackage({ deletedAt: "2026-07-28T11:00:00.000Z" })]
  ];
  const baseFingerprint = await fingerprint([base]);
  for (const [field, mutated] of packageMutations) {
    check(baseFingerprint !== await fingerprint([mutated]), `${field} must affect fingerprint.`);
  }
  check(hasReason(await build([{ ...base, packageVersion: 2 } as unknown as WriterPackage]), "PACKAGE_DATA_INVALID"), "Unsupported packageVersion fails.");

  const packageWithNote = writerPackage({ notes: [note()] });
  const noteMutations: Array<[string, WriterPackage]> = [
    ["id", writerPackage({ notes: [note({ id: "changed-note" })] })],
    ["text", writerPackage({ notes: [note({ text: "changed note" })] })],
    ["timestamp", writerPackage({ notes: [note({ updatedAt: "2026-07-28T11:00:00.000Z" })] })],
    ["deletedAt", writerPackage({ notes: [note({ deletedAt: "2026-07-28T11:00:00.000Z" })] })]
  ];
  const noteFingerprint = await fingerprint([packageWithNote]);
  for (const [field, mutated] of noteMutations) {
    check(noteFingerprint !== await fingerprint([mutated]), `Note ${field} must affect fingerprint.`);
  }
  check(await fingerprint([writerPackage({ notes: [note({ id: "a" }), note({ id: "b" })] })]) !== await fingerprint([writerPackage({ notes: [note({ id: "b" }), note({ id: "a" })] })]), "Note order significant.");

  const legacyA = writerPackage({ legacy: { source: "spark", stage: "notes" } });
  const legacyB = writerPackage({ legacy: { stage: "notes", source: "spark" } });
  check(await fingerprint([legacyA]) === await fingerprint([legacyB]), "Legacy key order irrelevant.");
  check(await fingerprint([legacyA]) !== await fingerprint([writerPackage({ legacy: { source: "spark", stage: "final" } })]), "Legacy values significant.");

  let capturedCanonical = "";
  const unicodeResult = await buildLegacySparkRetirementPackageBaseline({ packages: [writerPackage({ title: "Žltá ľalia 🎵", sparkText: "  zachované medzery  " })], hashCanonicalUtf8Sha256: (text) => { capturedCanonical = text; return fakeSha256(text); } });
  check(unicodeResult.status === "baseline-built" && capturedCanonical.includes("Žltá ľalia 🎵"), "Unicode reaches hasher unchanged.");
  check(capturedCanonical.includes("  zachované medzery  "), "Whitespace reaches hasher unchanged.");
  check(await fingerprint([tombstone]) !== await fingerprint([writerPackage({ notes: [note()] })]), "Package tombstone participates.");
  check(await fingerprint([writerPackage({ deletedAt: "2026-07-28T11:00:00.000Z", notes: [note()] })]) !== await fingerprint([writerPackage({ deletedAt: "2026-07-28T11:00:00.000Z", notes: [] })]), "Tombstoned Package notes participate.");

  check(empty.baseline.rawStorageSha256 === null, "Missing raw hash is null.");
  const rawHash = "a".repeat(64);
  const withRaw = await build([], { rawStorageSha256: rawHash });
  check(withRaw.status === "baseline-built" && withRaw.baseline.rawStorageSha256 === rawHash, "Valid raw hash preserved.");
  check(hasReason(await build([], { rawStorageSha256: "INVALID" }), "PACKAGE_RAW_HASH_INVALID"), "Invalid raw hash fails.");
  const throwingHasher = await buildLegacySparkRetirementPackageBaseline({ packages: [], hashCanonicalUtf8Sha256: () => { throw new Error("private sync failure"); } });
  check(hasReason(throwingHasher, "PACKAGE_SEMANTIC_HASH_FAILED"), "Sync throw typed.");
  const rejectedHasher = await buildLegacySparkRetirementPackageBaseline({ packages: [], hashCanonicalUtf8Sha256: () => Promise.reject(new Error("private async failure")) });
  check(hasReason(rejectedHasher, "PACKAGE_SEMANTIC_HASH_FAILED"), "Rejected Promise typed.");
  const invalidHasher = await buildLegacySparkRetirementPackageBaseline({ packages: [], hashCanonicalUtf8Sha256: (() => 7) as unknown as (text: string) => string });
  check(hasReason(invalidHasher, "PACKAGE_SEMANTIC_HASH_INVALID"), "Sync invalid hash typed.");
  const asyncInvalidHasher = await buildLegacySparkRetirementPackageBaseline({ packages: [], hashCanonicalUtf8Sha256: async () => "ABC" });
  check(hasReason(asyncInvalidHasher, "PACKAGE_SEMANTIC_HASH_INVALID"), "Async invalid hash typed.");
  const asyncValid = await buildLegacySparkRetirementPackageBaseline({ packages: [base], hashCanonicalUtf8Sha256: async (text) => fakeSha256(text) });
  check(asyncValid.status === "baseline-built", "Async fake hasher works.");
  const promiseAdapter = (text: string): Promise<string> => Promise.resolve(fakeSha256(text));
  const promiseCompatible = await buildLegacySparkRetirementPackageBaseline({ packages: [base], hashCanonicalUtf8Sha256: promiseAdapter });
  check(promiseCompatible.status === "baseline-built", "Promise crypto adapter contract works.");
  const asyncAgain = await buildLegacySparkRetirementPackageBaseline({ packages: [base], hashCanonicalUtf8Sha256: promiseAdapter });
  check(JSON.stringify(promiseCompatible) === JSON.stringify(asyncAgain), "Async builds deterministic.");

  const privateResult = await build([notesPackage]);
  const privateJson = JSON.stringify(privateResult);
  check(!privateJson.includes("Synthetic title") && !privateJson.includes("Synthetic spark text"), "No Package text output.");
  check(!privateJson.includes("Synthetic workshop text") && !privateJson.includes("Synthetic final text"), "No layer text output.");
  check(!privateJson.includes("Synthetic note text"), "No note text output.");
  check(!privateJson.includes(capturedCanonical), "No canonical output.");
  check(!privateJson.includes("private sync failure") && !privateJson.includes("private async failure"), "No exception text output.");
  check(privateResult.status === "baseline-built" && Object.isFrozen(privateResult) && Object.isFrozen(privateResult.baseline), "Wrapper and baseline frozen.");
  check(privateResult.status === "baseline-built" && Object.isFrozen(privateResult.baseline.packageIds), "IDs frozen.");
  check(throwingHasher.status === "invalid" && Object.isFrozen(throwingHasher) && Object.isFrozen(throwingHasher.reasons), "Invalid result frozen.");

  const mutableNote = note();
  const mutablePackage = writerPackage({ notes: [mutableNote] });
  const mutableInput = [mutablePackage];
  const before = JSON.stringify(mutableInput);
  const detachedPromise = build(mutableInput);
  mutablePackage.id = "changed-during-await";
  const detached = await detachedPromise;
  check(JSON.stringify(mutableInput) !== before && detached.status === "baseline-built" && detached.baseline.packageIds[0] === "synthetic-package", "Async builder snapshots inputs before await.");
  if (detached.status !== "baseline-built") throw new Error("Expected detached baseline.");
  mutableNote.text = "later text";
  mutableInput.push(writerPackage({ id: "later-package" }));
  check(detached.baseline.packageIds.join(",") === "synthetic-package", "Later mutation cannot change result.");
  check(JSON.stringify(await build([base])) === JSON.stringify(await build([base])), "Sync fake deterministic.");
  check(privateResult.status === "baseline-built" && privateResult.status !== ("backup-verified" as string), "Not backup-verified.");
  check(!privateJson.includes("baseline-matched") && !privateJson.includes("assembly-verified"), "No stronger baseline state.");
  check(!privateJson.includes("ready-to-create-tombstones") && !privateJson.includes("ready-to-delete") && !privateJson.includes("completed"), "No destructive state.");

  const sourceText = buildLegacySparkRetirementPackageBaseline.toString();
  check(!/crypto|subtle|digest/i.test(sourceText), "No direct crypto.");
  check(!/localStorage|sessionStorage|window|document/.test(sourceText), "No storage/browser globals.");
  check(!/fetch|googleDrive|driveJsonRequest/.test(sourceText), "No network/Drive.");
  check(!/writeFile|createWriteStream|download|Blob/.test(sourceText), "No files.");
  check(!/Date\.now|new Date\(\)/.test(sourceText), "No current time.");
  check(!/console\./.test(sourceText), "No logging.");

  console.log(`Legacy Spark retirement R2.4 Package baseline checks: ${passed}/${passed} passed.`);
  return passed;
}

export const legacySparkRetirementPackageBaselineCheckCount = runChecks();
