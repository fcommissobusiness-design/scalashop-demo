import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCloudSync, useSyncStatus } from "@/lib/cloudSync";

type NavItem = { to: string; label: string; short: string; wip?: boolean };
type NavGroup = { label: string; items: NavItem[] };

export const WIP_ROUTES = new Set<string>(["/produzione", "/food-safety", "/b2b", "/ecommerce"]);

const NAV_GROUPS: NavGroup[] = [
  { label: "Operativo", items: [
    { to: "/", label: "Dashboard", short: "Dashboard" },
    { to: "/ordini", label: "Ordini", short: "Ordini" },
    { to: "/consegne", label: "Consegne", short: "Consegne" },
    { to: "/clienti", label: "Clienti", short: "Clienti" },
    { to: "/offerte", label: "Offerte", short: "Offerte" },
    { to: "/b2b", label: "B2B", short: "B2B", wip: true },
  ]},
  { label: "Magazzino e Prodotti", items: [
    { to: "/magazzino", label: "Magazzino", short: "Magazzino" },
    { to: "/prodotti", label: "Prodotti", short: "Prodotti" },
    { to: "/entrate-merci", label: "Scarico Prodotti", short: "Scarico Prodotti" },
    { to: "/fornitori", label: "Fornitori", short: "Fornitori" },
    { to: "/produzione", label: "Produzione", short: "Produzione", wip: true },
    { to: "/food-safety", label: "Food Safety", short: "Food Safety", wip: true },
  ]},
  { label: "Vendite Online", items: [
    { to: "/ecommerce", label: "E-commerce", short: "E-commerce", wip: true },
  ]},
  { label: "Finanza e Amministrazione", items: [
    { to: "/incassi", label: "Cassa", short: "Cassa" },
    { to: "/fatture", label: "Fatture", short: "Fatture" },
    { to: "/finanza", label: "Finanziario", short: "Finanziario" },
    { to: "/fiscale", label: "Fiscalità", short: "Fiscalità" },
    { to: "/report", label: "Report", short: "Report" },
    { to: "/cestino", label: "Cestino", short: "Cestino" },
    { to: "/admin", label: "Amministrazione", short: "Amministrazione" },
  ]},
];

const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", short: "Dashboard" },
  { to: "/ordini", label: "Ordini", short: "Ordini" },
  { to: "/consegne", label: "Consegne", short: "Consegne" },
  { to: "/clienti", label: "Clienti", short: "Clienti" },
  { to: "/incassi", label: "Cassa", short: "Cassa" },
];

function AuthScreen() {
  const mode = "login" as const;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? "Errore di autenticazione");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-green text-brand-cream px-6">
      <h1 className="font-display text-3xl text-brand-gold mb-1">Sciorio HQ</h1>
      <p className="text-sm opacity-80 mb-8">Caseificio Sciorio dal 1947</p>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3 bg-brand-green-dark/40 p-5 rounded-2xl">
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Email</label>
          <input type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider opacity-80">Password</label>
          <input type="password" autoComplete="current-password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-brand-cream text-brand-green outline-none" />
        </div>
        {err && <p className="text-xs text-red-300">{err}</p>}
        {info && <p className="text-xs text-emerald-300">{info}</p>}
        <button disabled={busy} type="submit"
          className="w-full py-2.5 rounded-lg bg-brand-gold text-brand-green font-semibold disabled:opacity-60">
          {busy ? "…" : "Accedi"}
        </button>
      </form>
      <p className="mt-6 text-[11px] opacity-60 max-w-xs text-center">
        Le registrazioni sono chiuse. Usa le credenziali esistenti — lo stesso account sincronizza i dati su iPhone, PC e tablet.
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

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

  const syncStatus = useCloudSync(userId);

  if (!authReady) return <div className="min-h-screen bg-brand-green" />;
  if (!userId) return <AuthScreen />;
  if (syncStatus === "loading") return (
    <div className="min-h-screen bg-brand-green text-brand-cream flex items-center justify-center text-sm opacity-80">
      Sincronizzazione dati…
    </div>
  );

  const isActive = (to: string) => to === "/" ? path === "/" : path.startsWith(to);

  const isWip = WIP_ROUTES.has(path);

  return (
    <div className="min-h-screen bg-brand-cream md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 bg-brand-green text-brand-cream sticky top-0 h-screen p-4 z-40 overflow-y-auto">
        <div className="px-2 py-3 mb-4 border-b border-brand-cream/10">
          <h1 className="font-display text-2xl text-brand-gold leading-none">Sciorio HQ</h1>
          <p className="text-[11px] opacity-70 mt-1">Caseificio dal 1947</p>
        </div>
        <nav className="flex flex-col gap-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-[10px] uppercase tracking-wider text-brand-cream/50 px-3 mb-1">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = isActive(n.to);
                  return (
                    <Link key={`${g.label}-${n.to}`} to={n.to}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between gap-2 ${active ? "bg-brand-gold/20 text-brand-gold" : "text-brand-cream/80 hover:bg-brand-cream/5"} ${n.wip ? "opacity-60" : ""}`}>
                      <span>{n.label}</span>
                      {n.wip && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-cream/10 text-brand-cream/70">WIP</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Contenuto */}
      <main className="flex-1 pb-24 md:pb-8 md:max-w-6xl md:mx-auto w-full relative">
        <div className={isWip ? "pointer-events-none select-none opacity-40 blur-[1px]" : ""} aria-hidden={isWip}>
          {children}
        </div>
        {isWip && <WipBlocker />}
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-green border-t border-brand-green-dark grid grid-cols-6 z-50 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_PRIMARY.map((n) => {
          const active = isActive(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium tracking-wide transition-colors ${active ? "text-brand-gold" : "text-brand-cream/70 active:text-brand-cream"}`}>
              <span className={`w-1.5 h-1.5 rounded-full mb-1 transition-colors ${active ? "bg-brand-gold" : "bg-transparent"}`} />
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
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 ${active ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/80"} ${n.wip ? "opacity-60" : ""}`}>
                          <span>{n.label}</span>
                          {n.wip && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">WIP</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <SyncBadge />
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
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      className="fixed md:!bottom-3 left-3 md:left-auto md:right-3 z-40 pointer-events-none">
      <div className={`text-[10px] font-semibold px-2 py-1 rounded-full shadow-sm border border-border/50 ${m.color}`}>
        ● {m.label}
      </div>
    </div>
  );
}

function WipBlocker() {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center pt-24 md:pt-32 px-4">
      <div className="bg-brand-cream border-2 border-brand-gold/40 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
        <div className="text-4xl mb-2">🚧</div>
        <h2 className="font-display text-2xl text-brand-green mb-2">Sezione in lavorazione</h2>
        <p className="text-sm text-muted-foreground">Sarà presto disponibile.</p>
      </div>
    </div>
  );
}

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="bg-brand-green text-brand-cream px-5 md:px-8 pt-6 pb-5 md:rounded-b-2xl md:mt-4 md:mx-4 sticky md:static top-0 z-40 flex items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-brand-gold">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm opacity-75 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
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
      className="fixed md:!bottom-8 right-4 md:right-8 w-14 h-14 rounded-full bg-brand-gold text-white text-3xl shadow-lg z-40 flex items-center justify-center font-light hover:scale-105 active:scale-95 transition-transform">
      {label}
    </button>
  );
}
