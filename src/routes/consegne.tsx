import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate, Fab } from "@/components/AppShell";
import type { DeliveryStatus, DeliveryPayment } from "@/lib/data";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { MapsBtn } from "@/components/QuickActions";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";
import { DeliveryFullSheet } from "@/components/DeliveryFullSheet";

export const Route = createFileRoute("/consegne")({ component: ConsegnePage });

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  da_preparare: "Da preparare", in_consegna: "In consegna",
  consegnata: "Consegnata", annullata: "Annullata",
};
const STATUS_STYLE: Record<DeliveryStatus, string> = {
  da_preparare: "bg-warning/15 text-warning",
  in_consegna: "bg-blue-600/15 text-blue-700",
  consegnata: "bg-success/15 text-success",
  annullata: "bg-danger/15 text-danger",
};
const PAY_LABEL: Record<DeliveryPayment, string> = {
  da_pagare: "Da pagare", pagato_anticipo: "Pagato (anticipo)", pagato_consegna: "Pagato alla consegna",
};

function toDateInput(d: Date) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(+d - tz).toISOString().slice(0, 10);
}

function ConsegnePage() {
  const { deliveries, clients, orders, updateDelivery, deleteDelivery } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [waId, setWaId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DeliveryStatus>>(new Set());

  // Timeframe
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const today = new Date();
  const [customStart, setCustomStart] = useState(toDateInput(today));
  const [customEnd, setCustomEnd] = useState(toDateInput(today));
  const tf = useMemo(() => {
    if (tfId === "custom") return makeTimeFrame("custom", new Date(customStart), new Date(customEnd));
    return makeTimeFrame(tfId);
  }, [tfId, customStart, customEnd]);

  const clientById = (id: string) => clients.find(c => c.id === id);

  const inPeriod = useMemo(() => deliveries.filter(d => inFrame(d.date, tf)), [deliveries, tf]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...inPeriod]
      .filter(d => statusFilter.size === 0 || statusFilter.has(d.status))
      .filter(d => {
        if (!t) return true;
        const c = clientById(d.clientId);
        return (c?.name.toLowerCase().includes(t) ?? false) || (c?.phone.includes(q) ?? false);
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [inPeriod, q, statusFilter, clients]);

  const aperte = inPeriod.filter(d => d.status === "da_preparare" || d.status === "in_consegna");
  const completate = inPeriod.filter(d => d.status === "consegnata");
  const fattGenerato = completate.reduce((s, d) => {
    const o = d.orderId ? orders.find(o => o.id === d.orderId) : null;
    return s + (o?.total ?? 0);
  }, 0);
  const valoreTotale = inPeriod
    .filter(d => d.status !== "annullata")
    .reduce((s, d) => {
      const o = d.orderId ? orders.find(o => o.id === d.orderId) : null;
      return s + (o?.total ?? 0);
    }, 0);

  const toggleStatus = (s: DeliveryStatus) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStatusFilter(next);
  };

  return (
    <div>
      <TopBar title="Consegne" subtitle={`${list.length} totali · ${tf.label}`} />

      <div className="px-4 md:px-6 pt-3 flex justify-end gap-1.5 items-center">
        <select value={tfId} onChange={(e) => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg p-2.5 text-sm font-semibold text-brand-green">
          {TIME_FRAME_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {tfId === "custom" && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-card border border-border rounded-lg p-2 text-xs" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-card border border-border rounded-lg p-2 text-xs" />
          </>
        )}
      </div>

      <div className="px-4 md:px-6 pt-3">
        <input placeholder="Cerca cliente o telefono..." value={q} onChange={(e) => setQ(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
      </div>

      <div className="px-4 md:px-6 pt-3 flex gap-1.5 overflow-x-auto pb-1 items-center">
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap pr-1">Status:</span>
        {(Object.keys(STATUS_LABEL) as DeliveryStatus[]).map(s => (
          <button key={s} onClick={() => toggleStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusFilter.has(s) ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Aperte" value={aperte.length.toString()} />
        <Kpi label="Completate" value={completate.length.toString()} />
        <Kpi label="Fatturato generato" value={formatEuro(fattGenerato)} highlight />
        <Kpi label="Valore totale" value={formatEuro(valoreTotale)} />
      </div>

      <div className="p-4 md:p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.length === 0 && <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">Nessuna consegna in questo periodo.</p>}
        {list.map(d => {
          const c = clientById(d.clientId);
          const o = d.orderId ? orders.find(o => o.id === d.orderId) : null;
          return (
            <div key={d.id} className="bg-card rounded-xl p-4 shadow-sm">
              <button onClick={() => setEditId(d.id)} className="w-full text-left">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg text-brand-green leading-tight truncate">{c?.name ?? d.clientNameInput ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{c?.phone ?? "—"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap ${STATUS_STYLE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                </div>
                <p className="text-sm text-foreground/85 mt-1">{d.address}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(d.date)} · {d.timeSlot} · {PAY_LABEL[d.payment]}
                  {o ? <> · <span className="font-semibold text-brand-green">{formatEuro(o.total)}</span></> : null}
                </p>
                {d.notes && <p className="text-xs italic text-muted-foreground mt-1">{d.notes}</p>}
              </button>
              <div className="flex flex-wrap gap-1.5 mt-3 items-center">
                <button onClick={() => setEditId(d.id)}
                  className="flex-1 min-w-[80px] text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 px-3 font-semibold">Modifica</button>
                {d.status !== "consegnata" && d.status !== "annullata" && (
                  <button onClick={() => updateDelivery(d.id, { status: "consegnata" })}
                    className="text-xs bg-success text-white rounded-lg px-3 py-1.5 font-semibold">Consegnata</button>
                )}
                {c?.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()}
                    className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 font-semibold">Chiama</a>
                )}
                {c?.phone && (
                  <button onClick={() => setWaId(d.id)}
                    className="text-xs bg-[#1FA855] text-white rounded-lg px-3 py-1.5 font-semibold">WhatsApp</button>
                )}
                <MapsBtn address={d.address} />
                <button onClick={() => setConfirmDel(d.id)} aria-label="Elimina"
                  className="text-danger border border-danger/40 hover:bg-danger/10 rounded-lg px-2 py-1.5 text-sm">🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <DeliveryFullSheet mode="new" onClose={() => setOpenNew(false)} />}
      {editId && <DeliveryFullSheet mode="edit" deliveryId={editId} onClose={() => setEditId(null)} />}
      {waId && (() => {
        const d = deliveries.find(x => x.id === waId);
        if (!d) return null;
        const c = clientById(d.clientId);
        return (
          <WhatsAppDialog open={true} onClose={() => setWaId(null)}
            phone={c?.phone ?? ""} context={{ client: c, delivery: d }}
            defaultTemplate="consegna_in_arrivo" templates={["consegna_in_arrivo", "libero"]} />
        );
      })()}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setConfirmDel(null)}>
          <div className="bg-brand-cream rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-brand-green mb-2">Elimina consegna</h3>
            <p className="text-sm text-foreground/80 mb-4">Sei sicuro di voler eliminare questa consegna?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg bg-card border border-border text-sm font-semibold">Annulla</button>
              <button onClick={() => { deleteDelivery(confirmDel); setConfirmDel(null); }}
                className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold">Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

