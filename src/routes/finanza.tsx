import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro } from "@/components/AppShell";
import { monthlyFixedCostsTotal } from "@/lib/metrics";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";

export const Route = createFileRoute("/finanza")({ component: FinanziarioPage });

function FinanziarioPage() {
  const s = useStore();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const [cs, setCs] = useState<string>(todayIso);
  const [ce, setCe] = useState<string>(todayIso);


  const tf = useMemo(
    () => makeTimeFrame(tfId, cs ? new Date(cs) : undefined, ce ? new Date(ce) : undefined),
    [tfId, cs, ce],
  );

  const inTf = (iso: string) => inFrame(iso, tf);

  // Fatturato (ordini ritirati + scontrini nel timeframe)
  const fatOrders = s.orders.filter(o => o.status === "ritirato" && inTf(o.pickupDate));
  const fatSales = s.casualSales.filter(x => inTf(x.date));
  const fatturato = fatOrders.reduce((a, o) => a + o.total, 0) + fatSales.reduce((a, x) => a + x.total, 0);

  // di cui B2B (history dei clienti B2B nel timeframe)
  const b2b = s.b2bClients.flatMap(c => c.history).filter(h => inTf(h.date)).reduce((a, h) => a + h.total, 0);

  // Margine lordo (orders+sales): price - cost
  const margFromItems = (items: { productId: string; qty: number }[]) =>
    items.reduce((sum, i) => {
      const p = s.products.find(x => x.id === i.productId);
      if (!p || p.cost == null) return sum;
      return sum + (p.price - p.cost) * i.qty;
    }, 0);
  const margineLordo =
    fatOrders.reduce((a, o) => a + margFromItems(o.items), 0) +
    fatSales.reduce((a, x) => a + margFromItems(x.items), 0);

  // Costi fissi (configurati in Fiscalità) — valore mensile, NON dipende dal timeframe
  const costiFissi = monthlyFixedCostsTotal(s.fixedCosts);

  // Costi variabili = somma uscite registrate nel timeframe
  const costiVariabili = s.supplierPayments
    .filter(p => inTf(p.dueDate ?? p.date))
    .reduce((a, p) => a + p.amount, 0);

  const utileNetto = margineLordo - costiFissi - costiVariabili;

  return (
    <div>
      <TopBar
        title="Finanziario"
        subtitle={`${tf.label} · ${tf.start.toLocaleDateString("it-IT")} → ${new Date(+tf.end - 1).toLocaleDateString("it-IT")}`}

        right={
          <div className="flex items-center gap-2">
            <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
              className="bg-brand-green-dark text-brand-cream text-xs rounded-lg px-2 py-2 border border-brand-gold/30">
              {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-4">
        {tfId === "custom" && (
          <div className="bg-card rounded-xl p-3 flex flex-wrap gap-3 items-end">
            <label className="text-xs">
              <span className="block text-muted-foreground mb-1">Dal</span>
              <input type="date" value={cs} onChange={e => setCs(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-xs">
              <span className="block text-muted-foreground mb-1">Al</span>
              <input type="date" value={ce} onChange={e => setCe(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1.5" />
            </label>
          </div>
        )}

        {/* KPI principali */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Fatturato" value={formatEuro(fatturato)} highlight />
          <Kpi label="di cui B2B" value={formatEuro(b2b)} muted />
          <Kpi label="Margine lordo" value={formatEuro(margineLordo)} success />
          <Kpi label="Costi fissi (mese)" value={formatEuro(costiFissi)} danger />
          <Kpi label="Costi variabili" value={formatEuro(costiVariabili)} danger />
          <Kpi
            label="Utile netto"
            value={formatEuro(utileNetto)}
            highlight={utileNetto >= 0}
            danger={utileNetto < 0}
          />
        </section>

      </div>
    </div>
  );
}

function Kpi({ label, value, highlight, danger, success, muted }: {
  label: string; value: string; highlight?: boolean; danger?: boolean; success?: boolean; muted?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : success ? "text-success" : muted ? "text-muted-foreground" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}
