import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gemeinsamer Auth-Store: ein einziger Listener und ein einziger
 * getSession()-Aufruf für die gesamte App (statt pro Komponente).
 */
type AuthState = { session: Session | null; loading: boolean };

let state: AuthState = { session: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, s) => {
    setState({ session: s, loading: false });
  });
  void supabase.auth.getSession().then(({ data }) => {
    setState({ session: data.session, loading: false });
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const serverState: AuthState = { session: null, loading: true };

export function useAuth() {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
  return {
    session: snap.session,
    user: (snap.session?.user ?? null) as User | null,
    loading: snap.loading,
  };
}
