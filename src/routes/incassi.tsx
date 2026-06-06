import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Fab, formatEuro, formatDate } from "@/components/AppShell";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";
import { orderMargin } from "@/lib/metrics";
import { OrderSheet } from "@/routes/ordini";
import { NewSaleSheet } from "@/routes/index";
import { PaySheet } from "@/routes/pagamenti";
import { DeliveryFullSheet } from "@/components/DeliveryFullSheet";
import type { SupplierPayment } from "@/lib/data";

export const Route = createFileRoute("/incassi")({ component: CassaPage });

type Movement = {
  id: string;
  date: string;
  type: "entrata" | "uscita";
  amount: number;
  label: string;
  meta?: string;
  margin?: number;
};

function CassaPage() {
  const { orders, casualSales, supplierPayments, cashEntries, products, bundles, suppliers, addOrder, addCasualSale, addClient, addSupplierPayment } = useStore();

  const todayIso = new Date().toISOString().slice(0, 10);
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const [cs, setCs] = useState<string>(todayIso);
  const [ce, setCe] = useState<string>(todayIso);
  const tf = useMemo(
    () => tfId === "custom" ? makeTimeFrame("custom", new Date(cs), new Date(ce)) : makeTimeFrame(tfId),
    [tfId, cs, ce],
  );


  const [filter, setFilter] = useState<"all" | "entrata" | "uscita">("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [openSale, setOpenSale] = useState(false);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [openPay, setOpenPay] = useState(false);
  const [openDeliv, setOpenDeliv] = useState(false);

  // ============ Costruzione movimenti dal periodo ============
  const movements: Movement[] = useMemo(() => {
    const out: Movement[] = [];

    // Entrate da ordini ritirati
    for (const o of orders) {
      if (o.status !== "ritirato") continue;
      if (!inFrame(o.pickupDate, tf)) continue;
      out.push({
        id: `ord_${o.id}`,
        date: o.pickupDate,
        type: "entrata",
        amount: o.total,
        label: "Ordine",
        meta: o.paymentMethod ?? "—",
        margin: orderMargin(o, products, bundles),
      });
    }

    // Entrate da scontrini
    for (const s of casualSales) {
      if (!inFrame(s.date, tf)) continue;
      out.push({
        id: `sale_${s.id}`,
        date: s.date,
        type: "entrata",
        amount: s.total,
        label: "Scontrino",
        meta: s.paymentMethod ?? "—",
        margin: orderMargin({ items: s.items } as any, products, bundles),
      });
    }

    // Uscite da pagamenti fornitori (esclusi da_pagare)
    for (const p of supplierPayments) {
      if (p.status === "da_pagare") continue;
      if (!inFrame(p.date, tf)) continue;
      out.push({
        id: `pay_${p.id}`,
        date: p.date,
        type: "uscita",
        amount: p.amount,
        label: p.beneficiary || p.category,
        meta: `${p.category} · ${p.method}`,
      });
    }

    // Movimenti manuali residui (cashEntries) — supporto storico
    for (const e of cashEntries) {
      if (!inFrame(e.date, tf)) continue;
      out.push({
        id: `ce_${e.id}`,
        date: e.date,
        type: e.type,
        amount: e.amount,
        label: e.category,
        meta: `${e.method}${e.notes ? ` · ${e.notes}` : ""}`,
      });
    }

    return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [orders, casualSales, supplierPayments, cashEntries, products, bundles, tf]);

  // ============ KPI ============
  const kpi = useMemo(() => {
    let entrate = 0, uscite = 0, ricavi = 0, margine = 0;
    for (const m of movements) {
      if (m.type === "entrata") {
        entrate += m.amount;
        if (m.id.startsWith("ord_") || m.id.startsWith("sale_")) {
          ricavi += m.amount;
          margine += m.margin ?? 0;
        } else {
          ricavi += m.amount;
        }
      } else {
        uscite += m.amount;
      }
    }
    const utile = margine - uscite;
    return { entrate, uscite, ricavi, utile };
  }, [movements]);

  const visibleList = useMemo(
    () => filter === "all" ? movements : movements.filter(m => m.type === filter),
    [movements, filter],
  );

  return (
    <div>
      <TopBar title="Cassa" subtitle={`${tf.label} · ${tf.start.toLocaleDateString("it-IT")} → ${new Date(+tf.end - 1).toLocaleDateString("it-IT")}`} />

      <div className="px-4 md:px-6 pt-4 flex flex-wrap justify-end gap-2 items-center">
        <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
          {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {tfId === "custom" && (
          <>
            <input type="date" value={cs} onChange={e => setCs(e.target.value)}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs" />
            <input type="date" value={ce} onChange={e => setCe(e.target.value)}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs" />
          </>
        )}
      </div>


      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Entrate" value={formatEuro(kpi.entrate)} />
        <Kpi label="Uscite" value={formatEuro(kpi.uscite)} danger />
        <Kpi label="Ricavi" value={formatEuro(kpi.ricavi)} />
        <Kpi label="Utile" value={formatEuro(kpi.utile)} highlight />
      </div>

      <div className="px-4 md:px-6 flex gap-2 pb-2">
        {([
          { id: "all", label: "Tutti" },
          { id: "entrata", label: "Entrate" },
          { id: "uscita", label: "Uscite" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {visibleList.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nessun movimento nel periodo.</p>
        )}
        {visibleList.map(m => {
          const openable = m.id.startsWith("sale_") || m.id.startsWith("ord_");
          const onOpen = () => {
            if (m.id.startsWith("sale_")) { setEditSaleId(m.id.replace(/^sale_/, "")); setOpenSale(true); }
            else if (m.id.startsWith("ord_")) { setEditOrderId(m.id.replace(/^ord_/, "")); }
          };
          return (
            <button key={m.id} disabled={!openable} onClick={onOpen}
              onPointerUp={(e) => { if (openable && e.pointerType === "touch") onOpen(); }}
              className="w-full text-left bg-card rounded-xl p-3 flex justify-between items-center gap-3 disabled:cursor-default">
              <div className="min-w-0">
                <p className={`font-display text-base ${m.type === "entrata" ? "text-success" : "text-danger"}`}>
                  {m.type === "entrata" ? "+" : "−"} {formatEuro(m.amount)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.label}{m.meta ? ` · ${m.meta}` : ""}
                  {m.margin !== undefined && ` · margine ${formatEuro(m.margin)}`}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground shrink-0">{formatDate(m.date)}</p>
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setPickerOpen(true)} />

      {pickerOpen && !openOrder && !openSale && !openPay && !openDeliv && !editOrderId && !editSaleId && (
        <Sheet open={true} onClose={() => setPickerOpen(false)} title="Nuovo movimento">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <button onClick={() => setOpenOrder(true)}
              className="py-6 rounded-xl bg-brand-green text-brand-cream font-semibold">Nuovo Ordine</button>
            <button onClick={() => setOpenSale(true)}
              className="py-6 rounded-xl bg-brand-gold text-white font-semibold">Nuovo Scontrino</button>
            <button onClick={() => setOpenPay(true)}
              className="py-6 rounded-xl bg-danger text-white font-semibold">Nuovo Pagamento</button>
            <button onClick={() => setOpenDeliv(true)}
              className="py-6 rounded-xl bg-blue-600 text-white font-semibold">Nuova Consegna</button>
          </div>
        </Sheet>
      )}

      {openOrder && (
        <OrderSheet mode="new"
          onClose={() => { setOpenOrder(false); setPickerOpen(false); }}
          onSave={(payload) => { addOrder(payload); setOpenOrder(false); setPickerOpen(false); }} />
      )}

      {editOrderId && (
        <OrderSheet mode="edit" orderId={editOrderId}
          onClose={() => setEditOrderId(null)} />
      )}

      {openSale && (
        <NewSaleSheet key={editSaleId ?? "new"} open={true} saleId={editSaleId ?? undefined}
          onClose={() => { setOpenSale(false); setEditSaleId(null); setPickerOpen(false); }}
          onSave={(s, newClient) => {
            if (newClient) addClient(newClient);
            addCasualSale(s);
            setOpenSale(false);
            setPickerOpen(false);
          }} />
      )}


      {openPay && (
        <PaySheet mode="new" suppliers={suppliers}
          onClose={() => { setOpenPay(false); setPickerOpen(false); }}
          onSave={(d) => { addSupplierPayment(d as Omit<SupplierPayment, "id">); setOpenPay(false); setPickerOpen(false); }} />
      )}

      {openDeliv && (
        <DeliveryFullSheet mode="new" onClose={() => { setOpenDeliv(false); setPickerOpen(false); }} />
      )}
    </div>
  );
}

function Kpi({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}
