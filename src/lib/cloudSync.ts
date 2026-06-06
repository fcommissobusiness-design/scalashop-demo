import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoreSnapshot,
  subscribeStore,
  applyRemoteStore,
  isApplyingRemote,
} from "./store";

export type CloudSyncStatus = "idle" | "loading" | "ready" | "syncing" | "error" | "offline";

// Status condiviso (per indicatore globale)
let currentStatus: CloudSyncStatus = "idle";
const statusListeners = new Set<(s: CloudSyncStatus) => void>();
function setSharedStatus(s: CloudSyncStatus) {
  currentStatus = s;
  statusListeners.forEach((l) => l(s));
}
export function useSyncStatus(): CloudSyncStatus {
  const [s, set] = useState<CloudSyncStatus>(currentStatus);
  useEffect(() => {
    statusListeners.add(set);
    set(currentStatus);
    return () => { statusListeners.delete(set); };
  }, []);
  return s;
}

/**
 * Cloud sync: keeps the entire gestionale state in a single per-user JSON row
 * in `user_state`. Hydrates on login, pushes local changes debounced, and
 * subscribes to realtime updates so other devices receive changes live.
 */
export function useCloudSync(userId: string | null) {
  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const versionRef = useRef<number>(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);

  // helper combinato per stato locale + condiviso
  const updateStatus = (s: CloudSyncStatus) => { setStatus(s); setSharedStatus(s); };

  useEffect(() => {
    if (!userId) {
      updateStatus("idle");
      return;
    }
    let cancelled = false;
    updateStatus("loading");

    const pushNow = async () => {
      if (!userId) return;
      if (!pendingRef.current) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      pendingRef.current = false;
      updateStatus("syncing");
      try {
        const snapshot = getStoreSnapshot();
        const nextVersion = versionRef.current + 1;
        const { error } = await supabase
          .from("user_state")
          .update({
            data: snapshot as any,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (error) throw error;
        versionRef.current = nextVersion;
        updateStatus("ready");
      } catch (e) {
        console.error("[cloudSync] push failed", e);
        pendingRef.current = true; // retry on next change/flush
        updateStatus("offline");
      } finally {
        inFlightRef.current = false;
        // se sono arrivate altre modifiche durante l'upload, pusha di nuovo
        if (pendingRef.current) {
          if (pushTimer.current) clearTimeout(pushTimer.current);
          pushTimer.current = setTimeout(pushNow, 200);
        }
      }
    };

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_state")
          .select("data, version, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;

        if (!data) {
          const local = getStoreSnapshot();
          const { data: ins, error: insErr } = await supabase
            .from("user_state")
            .insert({ user_id: userId, data: local as any, version: 1 })
            .select("version")
            .single();
          if (insErr) throw insErr;
          versionRef.current = ins?.version ?? 1;
        } else {
          versionRef.current = Number(data.version ?? 1);
          if (data.data && typeof data.data === "object") {
            applyRemoteStore(data.data as any);
            // Se lo stato cloud è vecchio (es. import clienti/migrazioni locali),
            // dopo l'idratazione lo ripubblichiamo così anche gli altri device vedono i dati corretti.
            pendingRef.current = true;
          }
        }
        if (cancelled) return;
        updateStatus("ready");
        if (pendingRef.current) void pushNow();
      } catch (e) {
        console.error("[cloudSync] hydrate failed", e);
        if (!cancelled) updateStatus("error");
      }
    })();

    // Push debounced (300ms invece di 800ms — più reattivo).
    const unsub = subscribeStore(() => {
      if (isApplyingRemote()) return;
      pendingRef.current = true;
      updateStatus("syncing");
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(pushNow, 300);
    });

    // Flush immediato quando l'app viene chiusa o messa in background
    // (critico su mobile/PWA: senza questo, una modifica appena salvata
    // si perde se l'utente chiude prima del debounce).
    const flush = () => {
      if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; }
      if (pendingRef.current) void pushNow();
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);

    // Realtime: ricezione modifiche da altri device.
    const channel = supabase
      .channel(`user_state:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_state",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { data: any; version: number };
          if (!row) return;
          if (Number(row.version) <= versionRef.current) return;
          versionRef.current = Number(row.version);
          if (row.data && typeof row.data === "object") {
            applyRemoteStore(row.data);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      flush();
      unsub();
      if (pushTimer.current) clearTimeout(pushTimer.current);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return status;
}
