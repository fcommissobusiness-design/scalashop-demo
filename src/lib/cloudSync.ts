import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoreSnapshot,
  subscribeStore,
  applyRemoteStore,
  isApplyingRemote,
} from "./store";

const PROTECTED_TUTORIAL_USER_ID = "e7a93a94-878e-45de-97eb-5bae42052044";
const hasContent = (store: any) =>
  ["products", "clients", "orders", "casualSales", "deliveries"].some((key) => Array.isArray(store?.[key]) && store[key].length > 0);
const isBlankSnapshot = (store: any) => !hasContent(store);
const normalizeProtectedTutorialSnapshot = (userId: string, store: any) => {
  if (userId !== PROTECTED_TUTORIAL_USER_ID) return store;
  if (!store || typeof store !== "object" || isBlankSnapshot(store)) return store;
  return {
    ...store,
    __clientsSeedV2: true,
    __cleanSeedV3: true,
    __catalogV4: true,
    __demoCleanV5: true,
    __demoCleanV6: true,
    __clientsImportV7: true,
    __demoResetV8: true,
  };
};

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
  // Tiene traccia se l'idratazione iniziale dal cloud è completata.
  // Prima dell'idratazione NON dobbiamo mai pushare lo store locale, perché
  // potrebbe essere vuoto/seed e sovrascriverebbe i dati cloud dell'utente.
  const hydratedRef = useRef<boolean>(false);
  // Conserva il payload del cloud quando esiste, per validare i push
  // futuri ed evitare di sovrascrivere uno stato pieno con uno vuoto.
  const cloudHasContentRef = useRef<boolean>(false);

  // helper combinato per stato locale + condiviso
  const updateStatus = (s: CloudSyncStatus) => { setStatus(s); setSharedStatus(s); };

  useEffect(() => {
    if (!userId) {
      updateStatus("idle");
      return;
    }
    let cancelled = false;
    hydratedRef.current = false;
    cloudHasContentRef.current = false;
    updateStatus("loading");

    const pushNow = async () => {
      if (!userId) return;
      // Non pushare nulla finché l'idratazione iniziale non è completa.
      if (!hydratedRef.current) return;
      if (!pendingRef.current) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      pendingRef.current = false;
      updateStatus("syncing");
      try {
        const snapshot = normalizeProtectedTutorialSnapshot(userId, getStoreSnapshot());
        // Protezione globale: non sovrascriviamo MAI un cloud non vuoto con
        // uno snapshot locale vuoto. Vale per tutti gli utenti (non solo demo).
        if (isBlankSnapshot(snapshot) && cloudHasContentRef.current) {
          console.warn("[cloudSync] blank snapshot blocked (cloud has content)");
          updateStatus("ready");
          return;
        }
        // Bumpiamo la versione PRIMA dell'await così l'evento realtime
        // di ritorno (stessa versione che stiamo per scrivere) non
        // ri-applica lo snapshot a noi stessi (echo loop).
        const nextVersion = versionRef.current + 1;
        versionRef.current = nextVersion;
        const { error } = await supabase
          .from("user_state")
          .update({
            data: snapshot as any,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (error) throw error;
        if (hasContent(snapshot)) cloudHasContentRef.current = true;
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
          if (hasContent(local)) cloudHasContentRef.current = true;
        } else {
          versionRef.current = Number(data.version ?? 1);
          if (data.data && typeof data.data === "object") {
            applyRemoteStore(normalizeProtectedTutorialSnapshot(userId, data.data) as any);
            if (hasContent(data.data)) cloudHasContentRef.current = true;
            // Se lo stato cloud è vecchio (es. import clienti/migrazioni locali),
            // dopo l'idratazione lo ripubblichiamo così anche gli altri device vedono i dati corretti.
            pendingRef.current = true;
          }
        }
        if (cancelled) return;
        hydratedRef.current = true;
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
    // Flush "best-effort" su mobile Safari quando la pagina viene messa in
    // background o chiusa: usa fetch keepalive direttamente verso PostgREST
    // così la richiesta sopravvive all'unload (a differenza dell'await sopra,
    // che il browser interrompe).
    const flushKeepalive = () => {
      if (!userId) return;
      if (!hydratedRef.current) return;
      if (!pendingRef.current) return;
      try {
        const snapshot = normalizeProtectedTutorialSnapshot(userId, getStoreSnapshot());
        if (isBlankSnapshot(snapshot) && cloudHasContentRef.current) return;
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        if (!url || !key) return;
        const token = (() => {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
              const v = JSON.parse(localStorage.getItem(k) || "null");
              if (v?.access_token) return v.access_token as string;
            }
          } catch {}
          return null;
        })();
        const nextVersion = versionRef.current + 1;
        versionRef.current = nextVersion;
        pendingRef.current = false;
        void fetch(`${url}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: token ? `Bearer ${token}` : `Bearer ${key}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            data: snapshot,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch {}
    };
    const onHide = () => { flush(); flushKeepalive(); };
    const onVis = () => { if (document.visibilityState === "hidden") onHide(); };
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);
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
            applyRemoteStore(normalizeProtectedTutorialSnapshot(userId, row.data));
            if (hasContent(row.data)) cloudHasContentRef.current = true;
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      flush();
      unsub();
      if (pushTimer.current) clearTimeout(pushTimer.current);
      window.removeEventListener("beforeunload", onHide);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return status;
}
