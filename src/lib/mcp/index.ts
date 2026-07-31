import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchLibraryTool from "./tools/search-library";
import listFolderTool from "./tools/list-folder";
import listEventsTool from "./tools/list-events";
import createEventTool from "./tools/create-event";
import listStudyTasksTool from "./tools/list-study-tasks";
import listLinksTool from "./tools/list-links";

// Der OAuth-Issuer muss der direkte Supabase-Host sein (kein .lovable.cloud-Proxy).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "library",
  title: "Library",
  version: "0.1.0",
  instructions:
    "Werkzeuge für Library – das persönliche Studienarchiv. Dokumente und Ordner durchsuchen und auflisten, Kalendertermine lesen und anlegen, Lehrplan-Aufgaben und Linktree-Einträge lesen. Alle Daten gehören dem angemeldeten Nutzer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchLibraryTool,
    listFolderTool,
    listEventsTool,
    createEventTool,
    listStudyTasksTool,
    listLinksTool,
  ],
});
