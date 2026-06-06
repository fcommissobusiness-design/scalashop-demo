import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatTime, formatDate, Fab, Sheet, Field } from "@/components/AppShell";
import { calcMargin, type CasualSale, type OrderItem, type OrderSource, type DeliveryMode, type PaymentMethod, type PaymentAttachment } from "@/lib/data";
import { InvoiceField } from "@/components/InvoiceField";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";
import {
  lateOrders,
  loyaltyReadyClients, openDeliveries, orderMargin,
  lowStockProducts, outOfStockProducts, supplierPaymentsOverdue,
  productionsForDate, itemDisplayName, cartTotal,
} from "@/lib/metrics";

import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { OrderSheet } from "@/routes/ordini";
import { PaySheet } from "@/routes/pagamenti";
import { CartEditor } from "@/components/CartEditor";
import { DeliveryFullSheet } from "@/components/DeliveryFullSheet";
import { buildSaleComanda, printComanda } from "@/lib/comanda";
import type { SupplierPayment } from "@/lib/data";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { orders, products, bundles, clients, casualSales, deliveries, supplierPayments, suppliers, productions, updateOrder, addCasualSale, addClient, addOrder, addSupplierPayment } = useStore();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const [customStart, setCustomStart] = useState<string>(todayIso);
  const [customEnd, setCustomEnd] = useState<string>(todayIso);

  const [openSale, setOpenSale] = useState(false);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [openOrder, setOpenOrder] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [openDeliv, setOpenDeliv] = useState(false);
  const [editDelivId, setEditDelivId] = useState<string | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [pickAction, setPickAction] = useState(false);
  const [waOpen, setWaOpen] = useState<{ phone: string; clientId?: string; orderId?: string } | null>(null);
  const navigate = useNavigate();

  const tf = useMemo(() => {
    if (tfId === "custom") return makeTimeFrame("custom", new Date(customStart), new Date(customEnd));
    return makeTimeFrame(tfId);
  }, [tfId, customStart, customEnd]);

  const ordersInFrame = orders.filter((o) => inFrame(o.pickupDate, tf));
  const salesInFrame = casualSales.filter((s) => inFrame(s.date, tf));
  const usciteFrame = supplierPayments
    .filter((p) => p.status !== "da_pagare" && inFrame(p.date, tf))
    .reduce((s, p) => s + p.amount, 0);

  const fattStimato = ordersInFrame.filter((o) => o.status === "in_attesa" || o.status === "pronto" || o.status === "da_consegnare").reduce((s, o) => s + o.total, 0);
  const fattGenerato =
    ordersInFrame.filter((o) => o.status === "ritirato" || o.status === "consegnato").reduce((s, o) => s + o.total, 0) +
    salesInFrame.reduce((s, o) => s + o.total, 0);
  const ticketMedio = salesInFrame.length === 0 ? 0 : salesInFrame.reduce((s, x) => s + x.total, 0) / salesInFrame.length;

  // Margine periodo: sincronizzato col timeframe (era "Margine giorno" fisso).
  const mPeriod = useMemo(() => {
    let m = 0;
    for (const o of ordersInFrame) {
      if (o.status === "ritirato" || o.status === "consegnato") m += orderMargin(o, products, bundles);
    }
    for (const s of salesInFrame) {
      m += orderMargin({ items: s.items } as any, products, bundles);
    }
    return m;
  }, [ordersInFrame, salesInFrame, products, bundles]);
  const ritardi = useMemo(() => lateOrders(orders), [orders]);
  const premi = useMemo(() => loyaltyReadyClients(clients), [clients]);
  const consegneAperte = useMemo(() => openDeliveries(deliveries), [deliveries]);
  const sottoCosto = products.filter((p) => { const m = calcMargin(p); return m !== null && m < 0; });
  const lowStock = useMemo(() => lowStockProducts(products), [products]);
  const outStock = useMemo(() => outOfStockProducts(products), [products]);
  const overduePay = useMemo(() => supplierPaymentsOverdue(supplierPayments), [supplierPayments]);
  const prodOggi = useMemo(() => productionsForDate(productions), [productions]);

  // "Ritiri" rispetta il timeframe + esclude finalizzati/annullati
  const ritiriFrame = ordersInFrame
    .filter((o) => o.status === "in_attesa" || o.status === "pronto" || o.status === "da_consegnare")
    .sort((a, b) => +new Date(a.pickupDate) - +new Date(b.pickupDate));

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);
  const openSaleEditor = (saleId: string) => {
    setEditSaleId(saleId);
    setOpenSale(true);
    setPickAction(false);
  };

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${tf.label} · ${tf.start.toLocaleDateString("it-IT")} → ${new Date(+tf.end - 1).toLocaleDateString("it-IT")}`}
        right={
          <select value={tfId} onChange={(e) => setTfId(e.target.value as TimeFrameId)}
            className="bg-brand-green-dark text-brand-cream text-xs rounded-lg px-2 py-2 border border-brand-gold/30">
            {TIME_FRAME_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        }
      />

      <div className="p-4 md:p-6 space-y-5 md:space-y-6">
        {tfId === "custom" && (
          <div className="bg-card rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center">
            <Field label="Dal">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="bg-brand-cream border border-border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Al">
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-brand-cream border border-border rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
        )}

        {/* ATTENZIONE */}
        {(ritardi.length > 0 || premi.length > 0 || sottoCosto.length > 0 || consegneAperte.length > 0 || lowStock.length > 0 || outStock.length > 0 || overduePay.length > 0 || prodOggi.filter(p => p.status === "da_preparare").length > 0) && (
          <section className="bg-warning/10 border border-warning/30 rounded-xl p-4">
            <h2 className="font-display text-base text-warning mb-2">Attenzione</h2>
            <ul className="text-sm space-y-1 text-foreground/85">
              {ritardi.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/ordini", search: { f: "ritardi" } as any })} className="underline underline-offset-2">{ritardi.length} ordine/i in ritardo</button></li>
              )}
              {prodOggi.filter(p => p.status === "da_preparare").length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/produzione" })} className="underline underline-offset-2">{prodOggi.filter(p => p.status === "da_preparare").length} preparazione/i da fare oggi</button></li>
              )}
              {outStock.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/magazzino" })} className="underline underline-offset-2 text-danger">{outStock.length} prodotto/i esaurito/i</button></li>
              )}
              {lowStock.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/magazzino" })} className="underline underline-offset-2">{lowStock.length} prodotto/i sotto soglia</button></li>
              )}
              {overduePay.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/pagamenti" })} className="underline underline-offset-2 text-danger">{overduePay.length} pagamento/i scaduto/i</button></li>
              )}
              {premi.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/clienti", search: { f: "premi" } as any })} className="underline underline-offset-2">{premi.length} cliente/i con premio fedeltà pronto</button></li>
              )}
              {sottoCosto.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/prodotti", search: { f: "sottocosto" } as any })} className="underline underline-offset-2">{sottoCosto.length} prodotto/i sotto costo</button></li>
              )}
              {consegneAperte.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/consegne" })} className="underline underline-offset-2">{consegneAperte.length} consegna/e ancora aperta/e</button></li>
              )}
            </ul>
          </section>
        )}

        {/* QUICK ACTIONS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Quick onClick={() => setOpenOrder(true)} label="Nuovo ordine" />
          <Quick onClick={() => setOpenSale(true)} label="Nuovo scontrino" />
          <Quick onClick={() => setOpenPay(true)} label="Nuovo pagamento" />
          <Quick onClick={() => setOpenDeliv(true)} label="Nuova consegna" />
        </section>

        {/* KPI CASSA */}
        <section>
          <h2 className="font-display text-sm uppercase tracking-wide text-muted-foreground mb-2">Cassa</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi to={{ to: "/ordini", search: { f: "ritirati" } as any }} label="Fatt. Generato" value={formatEuro(fattGenerato)} sub="ritirati + scontrini" highlight />
            <Kpi to={{ to: "/ordini", search: { f: "attesa" } as any }} label="Fatt. Stimato" value={formatEuro(fattStimato)} sub="in attesa + pronti" />
            <Kpi label="Margine" value={formatEuro(mPeriod)} sub={tf.label.toLowerCase()} />
            <Kpi to={{ to: "/pagamenti" }} label="Uscite" value={formatEuro(usciteFrame)} sub="periodo" danger />
            <Kpi label="Scontrino medio" value={formatEuro(ticketMedio)} sub={`${salesInFrame.length} scontrini`} />
          </div>
        </section>

        {/* RITIRI */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Ritiri ({ritiriFrame.length})</h2>
            <Link to="/ordini" className="text-xs text-brand-gold font-semibold">Tutti gli ordini →</Link>
          </div>
          {ritiriFrame.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessun ritiro nel periodo.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ritiriFrame.map((o) => {
              const c = clientById(o.clientId);
              const m = orderMargin(o, products, bundles);
              return (
                <div key={o.id} className="bg-card rounded-xl p-4 shadow-sm">
                  <button onClick={() => setEditOrderId(o.id)} className="w-full text-left">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <p className="font-display text-lg leading-tight text-brand-green">{c?.name ?? o.clientNameInput ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{o.delivery === "domicilio" ? "Consegna" : "Ritiro"} {formatTime(o.pickupDate)} · {formatEuro(o.total)} · margine {formatEuro(m)}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap ${o.status === "pronto" ? "bg-blue-600/15 text-blue-700" : o.status === "da_consegnare" ? "bg-purple-600/15 text-purple-700" : "bg-warning/15 text-warning"}`}>
                        {o.status === "pronto" ? "Pronto" : o.status === "da_consegnare" ? "Da Consegnare" : "Attesa"}
                      </span>
                    </div>
                    <ul className="text-sm text-foreground/80 mb-3 space-y-0.5">
                      {o.items.slice(0, 4).map((i, idx) => {
                        const name = itemDisplayName(i, products, bundles);
                        const p = productById(i.productId);
                        return <li key={idx}>· {name} <span className="text-muted-foreground">x{i.qty}{p?.unit === "kg" ? "kg" : ""}</span></li>;
                      })}
                      {o.items.length > 4 && <li className="text-xs text-muted-foreground">+ altri {o.items.length - 4}</li>}
                    </ul>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {o.status === "in_attesa" && (
                      <button onClick={() => updateOrder(o.id, { status: "pronto" })}
                        className="flex-1 bg-brand-green text-brand-cream rounded-lg py-1.5 text-xs font-semibold">Pronto</button>
                    )}
                    {o.delivery === "domicilio" ? (
                      <button onClick={() => updateOrder(o.id, { status: "consegnato" })}
                        className="flex-1 bg-success text-white rounded-lg py-1.5 text-xs font-semibold">Consegnato</button>
                    ) : (
                      <button onClick={() => updateOrder(o.id, { status: "ritirato" })}
                        className="flex-1 bg-success text-white rounded-lg py-1.5 text-xs font-semibold">Ritirato</button>
                    )}
                    <button onClick={() => { if (confirm("Annullare l'ordine?")) updateOrder(o.id, { status: "annullato" }); }}
                      className="bg-card border border-danger/40 text-danger rounded-lg px-2 py-1.5 text-xs font-semibold">Annulla</button>
                    {c?.phone && (
                      <button onClick={() => setWaOpen({ phone: c.phone, clientId: c.id, orderId: o.id })}
                        className="bg-brand-gold text-white rounded-lg px-2 py-1.5 text-xs font-semibold">WA</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SCONTRINI */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Scontrini ({salesInFrame.length})</h2>
          </div>
          {salesInFrame.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessuno scontrino nel periodo.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {salesInFrame.slice(0, 12).map((s) => {
              const c = s.clientId ? clientById(s.clientId) : null;
              return (
                <button key={s.id} type="button" onClick={() => openSaleEditor(s.id)}
                  onPointerUp={(e) => { if (e.pointerType === "touch") openSaleEditor(s.id); }}
                  className="bg-card rounded-xl p-3 text-sm text-left active:opacity-80 touch-manipulation">
                  <div className="flex justify-between">
                    <span className="font-semibold">{c?.name ?? s.clientNameInput ?? "Anonimo"}</span>
                    <span className="text-brand-green font-bold">{formatEuro(s.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatTime(s.date)} · {new Date(s.date).toLocaleDateString("it-IT")}</p>
                  <p className="text-xs text-foreground/70 mt-1">{s.items.map(i => itemDisplayName(i, products, bundles)).join(", ")}</p>
                  {s.notes && <p className="text-xs italic text-muted-foreground mt-1 line-clamp-1">Note: {s.notes}</p>}
                </button>
              );
            })}

          </div>
        </section>

        {/* CONSEGNE */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Consegne ({consegneAperte.length})</h2>
            <Link to="/consegne" className="text-xs text-brand-gold font-semibold">Tutte le consegne →</Link>
          </div>
          {consegneAperte.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessuna consegna aperta.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {consegneAperte.slice(0, 8).map((d) => {
              const c = clientById(d.clientId);
              const o = d.orderId ? orders.find(x => x.id === d.orderId) : null;
              return (
                <button key={d.id} type="button" onClick={() => setEditDelivId(d.id)}
                  className="bg-card rounded-xl p-3 text-left text-sm shadow-sm touch-manipulation">
                  <div className="flex justify-between">
                    <span className="font-semibold">{c?.name ?? d.clientNameInput ?? "—"}</span>
                    {o && <span className="text-brand-green font-bold">{formatEuro(o.total)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(d.date)} · {d.timeSlot} · {d.status.replace(/_/g, " ")}</p>
                  <p className="text-xs text-foreground/70 mt-1 truncate">{d.address}</p>
                </button>
              );
            })}

          </div>
        </section>
      </div>

      <Fab onClick={() => setPickAction(true)} />

      {pickAction && (
        <Sheet open={true} onClose={() => setPickAction(false)} title="Cosa vuoi creare?">
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => { setPickAction(false); setOpenOrder(true); }}
              className="bg-brand-green text-brand-cream rounded-xl py-4 font-semibold">Nuovo ordine</button>
            <button onClick={() => { setPickAction(false); setOpenSale(true); }}
              className="bg-brand-gold text-white rounded-xl py-4 font-semibold">Nuovo scontrino</button>
            <button onClick={() => { setPickAction(false); setOpenPay(true); }}
              className="bg-danger text-white rounded-xl py-4 font-semibold">Nuovo pagamento</button>
            <button onClick={() => { setPickAction(false); setOpenDeliv(true); }}
              className="bg-blue-600 text-white rounded-xl py-4 font-semibold">Nuova consegna</button>
          </div>
        </Sheet>
      )}

      {openOrder && (
        <OrderSheet mode="new" onClose={() => setOpenOrder(false)}
          onSave={(payload) => { addOrder(payload); setOpenOrder(false); }} />
      )}

      {editOrderId && (
        <OrderSheet mode="edit" orderId={editOrderId} onClose={() => setEditOrderId(null)} />
      )}

      {openPay && (
        <PaySheet mode="new" suppliers={suppliers}
          onClose={() => setOpenPay(false)}
          onSave={(d) => { addSupplierPayment(d as Omit<SupplierPayment, "id">); setOpenPay(false); }} />
      )}

      {openDeliv && (
        <DeliveryFullSheet mode="new" onClose={() => setOpenDeliv(false)} />
      )}

      {editDelivId && (
        <DeliveryFullSheet mode="edit" deliveryId={editDelivId} onClose={() => setEditDelivId(null)} />
      )}

      {openSale && (
        <NewSaleSheet
          key={editSaleId ?? "new"}
          open={true}
          saleId={editSaleId ?? undefined}
          onClose={() => { setOpenSale(false); setEditSaleId(null); }}
          onSave={(s, newClient) => {
            if (newClient) addClient(newClient);
            addCasualSale(s);
            setOpenSale(false);
          }}
        />
      )}



      {waOpen && (
        <WhatsAppDialog
          open={true}
          onClose={() => setWaOpen(null)}
          phone={waOpen.phone}
          context={{
            client: clients.find(c => c.id === waOpen.clientId),
            order: waOpen.orderId ? orders.find(o => o.id === waOpen.orderId) : undefined,
            productNames: waOpen.orderId ? orders.find(o => o.id === waOpen.orderId)?.items.map(i => itemDisplayName(i, products, bundles)) : undefined,
          }}
          defaultTemplate={waOpen.orderId ? "promemoria_ritiro" : "libero"}
        />
      )}
    </div>
  );
}

function Quick({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="bg-brand-green text-brand-cream rounded-xl px-3 py-3 text-xs md:text-sm font-semibold text-left active:opacity-80">
      {label}
    </button>
  );
}

function Kpi({ label, value, sub, danger, highlight, to }: { label: string; value: string; sub?: string; danger?: boolean; highlight?: boolean; to?: any }) {
  const inner = (
    <div className={`rounded-xl p-4 shadow-sm ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${highlight ? "text-brand-cream/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
  if (to) return <Link to={to.to} search={to.search} className="block">{inner}</Link>;
  return inner;
}


const SALE_SOURCE_OPTIONS: OrderSource[] = ["negozio", "whatsapp", "telefono", "sito", "altro"];
const SALE_SOURCE_LABEL: Record<OrderSource, string> = {
  negozio: "Negozio", whatsapp: "WhatsApp", telefono: "Telefono",
  sito: "Sito", altro: "Altro", consegna: "Negozio", b2b: "Negozio",
};
const SALE_DELIVERY_LABEL: Record<DeliveryMode, string> = {
  ritiro: "Ritiro in negozio", domicilio: "Consegna a domicilio",
};

export function NewSaleSheet({ open, saleId, onClose, onSave }: {
  open: boolean;
  saleId?: string;
  onClose: () => void;
  onSave: (s: Omit<CasualSale, "id">, newClient?: { name: string; phone: string; segment: "nuovi"; stamps: 0 }) => void;
}) {
  const { clients, products, bundles, casualSales, addClient, updateClient, updateCasualSale, deleteCasualSale } = useStore();
  const existing = saleId ? casualSales.find(s => s.id === saleId) : null;
  const isEdit = !!existing;

  const [date, setDate] = useState(() => {
    const d = existing ? new Date(existing.date) : (() => { const x = new Date(); x.setMinutes(0); return x; })();
    return d.toISOString().slice(0, 16);
  });
  const [items, setItems] = useState<OrderItem[]>(existing?.items ?? []);
  const initClientName = existing
    ? (clients.find(c => c.id === existing.clientId)?.name ?? existing.clientNameInput ?? "")
    : "";
  const [clientName, setClientName] = useState(initClientName);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [source, setSource] = useState<OrderSource>(existing?.source ?? "negozio");
  const [delivery, setDelivery] = useState<DeliveryMode>(existing?.delivery ?? "ritiro");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? "contanti");
  const [hasInvoice, setHasInvoice] = useState<boolean>(existing?.hasInvoice ?? false);
  const [invoice, setInvoice] = useState<PaymentAttachment | undefined>(existing?.invoice);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const matched = clients.find((c) => c.name.toLowerCase() === clientName.trim().toLowerCase());
  const suggestions = clientName.length >= 2 && !matched
    ? clients.filter((c) => c.name.toLowerCase().includes(clientName.toLowerCase()) || c.phone.includes(clientName)).slice(0, 6) : [];

  const matchedId = matched?.id;
  const matchedPhone = matched?.phone ?? "";
  useEffect(() => {
    setPhone(matchedPhone);
  }, [matchedId, matchedPhone]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  const phoneOptions = matched
    ? Array.from(new Set([matched.phone, ...(matched.phones ?? [])].filter(Boolean)))
    : [];

  const total = cartTotal(items, products, bundles);

  const reset = () => {
    setItems([]); setClientName(""); setPhone(""); setNotes(""); setSource("negozio");
    setDelivery("ritiro"); setPaymentMethod("contanti"); setHasInvoice(false); setInvoice(undefined);
  };

  const persistPhoneIfChanged = () => {
    if (!matched) return;
    const trimmed = phone.trim();
    if (!trimmed || trimmed === matched.phone) return;
    const others = (matched.phones ?? []).filter(p => p && p !== trimmed && p !== matched.phone);
    const newPhones = [matched.phone, ...others].filter(Boolean);
    updateClient(matched.id, { phone: trimmed, phones: newPhones });
  };

  const save = () => {
    if (items.length === 0) return;

    // Risolvi/crea cliente inline (così il sale.clientId punta sempre al record reale).
    let effClientId: string | undefined = matched?.id;
    const typed = clientName.trim();
    if (!effClientId && typed) {
      const created = addClient({
        name: typed, phone: phone.trim(),
        segment: "nuovi", stamps: 0,
      } as Omit<import("@/lib/data").Client, "id">);
      effClientId = created.id;
    } else if (effClientId) {
      persistPhoneIfChanged();
    }

    const sale: Omit<CasualSale, "id"> = {
      date: new Date(date).toISOString(),
      items, total,
      clientId: effClientId,
      clientNameInput: typed || undefined, // sempre il nome digitato come fallback
      notes: notes.trim() || undefined,
      source, delivery, paymentMethod,
      hasInvoice, invoice: hasInvoice ? invoice : undefined,
    };
    if (isEdit && existing) {
      updateCasualSale(existing.id, sale);
      onClose();
      return;
    }
    reset();
    onSave(sale);
  };

  const handleDelete = () => {
    if (!existing) return;
    if (confirm("Eliminare questo scontrino?")) { deleteCasualSale(existing.id); onClose(); }
  };


  const printPreview = () => {
    if (items.length === 0) return;
    const fakeSale = {
      id: existing?.id ?? "PREVIEW",
      date: new Date(date).toISOString(),
      items, total,
      clientId: matched?.id,
      clientNameInput: clientName.trim() || undefined,
      notes: notes.trim() || undefined,
      source, delivery, paymentMethod,
      hasInvoice, invoice: hasInvoice ? invoice : undefined,
    } as CasualSale;
    printComanda(buildSaleComanda(fakeSale, matched, products, bundles));
    setMenuOpen(false);
  };

  return (
    <Sheet open={open} onClose={onClose} title={isEdit ? "Modifica scontrino" : "Nuovo scontrino"}
      footer={
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <p className="text-[10px] uppercase text-muted-foreground">Totale</p>
            <p className="font-display text-2xl text-brand-green leading-none">{formatEuro(total)}</p>
          </div>
          <button onClick={printPreview} disabled={items.length === 0}
            className="bg-card border border-border rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-40">🖨️ Stampa Comanda</button>
          {isEdit && (
            <button onClick={handleDelete}
              className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={items.length === 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            {isEdit ? "Salva modifiche" : "Conferma scontrino"}
          </button>
        </div>
      }

    >
      {isEdit && (
        <div className="flex justify-end -mt-2 -mr-1" ref={menuRef}>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-lg leading-none" aria-label="Altre azioni">⋮</button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[180px]">
                <button onClick={printPreview}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-cream">🖨️ Stampa Comanda</button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Data e ora">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Origine">
          <select value={source} onChange={(e) => setSource(e.target.value as OrderSource)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {SALE_SOURCE_OPTIONS.map(s => <option key={s} value={s}>{SALE_SOURCE_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Delivery">
          <select value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryMode)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(SALE_DELIVERY_LABEL) as DeliveryMode[]).map(d => <option key={d} value={d}>{SALE_DELIVERY_LABEL[d]}</option>)}
          </select>
        </Field>
        <Field label="Metodo di pagamento">
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="contanti">Contanti</option>
            <option value="pos">POS</option>
            <option value="bonifico">Bonifico</option>
            <option value="carta">Carta</option>
            <option value="altro">Altro</option>
          </select>
        </Field>
      </div>

      <Field label="Cliente (facoltativo)">
        <input placeholder="Nome cliente o lascia vuoto" value={clientName} onChange={(e) => setClientName(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3" />
        {matched && <p className="text-xs text-success mt-1">Cliente esistente: si aggiungerà allo storico di {matched.name}.</p>}
        {!matched && clientName.trim().length >= 2 && (
          <p className="text-xs text-brand-gold mt-1">Nuovo cliente: verrà creata una scheda al salvataggio.</p>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => setClientName(c.name)}
                className="text-xs bg-brand-cream border border-border rounded-full px-2 py-1">{c.name}</button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Telefono (facoltativo)">
        <div className="flex gap-1">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 ..."
            className="flex-1 bg-card border border-border rounded-lg p-3" />
          {phoneOptions.length > 1 && (
            <select value={phone} onChange={(e) => setPhone(e.target.value)}
              className="bg-card border border-border rounded-lg px-2 text-sm" aria-label="Scegli numero">
              {phoneOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
        {matched && phone.trim() && phone.trim() !== matched.phone && !(matched.phones ?? []).includes(phone.trim()) && (
          <p className="text-[11px] text-brand-gold mt-1">Verrà salvato come ulteriore recapito nella scheda cliente.</p>
        )}
      </Field>

      <Field label="Prodotti, bundle e righe personalizzate">
        <CartEditor items={items} onChange={setItems} />
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Note per la comanda (es. preparazione, allergie, dettagli)..."
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      <InvoiceField
        hasInvoice={hasInvoice}
        onHasInvoiceChange={setHasInvoice}
        invoice={invoice}
        onInvoiceChange={setInvoice}
      />
    </Sheet>
  );
}

