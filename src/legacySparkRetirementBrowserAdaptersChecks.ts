import type { LegacySparkRetirementBackupAssemblyDependencies } from "./legacySparkRetirementBackupAssembly";
import {
  createLegacySparkRetirementBrowserAdapters,
  decodeLegacySparkRetirementUtf8Strict,
  encodeLegacySparkRetirementUtf8,
  sha256LegacySparkRetirementBytes,
  sha256LegacySparkRetirementCanonicalUtf8
} from "./legacySparkRetirementBrowserAdapters";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function bytesEqual(left: Uint8Array, right: readonly number[]): boolean {
  return left.length === right.length && right.every((byte, index) => left[index] === byte);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function rejectsWith(
  action: () => string | Promise<string>
): Promise<string> {
  try {
    await action();
  } catch (error) {
    return errorMessage(error);
  }
  throw new Error("Expected adapter action to reject.");
}

async function withCrypto<T>(
  cryptoValue: Crypto | undefined,
  action: () => Promise<T>
): Promise<T> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: cryptoValue
  });
  try {
    return await action();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "crypto", previous);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
}

function publicSourceText(): string {
  return [
    encodeLegacySparkRetirementUtf8.toString(),
    decodeLegacySparkRetirementUtf8Strict.toString(),
    sha256LegacySparkRetirementBytes.toString(),
    sha256LegacySparkRetirementCanonicalUtf8.toString(),
    createLegacySparkRetirementBrowserAdapters.toString()
  ].join("\n");
}

async function runChecks(): Promise<number> {
  let passed = 0;
  const test = (condition: boolean, message: string) => {
    check(condition, message);
    passed += 1;
  };

  const emptyBytes = encodeLegacySparkRetirementUtf8("");
  test(emptyBytes instanceof Uint8Array && emptyBytes.length === 0, "A. empty text encodes to empty bytes.");
  test(bytesEqual(encodeLegacySparkRetirementUtf8("abc"), [97, 98, 99]), "B. ASCII encoding is stable.");
  const unicodeText = "\u017dlt\u00e1 \u013ealia \ud83c\udfb5";
  test(decodeLegacySparkRetirementUtf8Strict(encodeLegacySparkRetirementUtf8(unicodeText)) === unicodeText, "C. diacritics and emoji round-trip.");
  const whitespaceText = "  line one\r\nline two\n\tend  ";
  test(decodeLegacySparkRetirementUtf8Strict(encodeLegacySparkRetirementUtf8(whitespaceText)) === whitespaceText, "D. whitespace and newlines are preserved.");
  test(encodeLegacySparkRetirementUtf8(whitespaceText).length === encodeLegacySparkRetirementUtf8(whitespaceText).length, "E. same text produces stable bytes.");

  const mutableDecoded = encodeLegacySparkRetirementUtf8("mutable");
  const mutableDecodedBefore = JSON.stringify(Array.from(mutableDecoded));
  test(decodeLegacySparkRetirementUtf8Strict(mutableDecoded) === "mutable", "F. strict decoder accepts valid UTF-8.");
  test(JSON.stringify(Array.from(mutableDecoded)) === mutableDecodedBefore, "G. strict decoder does not mutate input bytes.");

  const invalidMessage = await rejectsWith(() =>
    decodeLegacySparkRetirementUtf8Strict(new Uint8Array([0xc3, 0x28]))
  );
  test(invalidMessage === "LEGACY_SPARK_RETIREMENT_UTF8_DECODE_FAILED", "H. invalid UTF-8 rejects with a safe code.");
  test(!invalidMessage.includes("\ufffd") && !invalidMessage.includes("195") && !invalidMessage.includes("40"), "I. invalid UTF-8 never exposes replacement or input bytes.");

  const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x62, 0x63]);
  test(decodeLegacySparkRetirementUtf8Strict(bomBytes) === "abc", "J. UTF-8 BOM is consumed explicitly during decode.");
  const bomHash = await sha256LegacySparkRetirementBytes(bomBytes);
  const noBomHash = await sha256LegacySparkRetirementBytes(encodeLegacySparkRetirementUtf8("abc"));
  test(bomHash !== noBomHash, "K. raw byte hashing preserves BOM differences.");

  test(await sha256LegacySparkRetirementBytes(new Uint8Array()) === EMPTY_SHA256, "L. empty byte SHA-256 vector.");
  test(await sha256LegacySparkRetirementBytes(encodeLegacySparkRetirementUtf8("abc")) === ABC_SHA256, "M. abc byte SHA-256 vector.");
  test(/^[0-9a-f]{64}$/.test(await sha256LegacySparkRetirementBytes(encodeLegacySparkRetirementUtf8("abc"))), "N. byte hash is 64 lowercase hex.");
  test(await sha256LegacySparkRetirementBytes(new Uint8Array([1, 2, 3])) === await sha256LegacySparkRetirementBytes(new Uint8Array([1, 2, 3])), "O. same bytes produce same hash.");
  test(await sha256LegacySparkRetirementBytes(new Uint8Array([1, 2, 3])) !== await sha256LegacySparkRetirementBytes(new Uint8Array([1, 2, 4])), "P. one changed byte changes the hash.");

  const mutableHashed = encodeLegacySparkRetirementUtf8("abc");
  const mutableHashedBefore = JSON.stringify(Array.from(mutableHashed));
  await sha256LegacySparkRetirementBytes(mutableHashed);
  test(JSON.stringify(Array.from(mutableHashed)) === mutableHashedBefore, "Q. byte hasher does not mutate input.");
  const asyncMutable = encodeLegacySparkRetirementUtf8("abc");
  const asyncHash = sha256LegacySparkRetirementBytes(asyncMutable);
  asyncMutable.fill(0);
  test(await asyncHash === ABC_SHA256, "R. async hashing uses an immediate byte snapshot.");

  test(await sha256LegacySparkRetirementCanonicalUtf8("") === EMPTY_SHA256, "S. empty canonical text hash vector.");
  test(await sha256LegacySparkRetirementCanonicalUtf8("abc") === ABC_SHA256, "T. ASCII canonical text hash vector.");
  test(/^[0-9a-f]{64}$/.test(await sha256LegacySparkRetirementCanonicalUtf8(unicodeText)), "U. Unicode canonical text hashes to hex.");
  test(await sha256LegacySparkRetirementCanonicalUtf8("abc") !== await sha256LegacySparkRetirementCanonicalUtf8(" abc"), "V. leading whitespace changes canonical hash.");
  test(await sha256LegacySparkRetirementCanonicalUtf8("a\nb") !== await sha256LegacySparkRetirementCanonicalUtf8("a\r\nb"), "W. newline changes canonical hash.");
  test(await sha256LegacySparkRetirementCanonicalUtf8("\u00e9") !== await sha256LegacySparkRetirementCanonicalUtf8("e\u0301"), "X. Unicode normalization is not applied.");

  const adapters = createLegacySparkRetirementBrowserAdapters();
  const assemblyCompatible: Pick<
    LegacySparkRetirementBackupAssemblyDependencies,
    "decodeUtf8Strict" | "sha256Bytes" | "sha256CanonicalUtf8"
  > = adapters;
  test(assemblyCompatible.decodeUtf8Strict(encodeLegacySparkRetirementUtf8("abc")) === "abc", "Y. bundle exposes the R2.5 decode signature.");
  test(await assemblyCompatible.sha256Bytes(encodeLegacySparkRetirementUtf8("abc")) === ABC_SHA256, "Z. bundle exposes the R2.5 byte hash signature.");
  test(await assemblyCompatible.sha256CanonicalUtf8("abc") === ABC_SHA256, "AA. bundle exposes the R2.5 canonical hash signature.");
  test(Object.isFrozen(adapters), "AB. browser adapter bundle is frozen.");

  const missingCrypto = await rejectsWith(() =>
    withCrypto(undefined, () => sha256LegacySparkRetirementBytes(encodeLegacySparkRetirementUtf8("abc")))
  );
  test(missingCrypto === "LEGACY_SPARK_RETIREMENT_WEB_CRYPTO_UNAVAILABLE", "AC. unavailable crypto rejects with a safe code.");
  const failingCrypto = {
    subtle: {
      digest: async () => {
        throw new Error("private digest failure abc");
      }
    }
  } as unknown as Crypto;
  const failedDigest = await rejectsWith(() =>
    withCrypto(failingCrypto, () => sha256LegacySparkRetirementBytes(encodeLegacySparkRetirementUtf8("abc")))
  );
  test(failedDigest === "LEGACY_SPARK_RETIREMENT_SHA256_FAILED", "AD. digest failure rejects with a safe code.");
  test(!failedDigest.includes("private") && !failedDigest.includes("abc"), "AE. digest failure hides exception text and input.");

  const source = publicSourceText();
  test(!/node:crypto|\bBuffer\b/.test(source), "AF. adapters do not use Node crypto or Buffer.");
  test(/globalThis\.crypto\?\.subtle/.test(source) && /digest\(\"SHA-256\"/.test(source), "AG. adapters use Web Crypto SHA-256.");
  test(!/localStorage|sessionStorage|googleDrive|syncGoogleDrive|fetch|writeFile|node:fs/.test(source), "AH. adapters have no storage, Drive, network, or filesystem runtime.");
  test(!/React|useState|jsx|tsx/.test(source), "AI. adapters have no React or UI runtime.");
  test(!/Blob|FileReader|createObjectURL|download\s*=|anchor\.click|link\.click/.test(source), "AJ. adapters create no Blob/File/download.");
  test(!/console\./.test(source), "AK. adapters log nothing.");

  console.log(`Legacy Spark retirement R2.6.2 browser adapter checks: ${passed}/${passed} passed.`);
  return passed;
}

export const legacySparkRetirementBrowserAdaptersCheckCount = runChecks();
