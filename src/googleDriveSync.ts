import { createWriterDbExport, mergeWriterDbExportIntoStorage } from "./storage";
import type { GoogleSyncResult } from "./types";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const REMOTE_DB_FILE_NAME = "lassilab-writer-db-v001.json";
const JSON_MIME_TYPE = "application/json";

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  callback: (response: TokenResponse) => void;
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }) => TokenClient;
    };
  };
};

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptLoading: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;

export function isGoogleDriveSyncConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

export async function connectGoogleDrive() {
  accessToken = await requestAccessToken();
}

export async function syncGoogleDrive(): Promise<GoogleSyncResult> {
  const token = await requestAccessToken();
  const remoteFile = await findRemoteDbFile(token);
  const localDb = createWriterDbExport();

  if (!remoteFile) {
    const createdFile = await createRemoteDbFile(token, localDb);

    return {
      status: "created",
      message: `Google Drive DB vytvorena. Odoslane iskry: ${localDb.sparkCount}.`,
      counts: {
        added: 0,
        updated: 0,
        kept: 0,
        pushed: localDb.sparkCount,
        pulled: 0,
        errors: 0
      },
      remote: {
        fileId: createdFile.id,
        fileName: createdFile.name,
        created: true,
        updatedAt: createdFile.modifiedTime ?? localDb.exportedAt
      }
    };
  }

  const remoteDb = await downloadRemoteDbFile(token, remoteFile.id);
  const mergeResult = mergeWriterDbExportIntoStorage(remoteDb);
  const mergedDb = createWriterDbExport();

  try {
    const updatedFile = await updateRemoteDbFile(token, remoteFile.id, mergedDb);

    return {
      status: "synced",
      message: `Sync hotovy: potiahnute ${mergeResult.pulled}, odoslane ${mergeResult.pushed}.`,
      counts: {
        added: mergeResult.added,
        updated: mergeResult.updated,
        kept: mergeResult.kept,
        pushed: mergeResult.pushed,
        pulled: mergeResult.pulled,
        errors: 0
      },
      remote: {
        fileId: updatedFile.id,
        fileName: updatedFile.name,
        created: false,
        updatedAt: updatedFile.modifiedTime ?? mergedDb.exportedAt
      },
      backupKey: mergeResult.backupKey,
      backedUpAt: mergeResult.backedUpAt
    };
  } catch {
    return {
      status: "upload-warning",
      message:
        "Lokalna DB bola zlucena, ale upload na Google Drive zlyhal. Skus sync znova.",
      counts: {
        added: mergeResult.added,
        updated: mergeResult.updated,
        kept: mergeResult.kept,
        pushed: mergeResult.pushed,
        pulled: mergeResult.pulled,
        errors: 1
      },
      remote: {
        fileId: remoteFile.id,
        fileName: remoteFile.name,
        created: false,
        updatedAt: remoteFile.modifiedTime ?? mergedDb.exportedAt
      },
      backupKey: mergeResult.backupKey,
      backedUpAt: mergeResult.backedUpAt
    };
  }
}

function requestAccessToken() {
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(new Error("Google Drive sync is not configured."));
  }

  return loadGoogleIdentity().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const client = getTokenClient();

        client.callback = (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || "Authorization failed."));
            return;
          }

          accessToken = response.access_token;
          resolve(response.access_token);
        };

        client.requestAccessToken({ prompt: accessToken ? "" : "consent" });
      })
  );
}

function loadGoogleIdentity() {
  if (window.google?.accounts.oauth2) {
    return Promise.resolve();
  }

  if (scriptLoading) {
    return scriptLoading;
  }

  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google script failed.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed."));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

function getTokenClient() {
  if (tokenClient) {
    return tokenClient;
  }

  if (!window.google?.accounts.oauth2) {
    throw new Error("Google Identity Services is unavailable.");
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: () => undefined
  });

  return tokenClient;
}

async function findRemoteDbFile(token: string) {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${escapeDriveQueryValue(REMOTE_DB_FILE_NAME)}' and trashed = false`,
    orderBy: "modifiedTime desc",
    pageSize: "10",
    fields: "files(id,name,modifiedTime)"
  });

  const result = await driveJsonRequest<{ files?: DriveFile[] }>(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
    token
  );

  return result.files?.[0] ?? null;
}

async function downloadRemoteDbFile(token: string, fileId: string) {
  return driveJsonRequest<unknown>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
    token
  );
}

async function createRemoteDbFile(token: string, db: ReturnType<typeof createWriterDbExport>) {
  const metadata = {
    name: REMOTE_DB_FILE_NAME,
    parents: ["appDataFolder"]
  };
  const body = createMultipartBody(metadata, JSON.stringify(db, null, 2));

  return driveJsonRequest<DriveFile>(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime`,
    token,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${body.boundary}`
      },
      body: body.payload
    }
  );
}

async function updateRemoteDbFile(
  token: string,
  fileId: string,
  db: ReturnType<typeof createWriterDbExport>
) {
  return driveJsonRequest<DriveFile>(
    `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(
      fileId
    )}?uploadType=media&fields=id,name,modifiedTime`,
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": JSON_MIME_TYPE
      },
      body: JSON.stringify(db, null, 2)
    }
  );
}

async function driveJsonRequest<T>(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

function createMultipartBody(metadata: object, content: string) {
  const boundary = `writer_sync_${Date.now()}`;
  const payload = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${JSON_MIME_TYPE}`,
    "",
    content,
    `--${boundary}--`
  ].join("\r\n");

  return { boundary, payload };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
