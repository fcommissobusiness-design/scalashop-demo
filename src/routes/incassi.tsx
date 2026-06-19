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
import { CustomDateBox } from "@/components/CustomDateBox";
import { PremiumBanner } from "@/components/DemoLock";

export const Route = createFileRoute("/incassi")({ component: CassaPage });

type Movement = {
  id: string;
  date: string;
  kind: "ordine" | "scontrino" | "consegna";
  amount: number;
  label: string;
  meta?: string;
  margin?: number;
};

function CassaPage() {
  const { orders, casualSales, deliveries, products, bundles, suppliers, addOrder, addCasualSale, addClient, addSupplierPayment } = useStore();

  const todayIso = new Date().toISOString().slice(0, 10);
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const [cs, setCs] = useState<string>(todayIso);
  const [ce, setCe] = useState<string>(todayIso);
  const tf = useMemo(
    () => tfId === "custom" ? makeTimeFrame("custom", new Date(cs), new Date(ce)) : makeTimeFrame(tfId),
    [tfId, cs, ce],
  );

  const [filter, setFilter] = useState<"all" | "ordine" | "scontrino" | "consegna">("all");
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
        kind: "ordine",
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
        kind: "scontrino",
        amount: s.total,
        label: "Scontrino",
        meta: s.paymentMethod ?? "—",
        margin: orderMargin({ items: s.items } as any, products, bundles),
      });
    }

    // Entrate da consegne consegnate e pagate
    for (const d of deliveries) {
      if (d.status !== "consegnata") continue;
      if (d.payment === "da_pagare") continue;
      if (!inFrame(d.date, tf)) continue;
      const linkedOrder = d.orderId ? orders.find(o => o.id === d.orderId) : undefined;
      out.push({
        id: `del_${d.id}`,
        date: d.date,
        kind: "consegna",
        amount: linkedOrder ? linkedOrder.total : 0,
        label: "Consegna",
        meta: d.clientNameInput || `Cliente ${d.clientId}`,
      });
    }

    return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [orders, casualSales, deliveries, products, bundles, tf]);

  // ============ KPI: solo entrate totali ============
  const entrateTot = useMemo(() => movements.reduce((s, m) => s + m.amount, 0), [movements]);
  const margineTot = useMemo(() => movements.reduce((s, m) => s + (m.margin ?? 0), 0), [movements]);

  const visibleList = useMemo(
    () => filter === "all" ? movements : movements.filter(m => m.kind === filter),
    [movements, filter],
  );

  return (
    <div>
      <TopBar
        title="Cassa"
        subtitle={`${tf.label} · ${tf.start.toLocaleDateString("it-IT")} → ${new Date(+tf.end - 1).toLocaleDateString("it-IT")}`}
        right={
          <div className="flex flex-wrap justify-end gap-1.5 items-center">
            <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
              className="bg-brand-cream text-brand-green border border-brand-gold/40 rounded-lg px-2 py-1.5 text-xs font-semibold">
              {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {tfId === "custom" && (
              <>
                <CustomDateBox label="Dal" value={cs} onChange={setCs} />
                <CustomDateBox label="Al" value={ce} onChange={setCe} />
              </>
            )}
          </div>
        }
      />

      {/* Filtri */}
      <div className="px-4 md:px-6 pt-4 flex flex-wrap gap-2">
        {([
          { id: "all", label: "Tutti" },
          { id: "ordine", label: "Ordini" },
          { id: "scontrino", label: "Scontrini" },
          { id: "consegna", label: "Consegne" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === t.id ? "bg-brand-green text-brand-cream border-brand-green" : "bg-card text-foreground/70 border-border hover:border-brand-gold/40"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI Entrate totali (sotto i filtri) */}
      <div className="p-4 md:p-6 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl p-4 bg-brand-green text-brand-cream text-center border border-brand-green">
            <p className="text-[11px] uppercase tracking-wide text-brand-gold">Entrate totali</p>
            <p className="font-display text-3xl mt-1 text-brand-gold">{formatEuro(entrateTot)}</p>
            <p className="text-[11px] text-brand-cream/70 mt-1">{tf.label.toLowerCase()}</p>
          </div>
          <div className="rounded-xl p-4 bg-card text-center border border-brand-green/25">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Margine</p>
            <p className="font-display text-3xl mt-1 text-brand-green">{formatEuro(margineTot)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">su ordini e scontrini del periodo</p>
          </div>
        </div>
      </div>

      {/* CTA Starter */}
      <div className="px-4 md:px-6 pb-2">
        <PremiumBanner
          title="Funzionalità disponibile nel piano a pagamento"
          text="Per visualizzare Costi, Ricavi, Utili e Margini attiva il piano a pagamento."
        />
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {visibleList.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nessun movimento nel periodo.</p>
        )}
        {visibleList.map(m => {
          const openable = m.kind === "scontrino" || m.kind === "ordine";
          const onOpen = () => {
            if (m.kind === "scontrino") { setEditSaleId(m.id.replace(/^sale_/, "")); setOpenSale(true); }
            else if (m.kind === "ordine") { setEditOrderId(m.id.replace(/^ord_/, "")); }
          };
          return (
            <button key={m.id} disabled={!openable} onClick={onOpen}
              onPointerUp={(e) => { if (openable && e.pointerType === "touch") onOpen(); }}
              className="w-full text-left bg-card border border-border rounded-xl p-3 flex justify-between items-center gap-3 disabled:cursor-default">
              <div className="min-w-0">
                <p className="font-display text-base text-success">
                  + {formatEuro(m.amount)}
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

