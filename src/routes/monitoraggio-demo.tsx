import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/AppShell";
import { getDemoUsers, ADMIN_EMAIL, type DemoUserRow } from "@/lib/admin-monitor.functions";

export const Route = createFileRoute("/monitoraggio-demo")({
  component: MonitoraggioDemoPage,
});

const TRIAL_DAYS = 14;
const DAY = 86400000;

function fmtDate(ms: number | string | null | undefined): string {
  if (!ms) return "—";
  const t = typeof ms === "number" ? ms : new Date(ms).getTime();
  if (!t || isNaN(t)) return "—";
  return new Date(t).toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDuration(ms: number): string {
  if (!ms || ms < 1000) return "0 min";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}
function trialOf(u: DemoUserRow): { start: number | null; end: number | null; daysLeft: number; active: boolean } {
  const start = u.trialStart ?? (u.createdAt ? new Date(u.createdAt).getTime() : null);
  if (!start) return { start: null, end: null, daysLeft: 0, active: false };
  const end = start + TRIAL_DAYS * DAY;
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / DAY));
  return { start, end, daysLeft, active: Date.now() < end };
}

type FilterKey = "all" | "active" | "expired" | "today" | "7d" | "30d";
type SortKey = "lastSeen" | "createdAt" | "daysLeft" | "orders" | "clients" | "totalMs";

function MonitoraggioDemoPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<DemoUserRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("lastSeen");
  const [openId, setOpenId] = useState<string | null>(null);
  const fetchUsers = useServerFn(getDemoUsers);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  const isAdmin = (email ?? "").toLowerCase() === ADMIN_EMAIL;

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const out = await fetchUsers({});
      setRows((out as any).users ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Errore caricamento");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isAdmin) void load(); /* eslint-disable-next-line */ }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const now = Date.now();
    let list = rows.slice();
    if (filter === "active") list = list.filter(u => trialOf(u).active);
    if (filter === "expired") list = list.filter(u => !trialOf(u).active);
    if (filter === "today") list = list.filter(u => u.createdAt && (now - new Date(u.createdAt).getTime()) < DAY);
    if (filter === "7d") list = list.filter(u => u.createdAt && (now - new Date(u.createdAt).getTime()) < 7 * DAY);
    if (filter === "30d") list = list.filter(u => u.createdAt && (now - new Date(u.createdAt).getTime()) < 30 * DAY);
    const get = (u: DemoUserRow): number => {
      switch (sort) {
        case "lastSeen": return u.lastSeen ?? 0;
        case "createdAt": return u.createdAt ? new Date(u.createdAt).getTime() : 0;
        case "daysLeft": return trialOf(u).daysLeft;
        case "orders": return u.counts.orders;
        case "clients": return u.counts.clients;
        case "totalMs": return u.totalMs;
      }
    };
    list.sort((a, b) => get(b) - get(a));
    return list;
  }, [rows, filter, sort]);

  const kpis = useMemo(() => {
    const r = rows ?? [];
    const now = Date.now();
    let active = 0, expired = 0, logins7 = 0;
    let orders = 0, clients = 0, products = 0, deliveries = 0, receipts = 0;
    for (const u of r) {
      if (trialOf(u).active) active++; else expired++;
      if (u.lastSeen && (now - u.lastSeen) < 7 * DAY) logins7++;
      orders += u.counts.orders;
      clients += u.counts.clients;
      products += u.counts.products;
      deliveries += u.counts.deliveries;
      receipts += u.counts.receipts;
    }
    return { total: r.length, active, expired, logins7, orders, clients, products, deliveries, receipts };
  }, [rows]);

  if (email !== null && !isAdmin) {
    return (
      <div>
        <TopBar title="Accesso negato" />
        <div className="p-6 text-sm text-muted-foreground">Questa sezione è riservata.</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Monitoraggio Demo" subtitle={`${filtered.length} utenti visualizzati`}
        right={<button onClick={load} className="text-xs bg-brand-gold text-white rounded-lg px-3 py-1.5 font-semibold">
          {loading ? "…" : "Aggiorna"}
        </button>} />

      {err && <div className="mx-4 md:mx-6 mt-3 p-3 rounded-lg bg-danger/10 text-danger text-sm">{err}</div>}

      {/* KPI */}
      <div className="px-4 md:px-6 mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <Kpi label="Utenti registrati" value={kpis.total} />
        <Kpi label="Trial attivi" value={kpis.active} tone="success" />
        <Kpi label="Trial scaduti" value={kpis.expired} tone="danger" />
        <Kpi label="Accessi ultimi 7gg" value={kpis.logins7} />
        <Kpi label="Ordini totali" value={kpis.orders} />
        <Kpi label="Clienti totali" value={kpis.clients} />
        <Kpi label="Prodotti totali" value={kpis.products} />
        <Kpi label="Consegne totali" value={kpis.deliveries} />
        <Kpi label="Scontrini totali" value={kpis.receipts} />
      </div>

      {/* Filtri & sort */}
      <div className="px-4 md:px-6 mt-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Filtro:</span>
        {(
          [
            ["all","Tutti"],["active","Trial attivi"],["expired","Trial scaduti"],
            ["today","Oggi"],["7d","Ultimi 7gg"],["30d","Ultimi 30gg"],
          ] as [FilterKey, string][]
        ).map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-xs px-2.5 py-1.5 rounded-full border ${filter===k ? "bg-brand-green text-brand-cream border-brand-green" : "bg-white border-border"}`}>{l}</button>
        ))}
        <span className="text-xs text-muted-foreground ml-3">Ordina:</span>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          className="text-xs bg-white border border-border rounded-lg px-2 py-1.5">
          <option value="lastSeen">Ultimo accesso</option>
          <option value="createdAt">Data registrazione</option>
          <option value="daysLeft">Giorni rimanenti</option>
          <option value="orders">N° ordini</option>
          <option value="clients">N° clienti</option>
          <option value="totalMs">Tempo utilizzo</option>
        </select>
      </div>

      {/* Lista utenti */}
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows === null && <div className="text-sm text-muted-foreground">Caricamento…</div>}
        {rows !== null && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">Nessun utente con i filtri scelti.</div>
        )}
        {filtered.map(u => {
          const tr = trialOf(u);
          const open = openId === u.userId;
          return (
            <div key={u.userId} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base text-brand-green truncate">
                    {u.businessName || "(senza nome attività)"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.phone || "—"}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tr.active ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                  {tr.active ? `${tr.daysLeft}g rimanenti` : "Trial scaduto"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Info label="Registrato" value={fmtDate(u.createdAt)} />
                <Info label="Scadenza trial" value={fmtDate(tr.end)} />
                <Info label="Primo accesso" value={fmtDate(u.firstSeen)} />
                <Info label="Ultimo accesso" value={fmtDate(u.lastSeen)} />
                <Info label="Accessi" value={String(u.loginCount)} />
                <Info label="Tempo totale" value={fmtDuration(u.totalMs)} />
              </div>

              <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[11px]">
                <Stat label="Clienti" value={u.counts.clients} />
                <Stat label="Prodotti" value={u.counts.products} />
                <Stat label="Ordini" value={u.counts.orders} />
                <Stat label="Conseg." value={u.counts.deliveries} />
                <Stat label="Scontr." value={u.counts.receipts} />
              </div>

              <button onClick={() => setOpenId(open ? null : u.userId)}
                className="mt-3 text-xs text-brand-gold font-semibold underline underline-offset-2">
                {open ? "Nascondi configurazione" : "Mostra configurazione iniziale"}
              </button>
              {open && (
                <div className="mt-2 bg-brand-cream rounded-lg p-2 text-[11px] text-brand-green">
                  {u.onboarding ? (
                    <ul className="space-y-0.5">
                      {Object.entries(u.onboarding).map(([k, v]) => (
                        <li key={k}>
                          <span className="font-semibold">{k}:</span>{" "}
                          <span className="text-muted-foreground">
                            {Array.isArray(v) ? v.join(", ") : v == null ? "—" : String(v)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Onboarding non ancora completato.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const color =
    tone === "success" ? "text-success"
    : tone === "danger" ? "text-danger"
    : "text-brand-green";
  return (
    <div className="bg-card rounded-xl p-3 border border-border">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`font-display text-2xl ${color}`}>{value}</p>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-brand-cream rounded-lg p-1.5">
      <p className="font-bold text-brand-green text-sm leading-none">{value}</p>
      <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
    </div>
  );
}