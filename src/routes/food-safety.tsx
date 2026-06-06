import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatDate, formatEuro, Sheet, Field, Fab } from "@/components/AppShell";
import {
  generateLotCode, daysUntil, expiryStatus, fefoLot,
  HACCP_AREAS, HACCP_AREA_LABEL, HACCP_THRESHOLDS, isOutOfRange,
  type Lot, type HaccpArea, type HaccpReading, type CleaningTask,
} from "@/lib/data";

export const Route = createFileRoute("/food-safety")({ component: FoodSafetyPage });

type Tab = "kpi" | "scadenze" | "lotti" | "haccp" | "pulizie" | "suggerimenti";

const TABS: { id: Tab; label: string }[] = [
  { id: "kpi", label: "Dashboard" },
  { id: "scadenze", label: "Scadenze · FEFO" },
  { id: "lotti", label: "Lotti" },
  { id: "haccp", label: "HACCP" },
  { id: "pulizie", label: "Pulizie" },
  { id: "suggerimenti", label: "Invenduto" },
];

function statusBadge(s: ReturnType<typeof expiryStatus>) {
  switch (s) {
    case "scaduto": return "bg-danger text-white";
    case "oggi":    return "bg-danger/15 text-danger";
    case "domani":  return "bg-warning/15 text-warning";
    case "presto":  return "bg-brand-gold/20 text-brand-gold";
    default:        return "bg-success/15 text-success";
  }
}
function statusLabel(s: ReturnType<typeof expiryStatus>, iso: string) {
  const d = daysUntil(iso);
  if (s === "scaduto") return `Scaduto da ${Math.abs(d)}g`;
  if (s === "oggi") return "Scade oggi";
  if (s === "domani") return "Scade domani";
  if (s === "presto") return `${d}g`;
  return `${d}g`;
}

function FoodSafetyPage() {
  const [tab, setTab] = useState<Tab>("kpi");
  const {
    lots, products, haccpReadings, cleaningTasks, orders, clients,
  } = useStore();

  // KPI
  const expiringLots = useMemo(() =>
    lots.filter(l => l.qtyRemaining > 0 && daysUntil(l.expiryDate) <= 2)
        .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate)),
    [lots]);
  const activeLots = lots.filter(l => l.qtyRemaining > 0);
  const valueAtRisk = useMemo(() => expiringLots.reduce((s, l) => {
    const p = products.find(p => p.id === l.productId);
    return s + l.qtyRemaining * (p?.price ?? 0);
  }, 0), [expiringLots, products]);
  const todayStr = new Date().toDateString();
  const todaysReadings = haccpReadings.filter(r => new Date(r.date).toDateString() === todayStr);
  const outOfRangeCount = haccpReadings.filter(r => r.outOfRange && new Date(r.date) >= new Date(Date.now() - 86400000 * 7)).length;
  const missingChecks = HACCP_AREAS.filter(a => !todaysReadings.some(r => r.area === a));
  const cleaningTodo = cleaningTasks.filter(t => !t.completed && new Date(t.date).toDateString() === todayStr).length;

  return (
    <div>
      <TopBar title="Food Safety" subtitle={`${activeLots.length} lotti attivi · ${expiringLots.length} in scadenza`} />

      <div className="px-4 md:px-6 pt-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "kpi" && (
        <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Lotti attivi" value={String(activeLots.length)} />
          <Kpi label="In scadenza ≤2g" value={String(expiringLots.length)} warn={expiringLots.length > 0} />
          <Kpi label="Valore a rischio" value={formatEuro(valueAtRisk)} warn={valueAtRisk > 0} />
          <Kpi label="Controlli HACCP oggi" value={`${todaysReadings.length}/${HACCP_AREAS.length}`} warn={missingChecks.length > 0} />
          <Kpi label="Fuori soglia (7g)" value={String(outOfRangeCount)} danger={outOfRangeCount > 0} />
          <Kpi label="Pulizie oggi da fare" value={String(cleaningTodo)} warn={cleaningTodo > 0} />
          <Kpi label="Scaduti non smaltiti" value={String(lots.filter(l => l.qtyRemaining > 0 && daysUntil(l.expiryDate) < 0).length)} danger />
          <Kpi label="Aree HACCP mancanti" value={missingChecks.map(a => HACCP_AREA_LABEL[a]).join(", ") || "—"} warn={missingChecks.length > 0} />
        </div>
      )}

      {tab === "scadenze" && <ScadenzeTab />}
      {tab === "lotti" && <LottiTab />}
      {tab === "haccp" && <HaccpTab />}
      {tab === "pulizie" && <PulizieTab />}
      {tab === "suggerimenti" && <SuggerimentiTab />}
    </div>
  );
}

function Kpi({ label, value, warn, danger, sub }: { label: string; value: string; warn?: boolean; danger?: boolean; sub?: string }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : warn ? "text-warning" : "text-brand-green"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ============ SCADENZE / FEFO ============
function ScadenzeTab() {
  const { lots, products, orders, clients } = useStore();
  const sorted = useMemo(() => [...lots]
    .filter(l => l.qtyRemaining > 0)
    .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate)),
  [lots]);

  return (
    <div className="p-4 md:p-6 space-y-2">
      {sorted.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun lotto attivo.</p>}
      {sorted.map(l => {
        const p = products.find(p => p.id === l.productId);
        const s = expiryStatus(l.expiryDate);
        const value = l.qtyRemaining * (p?.price ?? 0);
        const orderLinks = orders.filter(o => o.items.some(i => i.lotId === l.id));
        const fefo = p ? fefoLot(lots, p.id) : null;
        const isFefo = fefo?.id === l.id;
        return (
          <div key={l.id} className="bg-card rounded-xl p-3 flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display text-base text-brand-green truncate">{p?.name ?? "—"}</p>
                {isFefo && <span className="text-[9px] bg-brand-gold text-white px-1.5 py-0.5 rounded font-bold">FEFO</span>}
              </div>
              <p className="text-xs text-muted-foreground font-mono">{l.code} · scad. {formatDate(l.expiryDate)}</p>
              <p className="text-xs mt-0.5">Residuo <span className="font-semibold">{l.qtyRemaining} {p?.unit}</span> · valore {formatEuro(value)}</p>
              {orderLinks.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tracciato in {orderLinks.length} ordine/i: {orderLinks.slice(0,3).map(o => clients.find(c=>c.id===o.clientId)?.name).filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${statusBadge(s)}`}>
              {statusLabel(s, l.expiryDate)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============ LOTTI ============
function LottiTab() {
  const { lots, products, suppliers, orders, clients, addLot, updateLot, deleteLot } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => lots
    .filter(l => showAll || l.qtyRemaining > 0)
    .filter(l => {
      if (!q.trim()) return true;
      const p = products.find(p => p.id === l.productId);
      return l.code.toLowerCase().includes(q.toLowerCase()) || (p?.name.toLowerCase().includes(q.toLowerCase()) ?? false);
    })
    .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate)),
  [lots, products, q, showAll]);

  return (
    <div className="p-4 md:p-6 space-y-2">
      <div className="flex gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca codice o prodotto..."
          className="flex-1 bg-card border border-border rounded-lg p-2.5 text-sm" />
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> esauriti
        </label>
      </div>
      {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun lotto.</p>}
      {list.map(l => {
        const p = products.find(p => p.id === l.productId);
        const sup = suppliers.find(s => s.id === l.supplierId);
        const s = expiryStatus(l.expiryDate);
        const orderLinks = orders.filter(o => o.items.some(i => i.lotId === l.id));
        return (
          <button key={l.id} onClick={() => setEditId(l.id)} className="w-full text-left bg-card rounded-xl p-3 flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="font-display text-base text-brand-green truncate">{p?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground font-mono">{l.code}</p>
              <p className="text-[11px] text-muted-foreground">
                Prod. {formatDate(l.productionDate)} · Scad. {formatDate(l.expiryDate)}
                {sup && ` · ${sup.name}`}
              </p>
              <p className="text-xs mt-0.5">{l.qtyRemaining}/{l.qtyInitial} {p?.unit}</p>
              {orderLinks.length > 0 && (
                <p className="text-[10px] text-muted-foreground italic mt-0.5">
                  Clienti: {orderLinks.map(o => clients.find(c=>c.id===o.clientId)?.name).filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${statusBadge(s)}`}>
              {statusLabel(s, l.expiryDate)}
            </span>
          </button>
        );
      })}

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <LotSheet onClose={() => setOpenNew(false)}
          onSave={(payload) => { addLot(payload); setOpenNew(false); }} />
      )}
      {editId && (() => {
        const lot = lots.find(x => x.id === editId);
        if (!lot) return null;
        return <LotSheet lot={lot} onClose={() => setEditId(null)}
          onSave={(patch) => { updateLot(lot.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare il lotto?")) { deleteLot(lot.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function LotSheet({ lot, onClose, onSave, onDelete }: {
  lot?: Lot; onClose: () => void; onSave: (l: any) => void; onDelete?: () => void;
}) {
  const { products, suppliers, lots, goodsReceipts } = useStore();
  const [productId, setProductId] = useState(lot?.productId ?? products[0]?.id ?? "");
  const [productionDate, setProductionDate] = useState(() => (lot?.productionDate ?? new Date().toISOString()).slice(0, 10));
  const product = products.find(p => p.id === productId);
  const defaultExpiry = useMemo(() => {
    if (lot?.expiryDate) return lot.expiryDate.slice(0, 10);
    const d = new Date(productionDate);
    d.setDate(d.getDate() + (product?.shelfLifeDays ?? 7));
    return d.toISOString().slice(0, 10);
  }, [lot, productionDate, product?.shelfLifeDays]);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [qtyInitial, setQtyInitial] = useState<string>(lot?.qtyInitial?.toString() ?? "");
  const [qtyRemaining, setQtyRemaining] = useState<string>(lot?.qtyRemaining?.toString() ?? "");
  const [supplierId, setSupplierId] = useState(lot?.supplierId ?? "");
  const [receiptId, setReceiptId] = useState(lot?.receiptId ?? "");
  const [code, setCode] = useState(lot?.code ?? "");
  const [notes, setNotes] = useState(lot?.notes ?? "");

  const autoCode = useMemo(() => generateLotCode(productionDate, lots.filter(l => !lot || l.id !== lot.id)), [productionDate, lots, lot]);

  const save = () => {
    if (!productId || !qtyInitial) return;
    const qi = parseFloat(qtyInitial);
    const qr = qtyRemaining === "" ? qi : parseFloat(qtyRemaining);
    onSave({
      code: code.trim() || autoCode,
      productId,
      productionDate: new Date(productionDate).toISOString(),
      expiryDate: new Date(expiryDate).toISOString(),
      qtyInitial: qi,
      qtyRemaining: qr,
      supplierId: supplierId || undefined,
      receiptId: receiptId || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={lot ? `Lotto ${lot.code}` : "Nuovo lotto"}
      footer={
        <div className="flex gap-3 items-center">
          <div className="flex-1 text-xs text-muted-foreground">
            Codice: <span className="font-mono">{code || autoCode}</span>
          </div>
          {lot && onDelete && <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>}
          <button onClick={save} disabled={!productId || !qtyInitial}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">Conferma</button>
        </div>
      }>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Prodotto">
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Codice lotto (auto)">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder={autoCode}
            className="w-full bg-card border border-border rounded-lg p-3 font-mono" />
        </Field>
        <Field label="Data produzione">
          <input type="date" value={productionDate} onChange={e => setProductionDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Scadenza / TMC">
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label={`Q.tà iniziale (${product?.unit ?? ""})`}>
          <input type="number" step="0.1" value={qtyInitial} onChange={e => setQtyInitial(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Q.tà residua">
          <input type="number" step="0.1" value={qtyRemaining} onChange={e => setQtyRemaining(e.target.value)}
            placeholder={qtyInitial}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Fornitore">
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">— Nessuno —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Entrata merce collegata">
          <select value={receiptId} onChange={e => setReceiptId(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">— Nessuna —</option>
            {goodsReceipts.slice(0, 30).map(r => <option key={r.id} value={r.id}>{r.invoiceNumber ?? r.id} · {formatDate(r.date)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

// ============ HACCP ============
function HaccpTab() {
  const { haccpReadings, addHaccpReading, deleteHaccpReading } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const sorted = useMemo(() => [...haccpReadings].sort((a, b) => +new Date(b.date) - +new Date(a.date)), [haccpReadings]);

  return (
    <div className="p-4 md:p-6 space-y-2">
      {sorted.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessuna lettura.</p>}
      {sorted.slice(0, 80).map(r => (
        <div key={r.id} className={`bg-card rounded-xl p-3 flex justify-between items-center gap-3 ${r.outOfRange ? "ring-2 ring-danger/40" : ""}`}>
          <div className="min-w-0">
            <p className="font-display text-base text-brand-green">{HACCP_AREA_LABEL[r.area]}</p>
            <p className="text-xs text-muted-foreground">{new Date(r.date).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{r.operator ? ` · ${r.operator}` : ""}</p>
            {r.notes && <p className="text-xs italic mt-0.5">{r.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className={`font-display text-2xl ${r.outOfRange ? "text-danger" : "text-brand-green"}`}>{r.temperature.toFixed(1)}°C</p>
            <button onClick={() => { if (confirm("Eliminare la lettura?")) deleteHaccpReading(r.id); }}
              className="text-[10px] text-muted-foreground hover:text-danger">elimina</button>
          </div>
        </div>
      ))}
      <Fab onClick={() => setOpenNew(true)} />
      {openNew && <HaccpSheet onClose={() => setOpenNew(false)} onSave={(p) => { addHaccpReading(p); setOpenNew(false); }} />}
    </div>
  );
}

function HaccpSheet({ onClose, onSave }: { onClose: () => void; onSave: (r: Omit<HaccpReading, "id">) => void }) {
  const [area, setArea] = useState<HaccpArea>("frigo");
  const [temp, setTemp] = useState("");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const t = parseFloat(temp);
  const outOfRange = !isNaN(t) && isOutOfRange(area, t);
  const [mn, mx] = HACCP_THRESHOLDS[area];

  const save = () => {
    if (isNaN(t)) return;
    onSave({
      date: new Date().toISOString(),
      area, temperature: t,
      operator: operator.trim() || undefined,
      notes: notes.trim() || undefined,
      outOfRange,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title="Nuova lettura HACCP"
      footer={<button onClick={save} disabled={isNaN(t)} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold disabled:opacity-40">Registra</button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Area">
          <select value={area} onChange={e => setArea(e.target.value as HaccpArea)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {HACCP_AREAS.map(a => <option key={a} value={a}>{HACCP_AREA_LABEL[a]}</option>)}
          </select>
        </Field>
        <Field label={`Temperatura (°C) — soglia ${mn}÷${mx}`}>
          <input type="number" step="0.1" value={temp} onChange={e => setTemp(e.target.value)}
            className={`w-full bg-card border rounded-lg p-3 ${outOfRange ? "border-danger" : "border-border"}`} />
        </Field>
      </div>
      {outOfRange && <p className="text-xs text-danger font-semibold">⚠ Temperatura fuori soglia ({mn}÷{mx}°C)</p>}
      <Field label="Operatore">
        <input value={operator} onChange={e => setOperator(e.target.value)} placeholder="Es. Daniele"
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

// ============ PULIZIE ============
function PulizieTab() {
  const { cleaningTasks, addCleaningTask, updateCleaningTask, deleteCleaningTask } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const sorted = useMemo(() => [...cleaningTasks].sort((a, b) => +new Date(b.date) - +new Date(a.date)), [cleaningTasks]);

  return (
    <div className="p-4 md:p-6 space-y-2">
      {sorted.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessuna pulizia registrata.</p>}
      {sorted.slice(0, 80).map(t => (
        <div key={t.id} className="bg-card rounded-xl p-3 flex justify-between items-center gap-3">
          <button onClick={() => updateCleaningTask(t.id, { completed: !t.completed })}
            className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${t.completed ? "bg-success border-success text-white" : "border-border"}`}>
            {t.completed && "✓"}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`font-display text-base ${t.completed ? "text-muted-foreground line-through" : "text-brand-green"}`}>{t.operation}</p>
            <p className="text-xs text-muted-foreground">{t.area} · {new Date(t.date).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{t.operator ? ` · ${t.operator}` : ""}</p>
            {t.notes && <p className="text-xs italic mt-0.5">{t.notes}</p>}
          </div>
          <button onClick={() => { if (confirm("Eliminare?")) deleteCleaningTask(t.id); }}
            className="text-[10px] text-muted-foreground hover:text-danger">elimina</button>
        </div>
      ))}
      <Fab onClick={() => setOpenNew(true)} />
      {openNew && <CleaningSheet onClose={() => setOpenNew(false)} onSave={(p) => { addCleaningTask(p); setOpenNew(false); }} />}
    </div>
  );
}

function CleaningSheet({ onClose, onSave }: { onClose: () => void; onSave: (t: Omit<CleaningTask, "id">) => void }) {
  const [area, setArea] = useState("Banco vendita");
  const [operation, setOperation] = useState("Sanificazione superfici");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(true);
  const [dt, setDt] = useState(() => {
    const d = new Date(); const tz = d.getTimezoneOffset() * 60000;
    return new Date(+d - tz).toISOString().slice(0, 16);
  });

  return (
    <Sheet open={true} onClose={onClose} title="Nuova pulizia"
      footer={<button onClick={() => onSave({
        date: new Date(dt).toISOString(), area, operation, operator: operator.trim() || undefined,
        notes: notes.trim() || undefined, completed,
      })} disabled={!area || !operation} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold disabled:opacity-40">Registra</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Area"><input value={area} onChange={e => setArea(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Operazione"><input value={operation} onChange={e => setOperation(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Data e ora"><input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Operatore"><input value={operator} onChange={e => setOperator(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />
        Completata
      </label>
      <Field label="Note"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" /></Field>
    </Sheet>
  );
}

// ============ SUGGERIMENTI INVENDUTO ============
function SuggerimentiTab() {
  const { lots, products } = useStore();
  const expiring = useMemo(() => lots
    .filter(l => l.qtyRemaining > 0 && daysUntil(l.expiryDate) <= 2)
    .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate)),
  [lots]);

  if (expiring.length === 0) return <p className="p-4 md:p-6 text-sm text-muted-foreground">Nessun lotto in scadenza nelle prossime 48h.</p>;

  return (
    <div className="p-4 md:p-6 space-y-3">
      <p className="text-xs text-muted-foreground">Suggerimenti operativi per ridurre lo spreco. Nulla è automatizzato.</p>
      {expiring.map(l => {
        const p = products.find(p => p.id === l.productId);
        const value = l.qtyRemaining * (p?.price ?? 0);
        const s = expiryStatus(l.expiryDate);
        const suggestions: { label: string; tone: string }[] = [];
        if (s === "scaduto") suggestions.push({ label: "Smaltire come scarto", tone: "bg-danger/15 text-danger" });
        else {
          if (p?.fresh) suggestions.push({ label: "Sconto −30%", tone: "bg-warning/15 text-warning" });
          suggestions.push({ label: "Too Good To Go", tone: "bg-brand-gold/20 text-brand-gold" });
          suggestions.push({ label: "Consumo interno", tone: "bg-brand-green/10 text-brand-green" });
          if (s !== "oggi") suggestions.push({ label: "Bundle promo", tone: "bg-success/15 text-success" });
        }
        return (
          <div key={l.id} className="bg-card rounded-xl p-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="font-display text-base text-brand-green">{p?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground font-mono">{l.code} · {l.qtyRemaining} {p?.unit} · {formatEuro(value)}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${statusBadge(s)}`}>{statusLabel(s, l.expiryDate)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestions.map((sg, i) => (
                <span key={i} className={`text-[11px] px-2 py-1 rounded-lg font-semibold ${sg.tone}`}>{sg.label}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
