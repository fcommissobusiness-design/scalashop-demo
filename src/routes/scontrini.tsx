import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Fab, formatEuro, formatTime, formatDate } from "@/components/AppShell";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";
import { itemDisplayName } from "@/lib/metrics";
import { NewSaleSheet } from "@/routes/index";
import { CustomDateBox } from "@/components/CustomDateBox";
import type { DeliveryMode, OrderSource, PaymentMethod } from "@/lib/data";

export const Route = createFileRoute("/scontrini")({ component: ScontriniPage });

const DELIVERY_LABEL: Record<DeliveryMode, string> = {
  ritiro: "Ritiro in negozio", domicilio: "Consegna a domicilio",
};
const PAY_LABEL: Record<PaymentMethod, string> = {
  contanti: "Contanti", pos: "POS", bonifico: "Bonifico", carta: "Carta", altro: "Altro",
};
const SOURCE_LABEL: Record<OrderSource, string> = {
  negozio: "Negozio", whatsapp: "WhatsApp", telefono: "Telefono", sito: "Sito", altro: "Altro",
  consegna: "Negozio", b2b: "Negozio",
};
const SOURCE_OPTIONS: OrderSource[] = ["negozio", "whatsapp", "telefono", "sito", "altro"];
const PAY_OPTIONS: PaymentMethod[] = ["contanti", "pos", "bonifico", "carta", "altro"];

function todayIso() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(+d - tz).toISOString().slice(0, 10);
}

function ScontriniPage() {
  const { casualSales, clients, products, bundles, addClient, addCasualSale } = useStore();
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const [cs, setCs] = useState(todayIso());
  const [ce, setCe] = useState(todayIso());
  const tf = useMemo(
    () => tfId === "custom" ? makeTimeFrame("custom", new Date(cs), new Date(ce)) : makeTimeFrame(tfId),
    [tfId, cs, ce],
  );

  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [delivSel, setDelivSel] = useState<Set<DeliveryMode>>(new Set());
  const [paySel, setPaySel] = useState<Set<PaymentMethod>>(new Set());
  const [srcSel, setSrcSel] = useState<Set<OrderSource>>(new Set());

  const inFrameSales = useMemo(
    () => casualSales.filter((s) => inFrame(s.date, tf)).sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [casualSales, tf]
  );

  const clientById = (id?: string) => (id ? clients.find((c) => c.id === id) : undefined);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return inFrameSales.filter(s => {
      if (delivSel.size > 0 && !delivSel.has(s.delivery ?? "ritiro")) return false;
      if (paySel.size > 0 && !paySel.has(s.paymentMethod ?? "altro")) return false;
      if (srcSel.size > 0 && !srcSel.has(s.source ?? "negozio")) return false;
      if (t) {
        const c = clientById(s.clientId);
        const matchClient = (c?.name.toLowerCase().includes(t) ?? false)
          || (c?.phone.includes(q) ?? false)
          || (s.clientNameInput?.toLowerCase().includes(t) ?? false);
        const matchProduct = s.items.some(i => itemDisplayName(i, products, bundles).toLowerCase().includes(t));
        if (!matchClient && !matchProduct) return false;
      }
      return true;
    });
  }, [inFrameSales, q, delivSel, paySel, srcSel, clients, products, bundles]);

  const fatturato = filtered.reduce((s, x) => s + x.total, 0);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    setter(n);
  };

  return (
    <div>
      <TopBar title="Scontrini" subtitle={`${tf.label} · ${filtered.length} scontrini`} />

      <div className="px-4 md:px-6 pt-3 flex justify-end gap-1.5 items-center">
        <select
          value={tfId}
          onChange={(e) => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg p-2 text-sm font-semibold text-brand-green"
        >
          {TIME_FRAME_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {tfId === "custom" && (
          <>
            <CustomDateBox label="Dal" value={cs} onChange={setCs} />
            <CustomDateBox label="Al" value={ce} onChange={setCe} />
          </>
        )}
      </div>

      <div className="px-4 md:px-6 pt-3">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca cliente, telefono o prodotto..."
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
      </div>

      {/* Filtri */}
      <div className="px-4 md:px-6 pt-3 space-y-2">
        <FilterRow label="Tipologia">
          {(Object.keys(DELIVERY_LABEL) as DeliveryMode[]).map(d => (
            <Chip key={d} active={delivSel.has(d)} onClick={() => toggle(delivSel, d, setDelivSel)}>{DELIVERY_LABEL[d]}</Chip>
          ))}
          {delivSel.size > 0 && <button onClick={() => setDelivSel(new Set())} className="text-[11px] text-muted-foreground underline">azzera</button>}
        </FilterRow>
        <FilterRow label="Pagamento">
          {PAY_OPTIONS.map(p => (
            <Chip key={p} active={paySel.has(p)} onClick={() => toggle(paySel, p, setPaySel)}>{PAY_LABEL[p]}</Chip>
          ))}
          {paySel.size > 0 && <button onClick={() => setPaySel(new Set())} className="text-[11px] text-muted-foreground underline">azzera</button>}
        </FilterRow>
        <FilterRow label="Origine">
          {SOURCE_OPTIONS.map(o => (
            <Chip key={o} active={srcSel.has(o)} onClick={() => toggle(srcSel, o, setSrcSel)}>{SOURCE_LABEL[o]}</Chip>
          ))}
          {srcSel.size > 0 && <button onClick={() => setSrcSel(new Set())} className="text-[11px] text-muted-foreground underline">azzera</button>}
        </FilterRow>
      </div>

      {/* KPI: solo Fatturato */}
      <div className="p-4 md:p-6">
        <div className="rounded-xl p-4 bg-brand-green text-brand-cream text-center border border-brand-green">
          <p className="text-[11px] uppercase tracking-wide text-brand-gold">Fatturato</p>
          <p className="font-display text-3xl mt-1 text-brand-gold">{formatEuro(fatturato)}</p>
          <p className="text-[11px] text-brand-cream/70 mt-1">{tf.label.toLowerCase()}</p>
        </div>
      </div>

      <div className="p-4 md:p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="md:col-span-2 bg-card rounded-xl p-6 text-center text-sm text-muted-foreground border border-brand-green/20">
            Nessuno scontrino trovato.
          </div>
        )}
        {filtered.map((s) => {
          const c = clientById(s.clientId);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setEditId(s.id)}
              className="bg-card rounded-xl p-3 text-sm text-left active:opacity-80 border border-brand-green/20 hover:border-brand-gold/40 transition"
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-brand-green truncate">
                  {c?.name ?? s.clientNameInput ?? "Anonimo"}
                </span>
                <span className="text-brand-green font-bold">{formatEuro(s.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTime(s.date)} · {formatDate(s.date)} · {PAY_LABEL[s.paymentMethod ?? "altro"]} · {s.delivery === "domicilio" ? "Domicilio" : "Ritiro"} · {SOURCE_LABEL[s.source ?? "negozio"]}
              </p>
              <p className="text-xs text-foreground/70 mt-1 line-clamp-2">
                {s.items.map((i) => itemDisplayName(i, products, bundles)).join(", ")}
              </p>
              {s.notes && (
                <p className="text-xs italic text-muted-foreground mt-1 line-clamp-1">Note: {s.notes}</p>
              )}
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {(openNew || editId) && (
        <NewSaleSheet
          key={editId ?? "new"}
          open={true}
          saleId={editId ?? undefined}
          onClose={() => { setOpenNew(false); setEditId(null); }}
          onSave={(s, newClient) => {
            if (newClient) addClient(newClient);
            addCasualSale(s);
            setOpenNew(false);
          }}
        />
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${active ? "bg-brand-gold/15 text-brand-green border-brand-gold ring-1 ring-brand-gold/40" : "bg-card text-foreground/70 border-border hover:border-brand-gold/40"}`}>
      {children}
    </button>
  );
}