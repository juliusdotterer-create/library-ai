import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";


import {
  appUserReconnectRequired,
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import { requireWhitelisted } from "@/lib/require-whitelist";
import {
  deleteConnectionForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "@/lib/appUserConnections.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_drive";
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.readonly",
];
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

// Google-eigene Formate → Export-MIME
const GOOGLE_EXPORTS: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: ".pptx",
  },
};

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime: string | null;
  size: number | null;
};

type DriveFileRaw = {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  trashed?: boolean;
};

function toItem(f: DriveFileRaw): DriveItem {
  return {
    id: f.id ?? "",
    name: f.name ?? "Unbenannt",
    mimeType: f.mimeType ?? "",
    isFolder: f.mimeType === DRIVE_FOLDER_MIME,
    modifiedTime: f.modifiedTime ?? null,
    size: f.size ? Number(f.size) : null,
  };
}

async function requireDriveKey(userId: string): Promise<string> {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) throw new Error("Google Drive ist nicht verbunden");
  return key;
}

async function driveFetch(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = await requireDriveKey(userId);
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: CONNECTOR_ID,
    path,
    init,
    requiredScopes: DRIVE_SCOPES,
  });
  if (await appUserReconnectRequired(res)) {
    throw new Error("RECONNECT_REQUIRED");
  }
  return res;
}

/** Listet Dateien eines Drive-Ordners (paginiert intern komplett). */
async function listAllChildren(userId: string, folderId: string): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 20; page++) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent(
      "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
    );
    let path = `/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&orderBy=${encodeURIComponent("folder, name")}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await driveFetch(userId, path);
    if (!res.ok) throw new Error(`Drive-Liste fehlgeschlagen (${res.status})`);
    const body = (await res.json()) as { files?: DriveFileRaw[]; nextPageToken?: string };
    out.push(...(body.files ?? []).map(toItem));
    pageToken = body.nextPageToken ?? null;
    if (!pageToken) break;
  }
  return out;
}

// ---------------------------------------------------------------- connect

export const getDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireWhitelisted])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const, email: null as string | null };
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: "/drive/v3/about?fields=user",
        requiredScopes: DRIVE_SCOPES,
      });
      if (await appUserReconnectRequired(res)) {
        return { connected: false as const, reconnectRequired: true, email: null };
      }
      if (!res.ok) return { connected: true as const, email: null };
      const body = (await res.json()) as { user?: { emailAddress?: string; displayName?: string } };
      return {
        connected: true as const,
        email: body.user?.emailAddress ?? body.user?.displayName ?? null,
      };
    } catch {
      return { connected: true as const, email: null };
    }
  });

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .handler(async ({ context }) => {
    const clientKey = process.env['GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) {
      throw new Error(
        "Google Drive ist noch nicht eingerichtet (Connector-Client fehlt). Bitte im Projekt verknüpfen.",
      );
    }
    const request = getRequest();
    if (!request) throw new Error("OAuth muss aus einer App-Anfrage gestartet werden.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google_drive/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: DRIVE_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeDriveConnection = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { code: string }) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) {
      throw new Error("OAuth-Abschluss lieferte den falschen Connector");
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
      });
      await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------- browse

export const listDriveChildren = createServerFn({ method: "GET" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { folderId: string | null }) =>
    z.object({ folderId: z.string().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const items = await listAllChildren(context.userId, data.folderId ?? "root");
    return { items };
  });

// ---------------------------------------------------------------- import

const importSchema = z.object({
  targetFolderId: z.string().nullable(),
  items: z
    .array(z.object({ id: z.string().min(1), name: z.string(), mimeType: z.string() }))
    .min(1)
    .max(200),
});

export const importDriveItems = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: z.infer<typeof importSchema>) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let createdDocs = 0;
    let createdFolders = 0;

    // Cache externer Drive-Ordner-ID → lokale folder-ID
    const folderCache = new Map<string, string | null>();

    const importFolder = async (
      driveFolderId: string,
      driveName: string,
      localParent: string | null,
    ): Promise<string | null> => {
      if (folderCache.has(driveFolderId)) return folderCache.get(driveFolderId)!;
      const { data: existing } = await supabase
        .from("folders")
        .select("id,deleted_at")
        .eq("user_id", userId)
        .eq("external_id", driveFolderId)
        .maybeSingle();
      if (existing) {
        // Im Papierkorb liegende Drive-Ordner wieder herstellen statt Fehler werfen
        if (existing.deleted_at) {
          await supabase
            .from("folders")
            .update({ deleted_at: null, parent_id: localParent, name: driveName })
            .eq("id", existing.id)
            .eq("user_id", userId);
          createdFolders++;
        }
        folderCache.set(driveFolderId, existing.id);
        const kids = await listAllChildren(userId, driveFolderId);
        for (const child of kids) await importItem(child, existing.id);
        return existing.id;
      }
      const { data: row, error } = await supabase
        .from("folders")
        .insert({
          user_id: userId,
          parent_id: localParent,
          name: driveName,
          source: "gdrive",
          external_id: driveFolderId,
        })
        .select("id")
        .single();
      if (error || !row) {
        // Paralleler/doppelter Import: bestehende Zeile verwenden
        const { data: again } = await supabase
          .from("folders")
          .select("id")
          .eq("user_id", userId)
          .eq("external_id", driveFolderId)
          .maybeSingle();
        if (!again) throw error ?? new Error("Ordner konnte nicht angelegt werden");
        folderCache.set(driveFolderId, again.id);
        return again.id;
      }
      createdFolders++;
      folderCache.set(driveFolderId, row.id);
      const children = await listAllChildren(userId, driveFolderId);
      for (const child of children) {
        await importItem(child, row.id);
      }
      return row.id;
    };

    const importItem = async (item: DriveItem, localParent: string | null): Promise<void> => {
      if (item.isFolder) {
        await importFolder(item.id, item.name, localParent);
        return;
      }
      const exportInfo = GOOGLE_EXPORTS[item.mimeType];
      const effectiveMime = exportInfo?.mime ?? item.mimeType;
      const name =
        exportInfo && !item.name.toLowerCase().endsWith(exportInfo.ext)
          ? item.name + exportInfo.ext
          : item.name;
      const { error } = await supabase.from("documents").insert({
        user_id: userId,
        folder_id: localParent,
        name,
        storage_path: "",
        mime_type: effectiveMime,
        size_bytes: item.size,
        source: "gdrive",
        external_id: item.id,
        external_mime: item.mimeType,
        external_modified: item.modifiedTime,
        drive_state: "new",
      });
      // Doppel-Import (Unique-Index) ist kein Fehler.
      if (error && error.code !== "23505") throw error;
      if (!error) createdDocs++;
    };

    for (const item of data.items) {
      await importItem(
        {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          isFolder: item.mimeType === DRIVE_FOLDER_MIME,
          modifiedTime: null,
          size: null,
        },
        data.targetFolderId,
      );
      // Bei Dateien fehlen uns modifiedTime/Größe aus dem Picker — einmal nachlesen.
      if (item.mimeType !== DRIVE_FOLDER_MIME) {
        const res = await driveFetch(
          userId,
          `/drive/v3/files/${encodeURIComponent(item.id)}?fields=${encodeURIComponent("id, name, mimeType, modifiedTime, size")}`,
        );
        if (res.ok) {
          const f = toItem((await res.json()) as DriveFileRaw);
          const exportInfo = GOOGLE_EXPORTS[f.mimeType];
          await supabase
            .from("documents")
            .update({
              external_modified: f.modifiedTime,
              size_bytes: f.size,
              mime_type: exportInfo?.mime ?? f.mimeType,
            })
            .eq("user_id", userId)
            .eq("external_id", item.id);
        }
      }
    }
    return { createdDocs, createdFolders };
  });

// ---------------------------------------------------------------- sync

const SYNC_BATCH = 100;

/**
 * Legt einen Drive-Unterordner lokal an (falls noch nicht vorhanden) und
 * importiert rekursiv seinen Inhalt. Gibt die Anzahl neu angelegter Ordner zurück.
 */
async function ensureDriveFolder(
  supabase: SupabaseClient<Database>,
  userId: string,
  driveFolderId: string,
  driveName: string,
  localParentId: string,
): Promise<number> {
  const { data: existing } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", driveFolderId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return 0;

  const { data: row, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      parent_id: localParentId,
      name: driveName,
      source: "gdrive",
      external_id: driveFolderId,
    })
    .select("id")
    .single();
  if (error && error.code !== "23505") throw error;
  if (error || !row) return 0; // durch parallelen Lauf bereits angelegt

  let created = 1;
  const children = await listAllChildren(userId, driveFolderId);
  for (const child of children) {
    if (child.isFolder) {
      created += await ensureDriveFolder(supabase, userId, child.id, child.name, row.id);
      continue;
    }
    const exportInfo = GOOGLE_EXPORTS[child.mimeType];
    const name =
      exportInfo && !child.name.toLowerCase().endsWith(exportInfo.ext)
        ? child.name + exportInfo.ext
        : child.name;
    const { error: docErr } = await supabase.from("documents").insert({
      user_id: userId,
      folder_id: row.id,
      name,
      storage_path: "",
      mime_type: exportInfo?.mime ?? child.mimeType,
      size_bytes: child.size,
      source: "gdrive",
      external_id: child.id,
      external_mime: child.mimeType,
      external_modified: child.modifiedTime,
      drive_state: "new",
    });
    // Doppel-Import (Unique-Index) ist kein Fehler.
    if (docErr && docErr.code !== "23505") throw docErr;
  }
  return created;
}

export type SyncScope = {
  documentIds?: string[];
  folderIds?: string[];
  /** Bei Ordnern auch alle Unterordner einbeziehen (Standard: true). */
  recursive?: boolean;
};

export const syncDriveItems = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: SyncScope | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scoped = Boolean(data?.documentIds?.length || data?.folderIds?.length);

    // Bei Ordner-Auswahl: Unterordner rekursiv auflösen
    let folderScope: string[] | null = null;
    if (data?.folderIds?.length) {
      folderScope = [...data.folderIds];
      if (data.recursive !== false) {
        const { data: all } = await supabase
          .from("folders")
          .select("id, parent_id")
          .eq("user_id", userId)
          .is("deleted_at", null);
        const byParent = new Map<string, string[]>();
        for (const f of all ?? []) {
          const key = f.parent_id ?? "root";
          byParent.set(key, [...(byParent.get(key) ?? []), f.id]);
        }
        const queue = [...folderScope];
        const seen = new Set(folderScope);
        while (queue.length) {
          const id = queue.shift()!;
          for (const child of byParent.get(id) ?? []) {
            if (seen.has(child)) continue;
            seen.add(child);
            queue.push(child);
          }
        }
        folderScope = [...seen];
      }
    }

    // Verknüpfte Drive-Dokumente (ohne Papierkorb)
    let docQuery = supabase
      .from("documents")
      .select("id, name, external_id, external_mime, external_modified, folder_id, drive_state")
      .eq("user_id", userId)
      .eq("source", "gdrive")
      .is("deleted_at", null)
      .not("external_id", "is", null);
    if (data?.documentIds?.length) {
      docQuery = docQuery.in("id", data.documentIds);
    } else if (folderScope) {
      docQuery = docQuery.in("folder_id", folderScope);
    } else if (scoped) {
      docQuery = docQuery.in("id", []);
    }
    const { data: docs } = await docQuery.limit(SYNC_BATCH);

    // Verknüpfte Drive-Ordner mit lokalem Gegenstück
    let folderQuery = supabase
      .from("folders")
      .select("id, external_id")
      .eq("user_id", userId)
      .eq("source", "gdrive")
      .is("deleted_at", null)
      .not("external_id", "is", null);
    if (folderScope) {
      folderQuery = folderQuery.in("id", folderScope);
    } else if (scoped) {
      folderQuery = folderQuery.in("id", []);
    }
    const { data: folders } = await folderQuery.limit(SYNC_BATCH);


    let added = 0;
    let addedFolders = 0;
    let changed = 0;
    let missing = 0;
    let failed = 0;

    for (const doc of docs ?? []) {
      try {
        const res = await driveFetch(
          userId,
          `/drive/v3/files/${encodeURIComponent(doc.external_id!)}?fields=${encodeURIComponent("id, name, modifiedTime, trashed")}`,
        );
        if (res.status === 404) {
          await supabase
            .from("documents")
            .update({ drive_state: "missing" })
            .eq("id", doc.id);
          missing++;
          continue;
        }
        if (!res.ok) {
          failed++;
          continue;
        }
        const f = (await res.json()) as DriveFileRaw;
        if (f.trashed) {
          await supabase
            .from("documents")
            .update({ drive_state: "missing" })
            .eq("id", doc.id);
          missing++;
          continue;
        }
        const remoteModified = f.modifiedTime ?? null;
        const localModified = doc.external_modified ?? null;
        const isChanged =
          remoteModified && localModified
            ? new Date(remoteModified).getTime() > new Date(localModified).getTime() + 1000
            : false;
        if (isChanged) {
          await supabase
            .from("documents")
            .update({ drive_state: "changed", external_modified: remoteModified })
            .eq("id", doc.id);
          // Text-Index invalidieren, damit er neu aufgebaut wird
          await supabase
            .from("document_text")
            .update({ status: "pending", content: "", pages: [], page_count: 0, attempts: 0 })
            .eq("document_id", doc.id);
          changed++;
        }
      } catch {
        failed++;
      }
    }

    // Neue Dateien UND Unterordner in verknüpften Drive-Ordnern einsammeln
    for (const folder of folders ?? []) {
      try {
        const children = await listAllChildren(userId, folder.external_id!);
        const fileChildren = children.filter((c) => !c.isFolder);
        const subFolders = children.filter((c) => c.isFolder);

        // Neue Unterordner (inkl. Inhalt) automatisch anlegen
        for (const sub of subFolders) {
          addedFolders += await ensureDriveFolder(
            supabase,
            userId,
            sub.id,
            sub.name,
            folder.id,
          );
        }

        if (!fileChildren.length) continue;
        const { data: existing } = await supabase
          .from("documents")
          .select("external_id")
          .eq("user_id", userId)
          .eq("source", "gdrive")
          .in(
            "external_id",
            fileChildren.map((c) => c.id),
          );
        const known = new Set((existing ?? []).map((e) => e.external_id));
        for (const child of fileChildren) {
          if (known.has(child.id)) continue;
          const exportInfo = GOOGLE_EXPORTS[child.mimeType];
          const name =
            exportInfo && !child.name.toLowerCase().endsWith(exportInfo.ext)
              ? child.name + exportInfo.ext
              : child.name;
          const { error } = await supabase.from("documents").insert({
            user_id: userId,
            folder_id: folder.id,
            name,
            storage_path: "",
            mime_type: exportInfo?.mime ?? child.mimeType,
            size_bytes: child.size,
            source: "gdrive",
            external_id: child.id,
            external_mime: child.mimeType,
            external_modified: child.modifiedTime,
            drive_state: "new",
          });
          if (!error) added++;
        }
      } catch {
        failed++;
      }
    }

    return { added, addedFolders, changed, missing, failed };
  });

// ---------------------------------------------------------------- content

export const getDriveFileContent = createServerFn({ method: "GET" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("documents")
      .select("id, external_id, external_mime, mime_type, drive_state")
      .eq("id", data.documentId)
      .eq("user_id", userId)
      .single();
    if (!doc || !doc.external_id) throw new Error("Dokument nicht gefunden");

    const exportInfo = doc.external_mime ? GOOGLE_EXPORTS[doc.external_mime] : undefined;
    const path = exportInfo
      ? `/drive/v3/files/${encodeURIComponent(doc.external_id)}/export?mimeType=${encodeURIComponent(exportInfo.mime)}`
      : `/drive/v3/files/${encodeURIComponent(doc.external_id)}?alt=media`;
    const res = await driveFetch(userId, path);
    if (res.status === 404) {
      await supabase.from("documents").update({ drive_state: "missing" }).eq("id", doc.id);
      throw new Error("Datei wurde in Google Drive nicht gefunden");
    }
    if (!res.ok) throw new Error(`Datei konnte nicht geladen werden (${res.status})`);
    const buf = await res.arrayBuffer();

    // Bytes als base64 zurückgeben (RPC kann keine Streams)
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return {
      base64: btoa(binary),
      mimeType: exportInfo?.mime ?? doc.mime_type ?? "application/octet-stream",
    };
  });

/** Markiert ein Drive-Dokument beim Öffnen als gesehen (Badge verschwindet). */
export const markDriveDocSeen = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("documents")
      .update({ drive_state: "ok" })
      .eq("id", data.documentId)
      .eq("user_id", context.userId);
    return { ok: true };
  });
