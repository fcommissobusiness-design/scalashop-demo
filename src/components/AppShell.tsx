import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCloudSync, useSyncStatus } from "@/lib/cloudSync";
import { OnboardingScreen, hasCompletedOnboarding } from "./OnboardingScreen";
import logoAsset from "@/assets/scalashop-logo.png.asset.json";
import { isLockedPath, getBusinessName, isTrialExpired, ensureTrialStarted, getTrialDaysLeft } from "@/lib/demo-flags";
import { PromoMarquee } from "@/components/PromoMarquee";
import { DemoLockModal } from "@/components/DemoLock";
import { WA_URL } from "@/lib/wa";
import { notifyAdminRegistration } from "@/lib/notify-admin.functions";
import { patchDemoMeta, getDemoMeta } from "@/lib/store";

type NavItem = { to: string; label: string; short: string; locked?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "Operativo", items: [
    { to: "/", label: "Dashboard", short: "Dashboard" },
    { to: "/ordini", label: "Ordini", short: "Ordini" },
    { to: "/scontrini", label: "Scontrini", short: "Scontrini" },
    { to: "/clienti", label: "Clienti", short: "Clienti" },
    { to: "/offerte", label: "Offerte", short: "Offerte", locked: true },
    { to: "/b2b", label: "B2B", short: "B2B", locked: true },
  ]},
  { label: "Magazzino e Prodotti", items: [
    { to: "/magazzino", label: "Magazzino", short: "Magazzino", locked: true },
    { to: "/previsioni-giornaliere", label: "Previsioni giornaliere", short: "Previsioni", locked: true },
    { to: "/prodotti", label: "Prodotti", short: "Prodotti" },
    { to: "/entrate-merci", label: "Scarico Prodotti", short: "Scarico", locked: true },
    { to: "/fornitori", label: "Fornitori", short: "Fornitori", locked: true },
    { to: "/produzione", label: "Produzione", short: "Produzione", locked: true },
    { to: "/food-safety", label: "Food Safety", short: "Food Safety", locked: true },
  ]},
  { label: "Vendite Online", items: [
    { to: "/ecommerce", label: "E-commerce", short: "E-commerce", locked: true },
  ]},
  { label: "Finanza e Amministrazione", items: [
    { to: "/incassi", label: "Cassa", short: "Cassa" },
    { to: "/fatture", label: "Fatture", short: "Fatture", locked: true },
    { to: "/pagamenti", label: "Pagamenti", short: "Pagamenti", locked: true },
    { to: "/finanza", label: "Finanziario", short: "Finanziario", locked: true },
    { to: "/fiscale", label: "Fiscalità", short: "Fiscalità", locked: true },
    { to: "/report", label: "Report", short: "Report", locked: true },
    { to: "/cestino", label: "Cestino", short: "Cestino", locked: true },
    { to: "/admin", label: "Pannello di Controllo", short: "Pannello" },
  ]},
];

const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", short: "Dashboard" },
  { to: "/ordini", label: "Ordini", short: "Ordini" },
  { to: "/scontrini", label: "Scontrini", short: "Scontrini" },
  { to: "/prodotti", label: "Prodotti", short: "Prodotti" },
  { to: "/incassi", label: "Cassa", short: "Cassa" },
];

function AuthScreen({ demoMode = false, onDemoDone }: { demoMode?: boolean; onDemoDone?: () => void } = {}) {
  const [mode, setMode] = useState<"register" | "login" | "recover">("register");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "register") {
        // Validazione esplicita per campo (tutti obbligatori)
        const bn = businessName.trim();
        const ph = phone.trim();
        const em = email.trim();
        if (!bn) throw new Error("Inserisci il Nome attività");
        if (!ph) throw new Error("Inserisci il Recapito telefonico");
        if (!em) throw new Error("Inserisci la tua Email");
        if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error("Email non valida");
        if (!password || password.length < 6) throw new Error("La password deve avere almeno 6 caratteri");

        // Modalità demo (tutorial video): nessuna chiamata reale, torna all'account esistente.
        if (demoMode) {
          onDemoDone?.();
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: em, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { business_name: bn, phone: ph },
          },
        });
        if (error) throw error;
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: em, password });
          if (signInErr) throw signInErr;
        }
        try {
          const u = (await supabase.auth.getSession()).data.session?.user;
          if (u) localStorage.setItem(`scalashop-reg:${u.id}`, JSON.stringify({ businessName: bn, phone: ph }));
        } catch {}
        // Notifica admin (best-effort, non blocca il flusso)
        try {
          await notifyAdminRegistration({
            data: { businessName: bn, phone: ph, email: em },
          });
        } catch (notifyErr) {
          console.error("notifyAdminRegistration failed", notifyErr);
        }
      } else if (mode === "login") {
        if (demoMode) { onDemoDone?.(); return; }
        const em = email.trim();
        if (!em) throw new Error("Inserisci la tua Email");
        if (!password) throw new Error("Inserisci la Password");
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Errore di autenticazione");
    } finally { setBusy(false); }
  };

  if (mode === "recover") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream text-brand-green px-6 py-10">
        <img src={logoAsset.url} alt="ScalaShop" className="h-20 md:h-24 object-contain mb-2" />
        <div className="w-full max-w-sm bg-brand-green-dark/40 text-brand-cream p-6 rounded-2xl text-center">
          <h2 className="font-display text-2xl text-brand-gold mb-2">Richiedi Assistenza</h2>
          <p className="text-sm opacity-90 mb-5">
            Hai dimenticato la password? Contattaci e ti aiuteremo a recuperare l'accesso.
          </p>
          <a
            href="https://wa.me/393883810008"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-brand-gold text-brand-green font-semibold shadow hover:brightness-105 transition"
          >
            💬 Richiedi Assistenza
          </a>
          <button
            type="button"
            onClick={() => { setMode("login"); setErr(null); setInfo(null); }}
            className="mt-4 text-xs underline opacity-80 hover:opacity-100"
          >
            ← Torna al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream text-brand-green px-6 py-10">
      <img src={logoAsset.url} alt="ScalaShop" className="h-20 md:h-24 object-contain mb-2" />
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-xs">Gestionale per gastronomie e botteghe alimentari. Inizia subito, gratis.</p>
      <div className="flex bg-brand-green-dark/10 rounded-full p-1 mb-4 text-xs font-semibold">
        <button type="button" onClick={() => setMode("register")}
          className={`px-4 py-1.5 rounded-full transition ${mode === "register" ? "bg-brand-green text-brand-cream" : "text-brand-green/70"}`}>Registrati</button>
        <button type="button" onClick={() => setMode("login")}
          className={`px-4 py-1.5 rounded-full transition ${mode === "login" ? "bg-brand-green text-brand-cream" : "text-brand-green/70"}`}>Accedi</button>
      </div>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3 bg-brand-green-dark/40 p-5 rounded-2xl">
        {mode === "register" && (
          <>
            <div>
              <label className="text-[11px] uppercase tracking-wider opacity-80">Nome attività</label>
              <input type="text" required value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider opacity-80">Recapito telefonico</label>
              <input type="tel" required value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
            </div>
          </>
        )}
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Email</label>
          <input type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Password</label>
          <input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
        </div>
        {err && <p className="text-xs text-red-300">{err}</p>}
        {info && <p className="text-xs text-emerald-300">{info}</p>}
        <button disabled={busy} type="submit"
          className="w-full py-2.5 rounded-lg bg-brand-gold text-brand-green font-semibold disabled:opacity-60">
          {busy ? "…" : mode === "register" ? "Registrati" : "Accedi"}
        </button>
        {mode === "login" && (
          <button
            type="button"
            onClick={() => { setMode("recover"); setErr(null); setInfo(null); }}
            className="w-full text-center text-[12px] text-brand-cream/90 underline underline-offset-2 hover:text-brand-gold transition"
          >
            Recupera Password
          </button>
        )}
      </form>
      <p className="mt-6 text-[11px] opacity-60 max-w-xs text-center">
        Lo stesso account sincronizza ordini, clienti, cassa e magazzino su iPhone, PC e tablet.
      </p>
      <p className="mt-3 text-[11px] opacity-60 text-center">
        <a href="/privacy" className="underline hover:opacity-100">Privacy</a>
        <span className="mx-2">·</span>
        <a href="/cookie" className="underline hover:opacity-100">Cookie</a>
      </p>
    </div>
  );
}

function DemoAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? "Errore di accesso");
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="w-full max-w-xs space-y-3 bg-brand-green-dark/40 p-5 rounded-2xl text-brand-cream">
      <div>
        <label className="text-[11px] uppercase tracking-wider opacity-80">Email admin</label>
        <input type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider opacity-80">Password</label>
        <input type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
      <button disabled={busy} type="submit"
        className="w-full py-2.5 rounded-lg bg-brand-gold text-brand-green font-semibold disabled:opacity-60">
        {busy ? "…" : "Accedi come admin"}
      </button>
    </form>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const [onbTick, setOnbTick] = useState(0);
  const trackedSessionRef = useRef<string | null>(null);
  const [demoRegister, setDemoRegister] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("demo-register") === "1") {
        url.searchParams.delete("demo-register");
        window.history.replaceState({}, "", url.toString());
        // Attiviamo il flag solo se ci sarà un check admin lato app
        // (gestito sotto). Conserviamo l'intento in sessionStorage che
        // verrà ripulito dal gate `!isAdmin && demoRegister` per non
        // intrappolare utenti reali.
        sessionStorage.setItem("scalashop-demo-register", "1");
        return true;
      }
      return sessionStorage.getItem("scalashop-demo-register") === "1";
    } catch { return false; }
  });

  // Se l'utente NON è admin e ha (accidentalmente) il flag demo-register,
  // ripulisci automaticamente per non bloccarlo sul gate.
  useEffect(() => {
    if (!userId) return;
    if (!adminReady) return;
    if (demoRegister && !isAdminAccount) {
      try { sessionStorage.removeItem("scalashop-demo-register"); } catch {}
      setDemoRegister(false);
    }
  }, [userId, adminReady, isAdminAccount, demoRegister]);
  const [demoStep, setDemoStep] = useState<"register" | "onboarding">("register");

  useEffect(() => {
    const h = () => setOnbTick(t => t + 1);
    window.addEventListener("scalashop-onboarded", h);
    return () => window.removeEventListener("scalashop-onboarded", h);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsAdminAccount(false);
      setAdminReady(true);
      trackedSessionRef.current = null;
      return;
    }
    let cancelled = false;
    setAdminReady(false);
    void (async () => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (!cancelled) setIsAdminAccount(data?.role === "admin");
      } catch {
        if (!cancelled) setIsAdminAccount(false);
      } finally {
        if (!cancelled) setAdminReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const syncStatus = useCloudSync(userId);

  // Avvia il trial alla PRIMA entrata effettiva nella demo (dopo registrazione + onboarding).
  useEffect(() => {
    if (!userId) return;
    if (hasCompletedOnboarding(userId)) {
      const t = ensureTrialStarted(userId);
      try {
        const m = getDemoMeta();
        if (!m.trialStart) patchDemoMeta({ trialStart: t });
      } catch {}
    }
  }, [userId]);

  // Tracking accessi / tempo totale (minimo overhead: 1 push debounced ad ogni
  // login + 1 al cambio di visibilità o unload).
  useEffect(() => {
    if (!userId || syncStatus === "loading") return;
    if (trackedSessionRef.current === userId) return;
    trackedSessionRef.current = userId;
    const now = Date.now();
    const m = getDemoMeta();
    patchDemoMeta({
      firstSeen: m.firstSeen ?? now,
      lastSeen: now,
      loginCount: (m.loginCount ?? 0) + 1,
    });
    let start = now;
    const flush = () => {
      const elapsed = Date.now() - start;
      if (elapsed < 1000) return;
      const cur = getDemoMeta();
      patchDemoMeta({
        totalMs: (cur.totalMs ?? 0) + elapsed,
        lastSeen: Date.now(),
      });
      start = Date.now();
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); else start = Date.now(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, syncStatus]);

  if (!authReady) return <div className="min-h-screen bg-brand-green" />;
  // La demo non deve entrare direttamente: senza login mostriamo la schermata Registrati/Accedi.
  if (!userId) return <AuthScreen />;
  const effectiveUserId = userId;
  if (userId && syncStatus === "loading") return (
    <div className="min-h-screen bg-brand-green text-brand-cream flex items-center justify-center text-sm opacity-80">
      Sincronizzazione dati…
    </div>
  );
  void onbTick;
  if (!adminReady) return (
    <div className="min-h-screen bg-brand-green text-brand-cream flex items-center justify-center text-sm opacity-80">
      Caricamento account…
    </div>
  );
  const isAdmin = isAdminAccount;
  // Demo registrazione (per video tutorial): la modalità è ATTIVA finché il flag
  // sessionStorage è presente. In modalità demo NON viene mai creato un account reale,
  // anche se l'utente non è loggato come admin: in tal caso mostriamo prima un gate
  // che chiede di accedere come admin, così la "registrazione" finta non crea nulla
  // e alla fine si rientra nell'account admin esistente.
  if (demoRegister && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream text-brand-green px-6 py-10">
        <img src={logoAsset.url} alt="ScalaShop" className="h-20 md:h-24 object-contain mb-2" />
        <div className="w-full max-w-sm bg-brand-green-dark/40 text-brand-cream p-5 rounded-2xl text-center mb-4">
          <h2 className="font-display text-lg text-brand-gold mb-1">Modalità DEMO registrazione</h2>
          <p className="text-xs opacity-90">
            Per evitare di creare un account reale durante il video tutorial,
            accedi prima con il tuo account admin. Dopo il login la demo
            partirà automaticamente.
          </p>
        </div>
        <DemoAdminLogin />
        <button
          type="button"
          onClick={() => {
            try { sessionStorage.removeItem("scalashop-demo-register"); } catch {}
            setDemoRegister(false);
          }}
          className="mt-4 text-[11px] underline opacity-70 hover:opacity-100"
        >
          Annulla demo registrazione
        </button>
      </div>
    );
  }
  if (isAdmin && demoRegister) {
    if (demoStep === "register") {
      return (
        <AuthScreen
          demoMode
          onDemoDone={() => setDemoStep("onboarding")}
        />
      );
    }
    return (
      <OnboardingScreen
        userId={effectiveUserId}
        demoMode
        onDone={() => {
          try { sessionStorage.removeItem("scalashop-demo-register"); } catch {}
          setDemoStep("register");
          setDemoRegister(false);
        }}
      />
    );
  }
  if (!isAdmin && !hasCompletedOnboarding(effectiveUserId)) {
    return <OnboardingScreen userId={effectiveUserId} onDone={() => window.dispatchEvent(new Event("scalashop-onboarded"))} />;
  }

  const isActive = (to: string) => to === "/" ? path === "/" : path.startsWith(to);

  const locked = isLockedPath(path);
  const businessName = getBusinessName(effectiveUserId) || (isAdmin ? "ScalaShop" : "");
  const trialExpired = !isAdmin && isTrialExpired(effectiveUserId);

  const onLogout = async () => {
    if (!confirm("Vuoi davvero uscire?")) return;
    try { await supabase.auth.signOut(); } catch {}
    // Pulisce qualunque dato locale del precedente utente per evitare che
    // un nuovo login (su stesso device/browser) erediti lo store del precedente.
    try {
      const keep = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-") || k.startsWith("supabase")) keep.add(k);
      }
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !keep.has(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      try { sessionStorage.clear(); } catch {}
    } catch {}
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Sidebar desktop premium */}
      <aside className="hidden md:flex md:flex-col w-64 bg-sidebar-premium text-brand-cream sticky top-0 h-screen p-4 z-40 overflow-y-auto border-r border-white/5">
        <div className="px-2 py-4 mb-5 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/95 shadow-md shadow-black/20 flex items-center justify-center p-1">
            <img src={logoAsset.url} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl text-brand-gold leading-none tracking-tight">ScalaShop</h1>
            <p className="text-[10px] opacity-70 mt-1 truncate max-w-[10rem] uppercase tracking-wider">
              {businessName || "La tua attività"}
            </p>
          </div>
        </div>
        <nav className="flex flex-col gap-5">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold px-3 mb-2">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = isActive(n.to);
                  return (
                    <Link key={`${g.label}-${n.to}`} to={n.to}
                      data-active={active ? "true" : "false"}
                      className={`nav-link ${n.locked ? "opacity-70" : ""}`}>
                      <span>{n.label}</span>
                      {n.locked && <span title="Disponibile con il piano a pagamento" className="text-[10px] leading-none opacity-80">🔒</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {isAdmin && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold px-3 mb-2">Amministrazione</p>
              <Link to="/monitoraggio-demo"
                data-active={isActive("/monitoraggio-demo") ? "true" : "false"}
                className="nav-link">
                <span>Monitoraggio</span>
                <span className="text-[10px]">👑</span>
              </Link>
            </div>
          )}
          <div className="mt-auto pt-5 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold px-3 mb-2">Account</p>
            <button onClick={onLogout}
              className="nav-link w-full text-left">
              <span>Logout</span>
              <span aria-hidden className="text-[11px] opacity-80">⎋</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Contenuto */}
      <main className="flex-1 pb-24 md:pb-8 md:max-w-6xl md:mx-auto w-full relative">
        <PromoMarquee />
        <GlobalTrialBanner userId={effectiveUserId} />
        {businessName && (
          <div className="hidden md:flex justify-end px-6 pt-4 -mb-1">
            <span className="app-chip">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
              {businessName}
            </span>
          </div>
        )}
        {locked ? <LockedOverlayWrapper>{children}</LockedOverlayWrapper> : children}
      </main>

      {/* Bottom nav mobile premium */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bottom-nav-premium grid grid-cols-6 z-50 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_PRIMARY.map((n) => {
          const active = isActive(n.to);
          return (
            <Link key={n.to} to={n.to} data-active={active ? "true" : "false"}
              className="bottom-nav-item flex flex-col items-center justify-center py-2.5 text-[10px] font-semibold tracking-wide text-white/60 transition-colors">
              <span className="indicator w-1.5 h-1.5 rounded-full mb-1 transition-all bg-transparent" />
              {n.short}
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium tracking-wide transition-colors ${moreOpen ? "text-brand-gold" : "text-brand-cream/70 active:text-brand-cream"}`}>
          <span className="w-1.5 h-1.5 rounded-full mb-1 bg-transparent" />
          Più
        </button>
      </nav>

      {/* Più sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="bg-brand-cream w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="font-display text-lg text-brand-green mb-3">Tutte le sezioni</p>
            <div className="space-y-3">
              {NAV_GROUPS.map(g => (
                <div key={g.label}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{g.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map(n => {
                      const active = isActive(n.to);
                      return (
                        <Link key={`${g.label}-${n.to}`} to={n.to} onClick={() => setMoreOpen(false)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 border-2 transition ${active ? "bg-brand-green text-brand-cream border-brand-green" : "bg-card text-foreground/80 border-brand-green/20 hover:border-brand-gold/40"} ${n.locked ? "opacity-70" : ""}`}>
                          <span>{n.label}</span>
                          {n.locked && <span title="Disponibile con il piano a pagamento" className="text-[10px] leading-none">🔒</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              {isAdmin && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Amministrazione</p>
                  <Link to="/monitoraggio-demo" onClick={() => setMoreOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand-gold/15 text-brand-green flex items-center justify-between">
                    <span>Monitoraggio</span><span>👑</span>
                  </Link>
                </div>
              )}
              <div className="pt-2">
                <button onClick={() => { setMoreOpen(false); onLogout(); }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold bg-card text-foreground/80 border border-border text-left flex items-center justify-between">
                  <span>Logout</span><span aria-hidden>⎋</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SyncBadge />
      <SupportButton />
      <DemoLockModal />
      {trialExpired && <TrialExpiredOverlay />}
    </div>
  );
}

/** Avvolge una scheda bloccata: rende la pagina reale ma sbiadita, con banner premium centrale. */
function LockedOverlayWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="opacity-50 blur-[2px] pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 z-30 flex items-start justify-center pt-16 md:pt-24 px-4">
        <div className="bg-brand-cream border-2 border-brand-gold/50 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-2xl mb-3">🔒</div>
          <h2 className="font-display text-xl md:text-2xl text-brand-green mb-2">
            Funzionalità disponibile nel piano a pagamento
          </h2>
          <p className="text-sm text-foreground/80">
            Per sbloccare questa sezione attiva il piano a pagamento di ScalaShop.
          </p>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-brand-gold text-white text-sm font-semibold shadow hover:brightness-105 transition">
            Attivalo Ora
          </a>
        </div>
      </div>
    </div>
  );
}

/** Pulsante flottante "Richiedi Assistenza" sempre visibile, apre WhatsApp. */
function SupportButton() {
  const supportUrl = `${WA_URL}?text=${encodeURIComponent("Ciao, ho bisogno di assistenza per ScalaShop")}`;
  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      className="fixed md:!bottom-3 left-3 md:right-auto z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-brand-green text-brand-cream text-[11px] font-semibold shadow-lg border border-brand-gold/40 hover:brightness-110 transition"
      aria-label="Richiedi Assistenza"
    >
      <span aria-hidden>💬</span> Richiedi Assistenza
    </a>
  );
}

/** Overlay che blocca tutta la demo al termine dei 14 giorni di trial. */
function TrialExpiredOverlay() {
  return (
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brand-cream border-2 border-brand-gold/60 rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-3xl mb-3">🎉</div>
        <h2 className="font-display text-xl md:text-2xl text-brand-green mb-2 leading-tight">
          Congratulazioni, hai terminato il periodo di prova di 14 giorni.
        </h2>
        <p className="text-sm text-foreground/80">
          Continua a usare ScalaShop per 1 anno con il piano a pagamento.
        </p>
        <p className="text-xs text-brand-green/80 mt-2 font-semibold">
          Per te, solo fino al 31/07/2026, il 20% di sconto.
        </p>
        <a href={WA_URL} target="_blank" rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-brand-gold text-white text-sm font-bold shadow hover:brightness-105 transition">
          Attivalo Ora
        </a>
      </div>
    </div>
  );
}

function SyncBadge() {
  const s = useSyncStatus();
  const map: Record<string, { label: string; color: string }> = {
    idle:    { label: "—",                 color: "bg-muted text-muted-foreground" },
    loading: { label: "Caricamento…",       color: "bg-warning/20 text-warning" },
    syncing: { label: "Sincronizzazione…",  color: "bg-warning/20 text-warning" },
    ready:   { label: "Salvato",            color: "bg-success/15 text-success" },
    offline: { label: "Offline · non sync.", color: "bg-danger/15 text-danger" },
    error:   { label: "Errore sync",        color: "bg-danger/15 text-danger" },
  };
  const m = map[s] ?? map.idle;
  return (
    <div
      style={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom))" }}
      className="hidden md:block fixed md:!bottom-3 right-3 md:left-auto z-40 pointer-events-none">
      <div className={`text-[10px] font-semibold px-2 py-1 rounded-full shadow-sm border border-border/50 ${m.color}`}>
        ● {m.label}
      </div>
    </div>
  );
}

/** Banner trial globale: appare subito sotto la barra dinamica su ogni scheda. */
function GlobalTrialBanner({ userId }: { userId: string }) {
  const remaining = getTrialDaysLeft(userId);
  // Uso illimitato: il banner di countdown non viene mai mostrato.
  if (remaining >= 0) return null;
  return (
    <div className="px-3 md:px-6 pt-1 md:pt-3 -mt-1 md:mt-0">
      <div className="rounded-xl px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-2 md:gap-3 shadow-sm"
           style={{ background: "linear-gradient(135deg, var(--brand-green), var(--brand-green-dark))" }}>
        <div className="text-brand-cream min-w-0">
          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-brand-gold font-bold leading-none">Demo gratuita ScalaShop</p>
          <p className="text-[11px] md:text-sm mt-0.5 md:mt-1 leading-snug truncate">
            Ti restano <span className="text-brand-gold font-bold">{remaining} giorn{remaining === 1 ? "o" : "i"}</span>
            <span className="hidden md:inline"> per testare il nuovo sistema operativo della tua attività.</span>
          </p>
        </div>
        <a href={WA_URL} target="_blank" rel="noopener noreferrer"
           className="shrink-0 inline-flex items-center justify-center px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg bg-brand-gold text-white text-[11px] md:text-xs font-bold shadow hover:brightness-105 transition">
          Attivalo Ora
        </a>
      </div>
    </div>
  );
}

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-premium-hero text-brand-cream px-5 md:px-8 pt-8 pb-7 md:rounded-2xl md:mt-4 md:mx-4 sticky md:static top-0 z-40 flex items-start justify-between gap-3 shadow-[0_20px_40px_-24px_rgba(26,46,74,0.4),0_1px_0_rgba(255,255,255,0.06)_inset] border border-white/5">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-10 right-0 h-40 w-40 rounded-full bg-brand-gold/20 blur-3xl" />
      </div>
      <div className="relative">
        <h1 className="font-display text-3xl md:text-4xl text-brand-gold tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-[11px] md:text-xs opacity-70 mt-2 uppercase tracking-[0.14em] font-medium">{subtitle}</p>}
      </div>
      {right && <div className="relative shrink-0">{right}</div>}
    </header>
  );
}

export function formatEuro(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

/* Sheet/modal responsive: bottom-sheet su mobile, dialog centrato su desktop, footer sticky. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-0 md:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-brand-cream w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl max-h-[92vh] md:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-brand-green text-brand-cream px-5 py-4 flex justify-between items-center shrink-0">
          <h2 className="font-display text-xl text-brand-gold">{title}</h2>
          <button onClick={onClose} className="text-brand-cream text-2xl leading-none px-2">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border bg-brand-cream px-4 md:px-6 py-3 md:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Fab({ onClick, label = "+" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick}
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      className="fab-premium fixed md:!bottom-8 right-4 md:right-8 w-16 h-16 rounded-full text-brand-green text-3xl z-40 flex items-center justify-center font-light hover:scale-[1.04] active:scale-95 transition-transform">
      {label}
    </button>
  );
}
