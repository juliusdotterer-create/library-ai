// Eigenständige Demo: kein Supabase-Server mehr. Alle Daten liegen lokal im
// Browser (siehe src/integrations/local/db.ts). Der Typ bleibt der des
// supabase-js-Clients, damit die bestehenden Abfragen typgeprüft bleiben.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { localDb } from "@/integrations/local/db";

export const supabase = localDb as unknown as SupabaseClient<Database>;
