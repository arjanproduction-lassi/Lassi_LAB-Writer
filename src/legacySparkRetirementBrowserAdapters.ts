import type { LegacySparkRetirementBackupAssemblyDependencies } from "./legacySparkRetirementBackupAssembly";

export type LegacySparkRetirementBrowserAdapters = Readonly<{
  encodeUtf8: typeof encodeLegacySparkRetirementUtf8;
  decodeUtf8Strict: typeof decodeLegacySparkRetirementUtf8Strict;
  sha256Bytes: typeof sha256LegacySparkRetirementBytes;
  sha256CanonicalUtf8: typeof sha256LegacySparkRetirementCanonicalUtf8;
}>;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: false
});

function adapterError(code: string): Error {
  return new Error(code);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  if (!(bytes instanceof Uint8Array)) {
    throw adapterError("LEGACY_SPARK_RETIREMENT_BYTES_REQUIRED");
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function encodeLegacySparkRetirementUtf8(text: string): Uint8Array {
  if (typeof text !== "string") {
    throw adapterError("LEGACY_SPARK_RETIREMENT_TEXT_REQUIRED");
  }
  return new Uint8Array(UTF8_ENCODER.encode(text));
}

export function decodeLegacySparkRetirementUtf8Strict(bytes: Uint8Array): string {
  const snapshot = copyBytes(bytes);
  try {
    return UTF8_DECODER.decode(snapshot);
  } catch {
    throw adapterError("LEGACY_SPARK_RETIREMENT_UTF8_DECODE_FAILED");
  }
}

export async function sha256LegacySparkRetirementBytes(bytes: Uint8Array): Promise<string> {
  const snapshot = copyBytes(bytes);
  const digestInput = new ArrayBuffer(snapshot.byteLength);
  new Uint8Array(digestInput).set(snapshot);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== "function") {
    throw adapterError("LEGACY_SPARK_RETIREMENT_WEB_CRYPTO_UNAVAILABLE");
  }

  let digest: ArrayBuffer;
  try {
    digest = await subtle.digest("SHA-256", digestInput);
  } catch {
    throw adapterError("LEGACY_SPARK_RETIREMENT_SHA256_FAILED");
  }

  const hash = bytesToHex(new Uint8Array(digest));
  if (!SHA256_HEX.test(hash)) {
    throw adapterError("LEGACY_SPARK_RETIREMENT_SHA256_FAILED");
  }
  return hash;
}

export function sha256LegacySparkRetirementCanonicalUtf8(text: string): Promise<string> {
  return sha256LegacySparkRetirementBytes(encodeLegacySparkRetirementUtf8(text));
}

export function createLegacySparkRetirementBrowserAdapters(): LegacySparkRetirementBrowserAdapters &
  Pick<
    LegacySparkRetirementBackupAssemblyDependencies,
    "decodeUtf8Strict" | "sha256Bytes" | "sha256CanonicalUtf8"
  > {
  return Object.freeze({
    encodeUtf8: encodeLegacySparkRetirementUtf8,
    decodeUtf8Strict: decodeLegacySparkRetirementUtf8Strict,
    sha256Bytes: sha256LegacySparkRetirementBytes,
    sha256CanonicalUtf8: sha256LegacySparkRetirementCanonicalUtf8
  });
}
