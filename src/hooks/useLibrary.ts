import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const queryKeys = {
  folders: (parentId: string | null) => ["folders", parentId],
  documents: (folderId: string | null) => ["documents", folderId],
  trash: ["trash"],
  studyPlans: ["study_plans"],
  studyTasks: (planId: string | null) => ["study_tasks", planId],
  allDocs: ["all-docs"],
  allFolders: ["all-folders"],
  events: (start: string) => ["events", start],
  links: ["links"],
  favoriteFolders: ["favorite-folders"],
  folderPath: (folderId: string) => ["folder", folderId],
};

/** Lädt Ordner eines Eltern-Ordners (nur des aktuellen Nutzers). */
export function useFolders(parentId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.folders(parentId),
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("folders")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("is_favorite", { ascending: false })
        .order("name");
      q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt Dokumente eines Ordners (nur des aktuellen Nutzers). */
export function useDocuments(folderId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.documents(folderId),
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .not("name", "ilike", "desktop.ini")
        .order("created_at", { ascending: false });
      q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt alle Ordner des Nutzers (z. B. für Picker). */
export function useAllFolders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.allFolders,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,name,parent_id")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt alle Dokumente des Nutzers (z. B. für Lehrplan-Picker). */
export function useAllDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.allDocs,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,name,storage_path,folder_id,mime_type")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .not("name", "ilike", "desktop.ini")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt Papierkorb-Einträge des aktuellen Nutzers. */
export function useTrash() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.trash,
    enabled: !!user,
    queryFn: async () => {
      const [f, d] = await Promise.all([
        supabase
          .from("folders")
          .select("*")
          .eq("user_id", user!.id)
          .not("deleted_at", "is", null),
        supabase
          .from("documents")
          .select("*")
          .eq("user_id", user!.id)
          .not("deleted_at", "is", null),
      ]);
      if (f.error) throw f.error;
      if (d.error) throw d.error;
      return { folders: f.data, documents: d.data };
    },
  });
}

/** Lädt favorisierte Ordner des Nutzers. */
export function useFavoriteFolders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.favoriteFolders,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,name")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .eq("is_favorite", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt Lehrpläne des Nutzers. */
export function useStudyPlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.studyPlans,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt Aufgaben eines Lehrplans. */
export function useStudyTasks(planId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.studyTasks(planId),
    enabled: !!user && !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_tasks")
        .select("*")
        .eq("user_id", user!.id)
        .eq("plan_id", planId!)
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt Termine im angegebenen Zeitraum. */
export function useEvents(start: string, end: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.events(start),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user!.id)
        .gte("start_at", start)
        .lte("start_at", end)
        .order("start_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt Links des Nutzers. */
export function useLinks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.links,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Lädt einen einzelnen Ordner (user-scoped). */
export function useFolder(folderId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.folderPath(folderId ?? ""),
    enabled: !!user && !!folderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,name,parent_id")
        .eq("user_id", user!.id)
        .eq("id", folderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
