import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatDate, formatEuro } from "@/components/AppShell";
import {
  type Production, type ProductionStatus, type FreshLog, type UnsoldEntry,
  type SpecialDay, type SpecialDayImpact, type UnsoldDestination,
  type BusinessHours, type WeekdayKey, type DayHours,
  WEEKDAYS, WEEKDAY_LABEL, UNSOLD_DESTINATION_LABEL,
} from "@/lib/data";
import { mozzarellaKgForDate, productionsForDate } from "@/lib/metrics";
import {
  freshProducts, freshLogsForDate, freshLogFor, missingLogDays,
  unsoldStatsForDate, suggestQuantity, isClosedDay, specialDayFor,
} from "@/lib/production";

export const Route = createFileRoute("/produzione")({ component: ProduzionePage });

const STATUS_LABEL: Record<ProductionStatus, string> = {
  da_preparare: "Da preparare", preparato: "Preparato", completato: "Completato",
};
const STATUS_STYLE: Record<ProductionStatus, string> = {
  da_preparare: "bg-warning/15 text-warning",
  preparato: "bg-blue-600/15 text-blue-700",
  completato: "bg-success/15 text-success",
};
const RISK_STYLE: Record<"basso" | "medio" | "alto", string> = {
  basso: "bg-success/15 text-success",
  medio: "bg-warning/15 text-warning",
  alto: "bg-danger/15 text-danger",
};

const toDay = (iso: string) => iso.slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);
const tomorrowIso = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

type Tab = "pian" | "freschi" | "invenduto" | "sugg" | "cal";

function ProduzionePage() {
  const [tab, setTab] = useState<Tab>("pian");

  return (
    <div>
      <TopBar title="Produzione" subtitle="Pianificazione, freschi, invenduto, suggerimenti" />
      <div className="px-4 md:px-6 pt-3 flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "pian", label: "Pianificazione" },
          { id: "freschi", label: "Freschi giornaliero" },
          { id: "invenduto", label: "Invenduto" },
          { id: "sugg", label: "Suggerimenti" },
          { id: "cal", label: "Calendario" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pian" && <PianificazioneTab />}
      {tab === "freschi" && <FreschiTab />}
      {tab === "invenduto" && <InvendutoTab />}
      {tab === "sugg" && <SuggerimentiTab />}
      {tab === "cal" && <CalendarioTab />}
    </div>
  );
}

// ======================== TAB PIANIFICAZIONE ========================

function PianificazioneTab() {
  const { productions, products, orders, addProduction, updateProduction, deleteProduction,
          businessHours, specialDays, freshLogs, unsoldEntries } = useStore();
  const [day, setDay] = useState(() => todayIso());
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const todays = useMemo(() => productions.filter(p => toDay(p.date) === day)
    .sort((a, b) => a.productId.localeCompare(b.productId)), [productions, day]);

  const mozzaKg = mozzarellaKgForDate(productions, products, day + "T00:00");
  const totItems = todays.reduce((s, p) => s + p.qtyPlanned, 0);
  const fatti = todays.filter(p => p.status === "completato").length;

  const dayOrders = orders.filter(o => o.status !== "annullato" && toDay(o.pickupDate) === day);
  const sugg = new Map<string, number>();
  dayOrders.forEach(o => o.items.forEach(i => sugg.set(i.productId, (sugg.get(i.productId) ?? 0) + i.qty)));

  const closed = isClosedDay(day, businessHours, specialDays);
  const sp = specialDayFor(day, specialDays);

  // KPI freschi/invenduto ieri
  const yesterdayIso = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const freshMonitored = freshProducts(products).length;
  const yStats = unsoldStatsForDate(unsoldEntries, yesterdayIso);
  const tgtgBoxesTot = unsoldEntries.filter(e => e.destination === "tgtg")
    .reduce((s, e) => s + (e.tgtgBoxes ?? 0), 0);
  const missingDays = missingLogDays(freshLogs, products, businessHours, specialDays, 7);

  return (
    <div>
      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Mozzarella giorno" value={`${mozzaKg.toFixed(1)} kg`} highlight />
        <Kpi label="Righe totali" value={String(todays.length)} />
        <Kpi label="Pezzi/Kg pianificati" value={totItems.toFixed(1)} />
        <Kpi label="Completati" value={`${fatti}/${todays.length}`} />
      </div>

      <div className="px-4 md:px-6 pb-2 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Freschi monitorati" value={String(freshMonitored)} />
        <Kpi label="Invenduto ieri" value={`${yStats.qty.toFixed(1)}`} />
        <Kpi label="Valore perso ieri" value={formatEuro(yStats.valueLost)} />
        <Kpi label="Recuperato ieri" value={formatEuro(yStats.valueRecovered)} />
        <Kpi label="Box TGTG totali" value={`${tgtgBoxesTot}${missingDays.length ? ` · ${missingDays.length} gg da compl.` : ""}`} />
      </div>

      <div className="px-4 md:px-6 flex items-center gap-3 pb-2">
        <input type="date" value={day} onChange={e => setDay(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        {sugg.size > 0 && (
          <p className="text-xs text-muted-foreground">{sugg.size} prodotti richiesti dagli ordini</p>
        )}
      </div>

      {closed.closed && (
        <div className="mx-4 md:mx-6 mb-3 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
          ⚠ Negozio chiuso ({closed.reason}). Stai pianificando produzione per un giorno chiuso.
        </div>
      )}
      {sp && !closed.closed && (
        <div className="mx-4 md:mx-6 mb-3 bg-brand-gold/15 text-brand-green rounded-xl p-3 text-sm">
          📅 {sp.name} — impatto {sp.impact}, moltiplicatore ×{sp.multiplier}
        </div>
      )}

      {sugg.size > 0 && (
        <div className="mx-4 md:mx-6 mb-3 bg-brand-cream-dark/40 rounded-xl p-3">
          <p className="text-xs uppercase font-bold text-brand-green mb-2">Suggerimento da ordini</p>
          <div className="flex flex-wrap gap-2">
            {[...sugg.entries()].map(([pid, qty]) => {
              const prod = products.find(p => p.id === pid);
              if (!prod) return null;
              const already = todays.filter(t => t.productId === pid).reduce((s, t) => s + t.qtyPlanned, 0);
              const missing = qty - already;
              if (missing <= 0) return null;
              return (
                <button key={pid} onClick={() => addProduction({
                  date: new Date(day + "T07:00").toISOString(),
                  productId: pid, qtyPlanned: missing, status: "da_preparare",
                  orderIds: dayOrders.filter(o => o.items.some(i => i.productId === pid)).map(o => o.id),
                })}
                  className="text-xs bg-card border border-border rounded-full px-3 py-1.5">
                  + {prod.name} · {missing.toFixed(1)} {prod.unit}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {todays.length === 0 && <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">Nessuna produzione pianificata.</p>}
        {todays.map(p => {
          const prod = products.find(x => x.id === p.productId);
          return (
            <div key={p.id} className="bg-card rounded-xl p-4 shadow-sm">
              <button onClick={() => setEditId(p.id)} className="w-full text-left">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-display text-lg text-brand-green leading-tight">{prod?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      Pianificato: {p.qtyPlanned} {prod?.unit ?? ""}
                      {p.qtyActual !== undefined && ` · Effettivo: ${p.qtyActual}`}
                    </p>
                    {p.orderIds && p.orderIds.length > 0 && (
                      <p className="text-xs text-brand-green mt-1">Per {p.orderIds.length} ordin{p.orderIds.length === 1 ? "e" : "i"}</p>
                    )}
                    {p.notes && <p className="text-xs italic text-muted-foreground mt-1">{p.notes}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
              </button>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {p.status === "da_preparare" && (
                  <button onClick={() => updateProduction(p.id, { status: "preparato" })}
                    className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 font-semibold">Preparato</button>
                )}
                {p.status !== "completato" && (
                  <button onClick={() => updateProduction(p.id, { status: "completato", qtyActual: p.qtyActual ?? p.qtyPlanned })}
                    className="flex-1 text-xs bg-success text-white rounded-lg py-1.5 font-semibold">Completato</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <ProdSheet day={day} mode="new"
        onClose={() => setOpenNew(false)}
        onSave={(d) => { addProduction(d as Omit<Production, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const p = productions.find(x => x.id === editId);
        if (!p) return null;
        return (
          <ProdSheet day={day} mode="edit" production={p}
            onClose={() => setEditId(null)}
            onSave={(patch) => { updateProduction(p.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm("Eliminare?")) { deleteProduction(p.id); setEditId(null); } }} />
        );
      })()}
    </div>
  );
}

// ======================== TAB FRESCHI GIORNALIERO ========================

function FreschiTab() {
  const { products, freshLogs, addFreshLog, updateFreshLog, deleteFreshLog,
          businessHours, specialDays } = useStore();
  const [day, setDay] = useState(() => todayIso());
  const [editId, setEditId] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null); // productId

  const fresh = freshProducts(products);
  const dayLogs = freshLogsForDate(freshLogs, day);
  const missing = useMemo(() => missingLogDays(freshLogs, products, businessHours, specialDays, 7),
    [freshLogs, products, businessHours, specialDays]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={day} onChange={e => setDay(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        <p className="text-xs text-muted-foreground">{fresh.length} prodotti freschi monitorati</p>
      </div>

      {missing.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm text-warning">
          <strong>Giornate da completare:</strong>{" "}
          {missing.slice(0, 5).map((d) => (
            <button key={d} onClick={() => setDay(d)} className="underline mx-1">{d}</button>
          ))}
          {missing.length > 5 && <span> +{missing.length - 5}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fresh.map((p) => {
          const log = freshLogFor(freshLogs, p.id, day);
          return (
            <div key={p.id} className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base text-brand-green">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Deperibilità: {p.perishability ?? "—"} · Durata: {p.shelfLifeDays ?? "—"}g
                  </p>
                </div>
                {log
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">REGISTRATO</span>
                  : <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">DA REGISTRARE</span>}
              </div>
              {log && (
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
                  <Mini label="Inizio" v={log.qtyStart} unit={p.unit} />
                  <Mini label="Vendute" v={log.qtySold} unit={p.unit} />
                  <Mini label="Recup." v={log.qtyRecovered} unit={p.unit} />
                  <Mini label="Scarto" v={log.qtyDiscarded} unit={p.unit} />
                </div>
              )}
              <div className="flex gap-2 mt-3">
                {log
                  ? <>
                      <button onClick={() => setEditId(log.id)} className="flex-1 text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 font-semibold">Modifica</button>
                      <button onClick={() => { if (confirm("Eliminare?")) deleteFreshLog(log.id); }}
                        className="text-xs text-danger border border-danger/40 rounded-lg px-2 py-1.5 font-semibold">Elim.</button>
                    </>
                  : <button onClick={() => setOpenFor(p.id)} className="flex-1 text-xs bg-brand-gold text-white rounded-lg py-1.5 font-semibold">+ Registra</button>}
              </div>
            </div>
          );
        })}
        {fresh.length === 0 && (
          <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">
            Nessun prodotto fresco. Marca un prodotto come "fresco" dalla scheda Prodotti.
          </p>
        )}
      </div>

      {openFor && (
        <FreshLogSheet day={day} productId={openFor} mode="new"
          onClose={() => setOpenFor(null)}
          onSave={(d) => { addFreshLog(d as Omit<FreshLog, "id">); setOpenFor(null); }} />
      )}
      {editId && (() => {
        const log = freshLogs.find((l) => l.id === editId);
        if (!log) return null;
        return (
          <FreshLogSheet day={day} productId={log.productId} mode="edit" log={log}
            onClose={() => setEditId(null)}
            onSave={(patch) => { updateFreshLog(log.id, patch); setEditId(null); }} />
        );
      })()}
    </div>
  );
}

function Mini({ label, v, unit }: { label: string; v: number; unit: string }) {
  return (
    <div className="bg-brand-cream-dark/40 rounded-lg py-1.5">
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold text-brand-green text-sm">{v.toFixed(unit === "kg" ? 1 : 0)}</p>
    </div>
  );
}

function FreshLogSheet({ day, productId, mode, log, onClose, onSave }: {
  day: string; productId: string; mode: "new" | "edit"; log?: FreshLog;
  onClose: () => void; onSave: (d: Omit<FreshLog, "id"> | Partial<FreshLog>) => void;
}) {
  const { products } = useStore();
  const product = products.find((p) => p.id === productId);
  const [qtyStart, setQtyStart] = useState(log?.qtyStart ?? 0);
  const [qtySold, setQtySold] = useState(log?.qtySold ?? 0);
  const [qtyRecovered, setQtyRecovered] = useState(log?.qtyRecovered ?? 0);
  const [qtyDiscarded, setQtyDiscarded] = useState(log?.qtyDiscarded ?? 0);
  const [notes, setNotes] = useState(log?.notes ?? "");

  const left = +(qtyStart - qtySold - qtyRecovered - qtyDiscarded).toFixed(2);

  const save = () => {
    onSave({
      date: log?.date ?? new Date(day + "T20:00").toISOString(),
      productId,
      qtyStart: +qtyStart, qtySold: +qtySold,
      qtyRecovered: +qtyRecovered, qtyDiscarded: +qtyDiscarded,
      qtyLeft: left > 0 ? left : 0,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={`${mode === "new" ? "Registra" : "Modifica"} — ${product?.name ?? ""}`}
      footer={<button onClick={save} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma</button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Inizio giornata (${product?.unit ?? ""})`}>
          <input type="number" step="0.1" value={qtyStart} onChange={(e) => setQtyStart(+e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label={`Vendute (${product?.unit ?? ""})`}>
          <input type="number" step="0.1" value={qtySold} onChange={(e) => setQtySold(+e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label={`Recuperato/scontato (${product?.unit ?? ""})`}>
          <input type="number" step="0.1" value={qtyRecovered} onChange={(e) => setQtyRecovered(+e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label={`Scartato (${product?.unit ?? ""})`}>
          <input type="number" step="0.1" value={qtyDiscarded} onChange={(e) => setQtyDiscarded(+e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Rimasto fine giornata: </span>
        <strong className={left < 0 ? "text-danger" : "text-brand-green"}>
          {left.toFixed(product?.unit === "kg" ? 1 : 0)} {product?.unit}
        </strong>
        {left < 0 && <span className="text-danger text-xs"> (incoerente!)</span>}
      </p>
      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

// ======================== TAB INVENDUTO ========================

function InvendutoTab() {
  const { products, unsoldEntries, addUnsoldEntry, updateUnsoldEntry, deleteUnsoldEntry } = useStore();
  const [day, setDay] = useState(() => todayIso());
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const dayEntries = unsoldEntries.filter((e) => e.date.slice(0, 10) === day);
  const stats = unsoldStatsForDate(unsoldEntries, day);
  const top = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of unsoldEntries) m.set(e.productId, (m.get(e.productId) ?? 0) + e.qty);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [unsoldEntries]);

  // KPI TGTG totali
  const tgtg = unsoldEntries.filter((e) => e.destination === "tgtg");
  const tgtgKpi = {
    boxes: tgtg.reduce((s, e) => s + (e.tgtgBoxes ?? 0), 0),
    valueLost: tgtg.reduce((s, e) => s + (e.valueLost ?? 0), 0),
    valueRecovered: tgtg.reduce((s, e) => s + (e.valueRecovered ?? 0), 0),
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        <button onClick={() => setOpenNew(true)} className="bg-brand-gold text-white rounded-lg px-3 py-2 text-sm font-semibold">+ Registra invenduto</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Voci giorno" value={String(stats.count)} />
        <Kpi label="Valore perso" value={formatEuro(stats.valueLost)} />
        <Kpi label="Valore recuperato" value={formatEuro(stats.valueRecovered)} />
        <Kpi label="Box TGTG" value={String(stats.tgtgBoxes)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4">
          <h3 className="font-display text-base text-brand-green mb-2">Too Good To Go (totale)</h3>
          <div className="text-sm space-y-1">
            <p>Box vendute: <strong>{tgtgKpi.boxes}</strong></p>
            <p>Valore teorico perso: <strong>{formatEuro(tgtgKpi.valueLost)}</strong></p>
            <p>Recuperato: <strong className="text-success">{formatEuro(tgtgKpi.valueRecovered)}</strong></p>
            <p className="text-xs text-muted-foreground italic">
              {tgtgKpi.valueLost > 0
                ? `Recupero ${(tgtgKpi.valueRecovered / tgtgKpi.valueLost * 100).toFixed(0)}% del valore.`
                : "Nessuna voce TGTG registrata."}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4">
          <h3 className="font-display text-base text-brand-green mb-2">Più spesso invenduti</h3>
          <ul className="text-xs space-y-1">
            {top.length === 0 && <li className="text-muted-foreground">—</li>}
            {top.map(([pid, qty]) => {
              const p = products.find((x) => x.id === pid);
              return <li key={pid} className="flex justify-between">
                <span>{p?.name ?? pid}</span><span className="font-semibold text-brand-green">{qty.toFixed(1)} {p?.unit ?? ""}</span>
              </li>;
            })}
          </ul>
        </div>
      </div>

      <div className="bg-card rounded-xl divide-y divide-border">
        {dayEntries.length === 0 && <p className="text-center text-sm text-muted-foreground p-6">Nessun invenduto registrato per il giorno.</p>}
        {dayEntries.map((e) => {
          const p = products.find((x) => x.id === e.productId);
          return (
            <button key={e.id} onClick={() => setEditId(e.id)} className="w-full text-left p-3 flex justify-between items-center gap-3">
              <div>
                <p className="font-semibold text-sm">{p?.name ?? e.productId}</p>
                <p className="text-[11px] text-muted-foreground">
                  {e.qty.toFixed(p?.unit === "kg" ? 1 : 0)} {p?.unit ?? ""} · {UNSOLD_DESTINATION_LABEL[e.destination]}
                  {e.tgtgBoxes ? ` · ${e.tgtgBoxes} box` : ""}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="text-danger">−{formatEuro(e.valueLost ?? 0)}</p>
                <p className="text-success">+{formatEuro(e.valueRecovered ?? 0)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {openNew && <UnsoldSheet mode="new" day={day} onClose={() => setOpenNew(false)}
        onSave={(d) => { addUnsoldEntry(d as Omit<UnsoldEntry, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const e = unsoldEntries.find((x) => x.id === editId);
        if (!e) return null;
        return <UnsoldSheet mode="edit" day={day} entry={e}
          onClose={() => setEditId(null)}
          onSave={(patch) => { updateUnsoldEntry(e.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteUnsoldEntry(e.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function UnsoldSheet({ mode, day, entry, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; day: string; entry?: UnsoldEntry;
  onClose: () => void; onSave: (d: Omit<UnsoldEntry, "id"> | Partial<UnsoldEntry>) => void;
  onDelete?: () => void;
}) {
  const { products } = useStore();
  const fresh = freshProducts(products);
  const list = fresh.length > 0 ? fresh : products.filter((p) => p.active);
  const [productId, setProductId] = useState(entry?.productId ?? list[0]?.id ?? "");
  const [qty, setQty] = useState(entry?.qty ?? 1);
  const [destination, setDestination] = useState<UnsoldDestination>(entry?.destination ?? "tgtg");
  const [valueLost, setValueLost] = useState<string>(entry?.valueLost?.toString() ?? "");
  const [valueRecovered, setValueRecovered] = useState<string>(entry?.valueRecovered?.toString() ?? "");
  const [tgtgBoxes, setTgtgBoxes] = useState<string>(entry?.tgtgBoxes?.toString() ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const product = products.find((p) => p.id === productId);

  // Auto-suggest valueLost based on price
  const autoLost = product ? +(product.price * qty).toFixed(2) : 0;

  const save = () => {
    onSave({
      date: entry?.date ?? new Date(day + "T20:00").toISOString(),
      productId, qty: +qty, destination,
      valueLost: valueLost === "" ? autoLost : +valueLost,
      valueRecovered: valueRecovered === "" ? undefined : +valueRecovered,
      tgtgBoxes: tgtgBoxes === "" ? undefined : +tgtgBoxes,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Registra invenduto" : "Modifica invenduto"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma</button>
        </div>
      }>
      <Field label="Prodotto">
        <select value={productId} onChange={(e) => setProductId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantità (${product?.unit ?? ""})`}>
          <input type="number" step="0.1" value={qty} onChange={(e) => setQty(+e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Destinazione">
          <select value={destination} onChange={(e) => setDestination(e.target.value as UnsoldDestination)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(UNSOLD_DESTINATION_LABEL) as UnsoldDestination[]).map((d) =>
              <option key={d} value={d}>{UNSOLD_DESTINATION_LABEL[d]}</option>)}
          </select>
        </Field>
        <Field label={`Valore perso (€) — auto: ${formatEuro(autoLost)}`}>
          <input type="number" step="0.01" value={valueLost} onChange={(e) => setValueLost(e.target.value)}
            placeholder={autoLost.toString()} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Valore recuperato (€)">
          <input type="number" step="0.01" value={valueRecovered} onChange={(e) => setValueRecovered(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        {destination === "tgtg" && (
          <Field label="Numero box TGTG">
            <input type="number" step="1" value={tgtgBoxes} onChange={(e) => setTgtgBoxes(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-3" />
          </Field>
        )}
      </div>
      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

// ======================== TAB SUGGERIMENTI ========================

function SuggerimentiTab() {
  const { products, freshLogs, orders, unsoldEntries, specialDays, businessHours, addProduction } = useStore();
  const [day, setDay] = useState(() => tomorrowIso());

  const fresh = freshProducts(products);
  const closed = isClosedDay(day, businessHours, specialDays);

  const suggestions = useMemo(() => fresh.map((p) => ({
    product: p,
    s: suggestQuantity({
      productId: p.id, productName: p.name, productUnit: p.unit,
      date: day, logs: freshLogs, orders, unsold: unsoldEntries,
      specials: specialDays, hours: businessHours,
    }),
  })), [fresh, day, freshLogs, orders, unsoldEntries, specialDays, businessHours]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        <p className="text-xs text-muted-foreground">Quantità consigliate per {day}</p>
      </div>

      {closed.closed && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
          ⚠ {closed.reason}: nessuna produzione consigliata per questo giorno.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fresh.length === 0 && (
          <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">
            Nessun prodotto fresco da suggerire. Marca prodotti come "fresco" da Prodotti.
          </p>
        )}
        {!closed.closed && suggestions.map(({ product, s }) => (
          <div key={product.id} className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-display text-base text-brand-green">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.perishability ?? "—"} deperibilità</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${RISK_STYLE[s.risk]}`}>
                rischio {s.risk}
              </span>
            </div>
            <p className="font-display text-3xl text-brand-gold mt-2">{s.qty.toFixed(product.unit === "kg" ? 1 : 0)} {product.unit}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
            {s.samples.length > 0 && (
              <ul className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                {s.samples.map((x, i) => (
                  <li key={i} className="flex justify-between border-b border-border/40 last:border-0 py-0.5">
                    <span>{x.label}</span><span className="font-semibold text-foreground">{x.value}</span>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => {
              addProduction({
                date: new Date(day + "T07:00").toISOString(),
                productId: product.id, qtyPlanned: s.qty, status: "da_preparare",
                notes: `Suggerito automaticamente: ${s.reason}`,
              });
              alert("Aggiunto alla pianificazione.");
            }}
              className="w-full mt-3 bg-brand-green text-brand-cream rounded-lg py-1.5 text-xs font-semibold">
              + Aggiungi a pianificazione
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================== TAB CALENDARIO ========================

function CalendarioTab() {
  const { businessHours, specialDays, setBusinessHours, addSpecialDay, updateSpecialDay, deleteSpecialDay } = useStore();
  const [openSp, setOpenSp] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const setDay = (k: WeekdayKey, patch: Partial<DayHours>) => {
    const next: BusinessHours = { ...businessHours, [k]: { ...businessHours[k], ...patch } };
    setBusinessHours(next);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <section>
        <h2 className="font-display text-lg text-brand-green mb-3">Orari attività</h2>
        <div className="bg-card rounded-xl divide-y divide-border">
          {WEEKDAYS.map((k) => {
            const h = businessHours[k];
            return (
              <div key={k} className="flex items-center gap-3 p-3">
                <p className="w-24 font-semibold text-sm">{WEEKDAY_LABEL[k]}</p>
                <button onClick={() => setDay(k, { closed: !h.closed })}
                  className={`text-xs px-3 py-1 rounded-full font-semibold ${h.closed ? "bg-danger/15 text-danger" : "bg-success/15 text-success"}`}>
                  {h.closed ? "Chiuso" : "Aperto"}
                </button>
                {!h.closed && (
                  <>
                    <input type="time" value={h.open ?? "08:00"} onChange={(e) => setDay(k, { open: e.target.value })}
                      className="bg-card border border-border rounded-lg px-2 py-1 text-sm" />
                    <span>—</span>
                    <input type="time" value={h.close ?? "20:00"} onChange={(e) => setDay(k, { close: e.target.value })}
                      className="bg-card border border-border rounded-lg px-2 py-1 text-sm" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-brand-green">Festività / giorni speciali</h2>
          <button onClick={() => setOpenSp(true)} className="bg-brand-gold text-white rounded-lg px-3 py-1.5 text-sm font-semibold">+ Aggiungi</button>
        </div>
        <div className="bg-card rounded-xl divide-y divide-border">
          {specialDays.length === 0 && <p className="text-center text-sm text-muted-foreground p-6">Nessun giorno speciale.</p>}
          {specialDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
            <button key={s.id} onClick={() => setEditId(s.id)} className="w-full text-left p-3 flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(s.date)} · impatto {s.impact} · ×{s.multiplier}</p>
              </div>
              <span className="text-xs text-brand-green">modifica</span>
            </button>
          ))}
        </div>
      </section>

      {openSp && <SpecialDaySheet mode="new" onClose={() => setOpenSp(false)}
        onSave={(d) => { addSpecialDay(d as Omit<SpecialDay, "id">); setOpenSp(false); }} />}
      {editId && (() => {
        const sp = specialDays.find((s) => s.id === editId);
        if (!sp) return null;
        return <SpecialDaySheet mode="edit" sp={sp} onClose={() => setEditId(null)}
          onSave={(patch) => { updateSpecialDay(sp.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteSpecialDay(sp.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function SpecialDaySheet({ mode, sp, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; sp?: SpecialDay;
  onClose: () => void; onSave: (d: Omit<SpecialDay, "id"> | Partial<SpecialDay>) => void;
  onDelete?: () => void;
}) {
  const [date, setDate] = useState(sp?.date.slice(0, 10) ?? todayIso());
  const [name, setName] = useState(sp?.name ?? "");
  const [impact, setImpact] = useState<SpecialDayImpact>(sp?.impact ?? "medio");
  const [multiplier, setMultiplier] = useState<string>(sp?.multiplier?.toString() ?? "1");
  const [notes, setNotes] = useState(sp?.notes ?? "");

  const save = () => {
    if (!name.trim()) return;
    onSave({ date, name: name.trim(), impact, multiplier: +multiplier, notes: notes.trim() || undefined });
  };

  const presets = [
    { label: "−50%", v: 0.5 }, { label: "−30%", v: 0.7 }, { label: "Normale", v: 1 },
    { label: "+30%", v: 1.3 }, { label: "+50%", v: 1.5 }, { label: "+100%", v: 2 },
  ];

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo giorno speciale" : "Modifica giorno speciale"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Nome evento">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Pasqua"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Impatto">
          <select value={impact} onChange={(e) => setImpact(e.target.value as SpecialDayImpact)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="basso">Basso</option>
            <option value="medio">Medio</option>
            <option value="alto">Alto</option>
          </select>
        </Field>
        <Field label="Moltiplicatore domanda">
          <input type="number" step="0.1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button key={p.label} onClick={() => setMultiplier(String(p.v))}
            className="text-xs bg-card border border-border rounded-full px-3 py-1">{p.label}</button>
        ))}
      </div>
      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

// ======================== SHARED ========================

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function ProdSheet({ day, mode, production, onClose, onSave, onDelete }: {
  day: string; mode: "new" | "edit"; production?: Production;
  onClose: () => void; onSave: (d: Omit<Production, "id"> | Partial<Production>) => void;
  onDelete?: () => void;
}) {
  const { products } = useStore();
  const [productId, setProductId] = useState(production?.productId ?? products[0]?.id ?? "");
  const [qtyPlanned, setQtyPlanned] = useState(production?.qtyPlanned ?? 1);
  const [qtyActual, setQtyActual] = useState(production?.qtyActual ?? 0);
  const [status, setStatus] = useState<ProductionStatus>(production?.status ?? "da_preparare");
  const [notes, setNotes] = useState(production?.notes ?? "");

  const save = () => {
    onSave({
      date: production?.date ?? new Date(day + "T07:00").toISOString(),
      productId, qtyPlanned: Number(qtyPlanned),
      qtyActual: qtyActual ? Number(qtyActual) : undefined,
      status, notes: notes.trim() || undefined,
      orderIds: production?.orderIds,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova produzione" : "Modifica produzione"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma</button>
        </div>
      }>
      <Field label="Prodotto">
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pianificato">
          <input type="number" step="0.1" value={qtyPlanned} onChange={e => setQtyPlanned(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Effettivo">
          <input type="number" step="0.1" value={qtyActual} onChange={e => setQtyActual(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <Field label="Status">
        <select value={status} onChange={e => setStatus(e.target.value as ProductionStatus)}
          className="w-full bg-card border border-border rounded-lg p-3">
          {(Object.keys(STATUS_LABEL) as ProductionStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
      {production?.date && (
        <p className="text-xs text-muted-foreground">Data: {formatDate(production.date)}</p>
      )}
    </Sheet>
  );
}

void productionsForDate; // re-export silence
