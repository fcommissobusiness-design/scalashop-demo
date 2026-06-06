import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatEuro, formatDate } from "@/components/AppShell";
import {
  ECOM_ORDER_STATUS_LABEL, ECOM_PAYMENT_STATUS_LABEL, ECOM_PLATFORM_LABEL,
  SHIPMENT_STATUS_LABEL,
  type OnlineOrder, type OnlineOrderItem, type Shipment,
  type EcomOrderStatus, type EcomPaymentStatus, type EcomPlatform, type ShipmentStatus,
  calcOnlineOrderCost,
} from "@/lib/data";
import {
  ecomOrdersInMonth, ecomRevenueMonth, ecomMarginMonth, ecomShippingCostMonth,
  shipmentsByStatus, avgShippingCost, ecomByPlatform, topOnlineProducts,
  problematicOnlineOrders,
} from "@/lib/metrics";
import { whatsappUrl, telUrl, normalizePhone } from "@/lib/whatsapp";

export const Route = createFileRoute("/ecommerce")({ component: EcomPage });

const STATUS_STYLE: Record<EcomOrderStatus, string> = {
  ricevuto: "bg-warning/15 text-warning",
  in_preparazione: "bg-blue-500/15 text-blue-700",
  spedito: "bg-purple-500/15 text-purple-700",
  consegnato: "bg-success/15 text-success",
  annullato: "bg-danger/15 text-danger",
};
const PAY_STYLE: Record<EcomPaymentStatus, string> = {
  pagato: "bg-success/15 text-success",
  da_pagare: "bg-warning/15 text-warning",
  rimborsato: "bg-danger/15 text-danger",
};
const SHIP_STYLE: Record<ShipmentStatus, string> = {
  da_preparare: "bg-warning/15 text-warning",
  affidata: "bg-blue-500/15 text-blue-700",
  in_transito: "bg-purple-500/15 text-purple-700",
  consegnata: "bg-success/15 text-success",
  problema: "bg-danger/15 text-danger",
};

function EcomPage() {
  const s = useStore();
  const today = new Date();
  const [tab, setTab] = useState<"dashboard" | "ordini" | "spedizioni" | "import">("dashboard");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [shipEditId, setShipEditId] = useState<string | null>(null);
  const [shipNewFor, setShipNewFor] = useState<string | null>(null);

  const monthOrders = ecomOrdersInMonth(s.onlineOrders, today);
  const revenue = ecomRevenueMonth(s.onlineOrders, today);
  const margin = ecomMarginMonth(s.onlineOrders, s.products, today);
  const shippingCost = ecomShippingCostMonth(s.onlineOrders, today);
  const shipStatus = shipmentsByStatus(s.shipments);
  const avgShip = avgShippingCost(s.onlineOrders);
  const byPlatform = ecomByPlatform(s.onlineOrders, s.products, today);
  const topProducts = topOnlineProducts(s.onlineOrders, s.products, 5);
  const problematic = problematicOnlineOrders(s.onlineOrders, s.shipments);

  return (
    <div>
      <TopBar title="E-commerce" subtitle={`${monthOrders.length} ordini · ${formatEuro(revenue)} mese`} />

      <div className="px-4 md:px-6 flex gap-2 pb-2 overflow-x-auto">
        {(["dashboard", "ordini", "spedizioni", "import"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "dashboard" ? "Dashboard" : t === "ordini" ? "Ordini" : t === "spedizioni" ? "Spedizioni" : "Importa CSV"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Ordini online mese" value={String(monthOrders.length)} highlight />
            <Kpi label="Fatturato mese" value={formatEuro(revenue)} success />
            <Kpi label="Margine stimato" value={formatEuro(margin)} />
            <Kpi label="Costi spedizioni" value={formatEuro(shippingCost)} danger />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Da preparare" value={String(shipStatus.da_preparare)} warn />
            <Kpi label="In transito" value={String(shipStatus.in_transito + shipStatus.affidata)} />
            <Kpi label="Consegnate" value={String(shipStatus.consegnata)} success />
            <Kpi label="Problemi" value={String(shipStatus.problema)} danger={shipStatus.problema > 0} />
          </div>

          {byPlatform.length > 0 && (
            <section className="bg-card rounded-xl p-4">
              <p className="text-xs uppercase font-bold text-brand-green mb-3">Per piattaforma (mese)</p>
              <div className="space-y-2">
                {byPlatform.map(b => (
                  <div key={b.platform} className="flex justify-between text-sm">
                    <span>{ECOM_PLATFORM_LABEL[b.platform]} · {b.orders} ord.</span>
                    <span className="font-semibold">{formatEuro(b.revenue)} <span className="text-xs text-muted-foreground">· {formatEuro(b.margin)} margine</span></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {topProducts.length > 0 && (
            <section className="bg-card rounded-xl p-4">
              <p className="text-xs uppercase font-bold text-brand-green mb-3">Top prodotti online</p>
              <div className="space-y-1.5">
                {topProducts.map(t => (
                  <div key={t.product.id} className="flex justify-between text-sm">
                    <span className="truncate">{t.product.name}</span>
                    <span className="font-semibold">{t.qty} {t.product.unit} · {formatEuro(t.revenue)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-card rounded-xl p-4">
            <p className="text-xs uppercase font-bold text-brand-green mb-3">Spedizioni</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>Costo medio: <span className="font-semibold">{formatEuro(avgShip)}</span></div>
              <div>Tot spedizioni: <span className="font-semibold">{s.shipments.length}</span></div>
            </div>
          </section>

          {problematic.length > 0 && (
            <section className="bg-danger/10 rounded-xl p-4">
              <p className="text-xs uppercase font-bold text-danger mb-2">{problematic.length} ordini problematici</p>
              <div className="space-y-1 text-sm">
                {problematic.slice(0, 5).map(o => (
                  <button key={o.id} onClick={() => { setTab("ordini"); setEditId(o.id); }}
                    className="block w-full text-left">
                    {o.externalNumber} — {o.customerName} ({ECOM_ORDER_STATUS_LABEL[o.status]} / {ECOM_PAYMENT_STATUS_LABEL[o.paymentStatus]})
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-3 py-1">
            Sezione manuale. Nessuna sincronizzazione automatica con Shopify/WooCommerce. Importa via CSV.
          </p>
        </div>
      )}

      {tab === "ordini" && (
        <div className="p-4 md:p-6 space-y-2">
          {s.onlineOrders.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun ordine online.</p>}
          {[...s.onlineOrders].sort((a, b) => +new Date(b.date) - +new Date(a.date)).map(o => (
            <button key={o.id} onClick={() => setEditId(o.id)}
              className="w-full text-left bg-card rounded-xl p-3">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base text-brand-green truncate">{o.externalNumber} · {o.customerName}</p>
                  <p className="text-xs text-muted-foreground">{ECOM_PLATFORM_LABEL[o.platform]} · {formatDate(o.date)}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[o.status]}`}>{ECOM_ORDER_STATUS_LABEL[o.status]}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PAY_STYLE[o.paymentStatus]}`}>{ECOM_PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg text-brand-green">{formatEuro(o.total)}</p>
                  <p className="text-[10px] text-muted-foreground">cost: {formatEuro(calcOnlineOrderCost(o, s.products))}</p>
                </div>
              </div>
              <QuickLinks phone={o.phone} email={o.email} address={o.shippingAddress} message={`Ciao ${o.customerName.split(" ")[0]}, aggiornamento ordine ${o.externalNumber}: `} />
            </button>
          ))}
        </div>
      )}

      {tab === "spedizioni" && (
        <div className="p-4 md:p-6 space-y-2">
          {s.shipments.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessuna spedizione.</p>}
          {[...s.shipments].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map(sh => {
            const order = s.onlineOrders.find(o => o.id === sh.orderId);
            return (
              <button key={sh.id} onClick={() => setShipEditId(sh.id)} className="w-full text-left bg-card rounded-xl p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base text-brand-green truncate">{sh.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{order?.externalNumber ?? "—"} · {sh.carrier ?? "Corriere n/d"}</p>
                    {sh.trackingNumber && <p className="text-[11px] text-muted-foreground mt-0.5">Tracking: {sh.trackingNumber}</p>}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SHIP_STYLE[sh.status]}`}>{SHIPMENT_STATUS_LABEL[sh.status]}</span>
                      {sh.expectedDelivery && <span className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">prev. {formatDate(sh.expectedDelivery)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {sh.shippingCost !== undefined && <p className="font-display text-base text-brand-green">{formatEuro(sh.shippingCost)}</p>}
                  </div>
                </div>
                <TrackingLinks tracking={sh.trackingNumber} url={sh.trackingUrl} />
              </button>
            );
          })}
        </div>
      )}

      {tab === "import" && <ImportTab onDone={() => setTab("ordini")} />}

      {tab === "ordini" && <Fab onClick={() => setOpenNew(true)} />}
      {tab === "spedizioni" && <Fab onClick={() => setShipNewFor("__new__")} />}

      {openNew && <OrderSheet mode="new" onClose={() => setOpenNew(false)}
        onSave={(d) => { s.addOnlineOrder(d as Omit<OnlineOrder, "id" | "createdAt">); setOpenNew(false); }} />}
      {editId && (() => {
        const o = s.onlineOrders.find(x => x.id === editId);
        if (!o) return null;
        return <OrderSheet mode="edit" order={o} onClose={() => setEditId(null)}
          onSave={(p) => { s.updateOnlineOrder(o.id, p); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare ordine?")) { s.deleteOnlineOrder(o.id); setEditId(null); } }}
          onCreateShipment={() => { setEditId(null); setShipNewFor(o.id); }} />;
      })()}
      {shipEditId && (() => {
        const sh = s.shipments.find(x => x.id === shipEditId);
        if (!sh) return null;
        return <ShipmentSheet mode="edit" shipment={sh} orders={s.onlineOrders} onClose={() => setShipEditId(null)}
          onSave={(p) => { s.updateShipment(sh.id, p); setShipEditId(null); }}
          onDelete={() => { if (confirm("Eliminare spedizione?")) { s.deleteShipment(sh.id); setShipEditId(null); } }} />;
      })()}
      {shipNewFor && (
        <ShipmentSheet mode="new" orders={s.onlineOrders} preselectOrderId={shipNewFor === "__new__" ? undefined : shipNewFor}
          onClose={() => setShipNewFor(null)}
          onSave={(d) => { s.addShipment(d as Omit<Shipment, "id" | "createdAt">); setShipNewFor(null); }} />
      )}
    </div>
  );
}

function Kpi({ label, value, highlight, danger, success, warn }: {
  label: string; value: string; highlight?: boolean; danger?: boolean; success?: boolean; warn?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : success ? "text-success" : warn ? "text-warning" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function QuickLinks({ phone, email, address, message }: { phone?: string; email?: string; address?: string; message: string }) {
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };
  const items: { label: string; url: string }[] = [];
  if (phone && normalizePhone(phone)) items.push({ label: "WhatsApp", url: whatsappUrl(phone, message) }, { label: "Chiama", url: telUrl(phone) });
  if (email) items.push({ label: "Email", url: `mailto:${email}?subject=${encodeURIComponent(message)}` });
  if (address) items.push({ label: "Maps", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` });
  if (!items.length) return null;
  return (
    <div className="mt-2 flex gap-2 flex-wrap" onClick={stop}>
      {items.map(it => (
        <a key={it.label} href={it.url} target="_blank" rel="noopener noreferrer"
          className="text-[11px] bg-brand-green/10 text-brand-green rounded-full px-2.5 py-1 font-semibold">{it.label}</a>
      ))}
    </div>
  );
}

function TrackingLinks({ tracking, url }: { tracking?: string; url?: string }) {
  if (!tracking && !url) return null;
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };
  return (
    <div className="mt-2 flex gap-2 flex-wrap" onClick={stop}>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[11px] bg-brand-gold/15 text-brand-gold rounded-full px-2.5 py-1 font-semibold">Apri tracking</a>
      )}
      {tracking && (
        <button onClick={() => { navigator.clipboard?.writeText(tracking); }}
          className="text-[11px] bg-card border border-border rounded-full px-2.5 py-1 font-semibold">Copia {tracking}</button>
      )}
    </div>
  );
}

// ============= ORDER SHEET =============

const PLATFORMS: EcomPlatform[] = ["shopify", "woocommerce", "altro"];
const ORDER_STATUSES: EcomOrderStatus[] = ["ricevuto", "in_preparazione", "spedito", "consegnato", "annullato"];
const PAY_STATUSES: EcomPaymentStatus[] = ["pagato", "da_pagare", "rimborsato"];

function OrderSheet({ mode, order, onClose, onSave, onDelete, onCreateShipment }: {
  mode: "new" | "edit"; order?: OnlineOrder;
  onClose: () => void; onSave: (d: Omit<OnlineOrder, "id" | "createdAt"> | Partial<OnlineOrder>) => void;
  onDelete?: () => void; onCreateShipment?: () => void;
}) {
  const { products } = useStore();
  const [date, setDate] = useState(order?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<EcomPlatform>(order?.platform ?? "shopify");
  const [externalNumber, setExternalNumber] = useState(order?.externalNumber ?? "");
  const [customerName, setCustomerName] = useState(order?.customerName ?? "");
  const [email, setEmail] = useState(order?.email ?? "");
  const [phone, setPhone] = useState(order?.phone ?? "");
  const [shippingAddress, setShippingAddress] = useState(order?.shippingAddress ?? "");
  const [items, setItems] = useState<OnlineOrderItem[]>(order?.items ?? []);
  const [total, setTotal] = useState(order?.total ?? 0);
  const [estimatedCost, setEstimatedCost] = useState<number | undefined>(order?.estimatedCost);
  const [shippingCost, setShippingCost] = useState<number | undefined>(order?.shippingCost);
  const [status, setStatus] = useState<EcomOrderStatus>(order?.status ?? "ricevuto");
  const [paymentStatus, setPaymentStatus] = useState<EcomPaymentStatus>(order?.paymentStatus ?? "pagato");
  const [notes, setNotes] = useState(order?.notes ?? "");

  const computedCost = useMemo(() => items.reduce((s, it) => {
    const p = products.find((x) => x.id === it.productId);
    return s + (p?.cost ?? 0) * it.qty;
  }, 0), [items, products]);

  const addItem = () => setItems([...items, { productId: products[0]?.id ?? "", qty: 1, unitPrice: products[0]?.price }]);
  const updItem = (i: number, patch: Partial<OnlineOrderItem>) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const delItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const save = () => {
    if (!externalNumber.trim() || !customerName.trim()) return;
    onSave({
      date: new Date(date).toISOString(), platform,
      externalNumber: externalNumber.trim(), customerName: customerName.trim(),
      email: email.trim() || undefined, phone: phone.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      items, total: Number(total),
      estimatedCost: estimatedCost ?? computedCost,
      shippingCost, status, paymentStatus,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo ordine online" : `Ordine ${order?.externalNumber}`}
      footer={
        <div className="flex gap-2 flex-wrap">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          {mode === "edit" && onCreateShipment && (
            <button onClick={onCreateShipment} className="text-brand-green border border-brand-green/40 rounded-xl px-3 py-3 text-sm font-semibold">+ Spedizione</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Piattaforma">
          <select value={platform} onChange={e => setPlatform(e.target.value as EcomPlatform)} className="w-full bg-card border border-border rounded-lg p-3">
            {PLATFORMS.map(p => <option key={p} value={p}>{ECOM_PLATFORM_LABEL[p]}</option>)}
          </select>
        </Field>
        <Field label="N° ordine"><input value={externalNumber} onChange={e => setExternalNumber(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Cliente"><input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Telefono"><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
      </div>
      <Field label="Indirizzo spedizione">
        <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Prodotti</p>
          <button onClick={addItem} className="text-xs bg-brand-green text-brand-cream rounded-full px-3 py-1 font-semibold">+ Riga</button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select value={it.productId} onChange={e => updItem(i, { productId: e.target.value })}
                className="col-span-7 bg-card border border-border rounded-lg p-2 text-sm">
                <option value="">— Prodotto —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" step="0.001" value={it.qty} onChange={e => updItem(i, { qty: Number(e.target.value) })}
                className="col-span-2 bg-card border border-border rounded-lg p-2 text-sm" />
              <input type="number" step="0.01" placeholder="€" value={it.unitPrice ?? ""} onChange={e => updItem(i, { unitPrice: Number(e.target.value) || undefined })}
                className="col-span-2 bg-card border border-border rounded-lg p-2 text-sm" />
              <button onClick={() => delItem(i)} className="col-span-1 text-danger text-sm">×</button>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground">Nessun prodotto. Aggiungi una riga oppure lascia vuoto e usa solo il totale.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Totale (€)"><input type="number" step="0.01" value={total} onChange={e => setTotal(Number(e.target.value))} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Costo stimato (€)">
          <input type="number" step="0.01" placeholder={String(computedCost.toFixed(2))} value={estimatedCost ?? ""}
            onChange={e => setEstimatedCost(e.target.value === "" ? undefined : Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Costo spedizione (€)">
          <input type="number" step="0.01" value={shippingCost ?? ""} onChange={e => setShippingCost(e.target.value === "" ? undefined : Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Margine stimato">
          <p className="p-3 font-display text-brand-green">{formatEuro(total - (estimatedCost ?? computedCost) - (shippingCost ?? 0))}</p>
        </Field>
        <Field label="Stato ordine">
          <select value={status} onChange={e => setStatus(e.target.value as EcomOrderStatus)} className="w-full bg-card border border-border rounded-lg p-3">
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{ECOM_ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Stato pagamento">
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as EcomPaymentStatus)} className="w-full bg-card border border-border rounded-lg p-3">
            {PAY_STATUSES.map(s => <option key={s} value={s}>{ECOM_PAYMENT_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Note"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" /></Field>
      <p className="text-[11px] text-muted-foreground italic">Stato spedito/consegnato scarica automaticamente lo stock dei prodotti collegati.</p>
    </Sheet>
  );
}

// ============= SHIPMENT SHEET =============

const SHIP_STATUSES: ShipmentStatus[] = ["da_preparare", "affidata", "in_transito", "consegnata", "problema"];

function ShipmentSheet({ mode, shipment, orders, onClose, onSave, onDelete, preselectOrderId }: {
  mode: "new" | "edit"; shipment?: Shipment; orders: OnlineOrder[];
  onClose: () => void; onSave: (d: Omit<Shipment, "id" | "createdAt"> | Partial<Shipment>) => void;
  onDelete?: () => void; preselectOrderId?: string;
}) {
  const [orderId, setOrderId] = useState(shipment?.orderId ?? preselectOrderId ?? orders[0]?.id ?? "");
  const order = orders.find(o => o.id === orderId);
  const [customerName, setCustomerName] = useState(shipment?.customerName ?? order?.customerName ?? "");
  const [address, setAddress] = useState(shipment?.address ?? order?.shippingAddress ?? "");
  const [carrier, setCarrier] = useState(shipment?.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(shipment?.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(shipment?.trackingUrl ?? "");
  const [shippingCost, setShippingCost] = useState<number | undefined>(shipment?.shippingCost ?? order?.shippingCost);
  const [status, setStatus] = useState<ShipmentStatus>(shipment?.status ?? "da_preparare");
  const [shippedDate, setShippedDate] = useState(shipment?.shippedDate?.slice(0, 10) ?? "");
  const [expectedDelivery, setExpectedDelivery] = useState(shipment?.expectedDelivery?.slice(0, 10) ?? "");
  const [deliveredDate, setDeliveredDate] = useState(shipment?.deliveredDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(shipment?.notes ?? "");

  const save = () => {
    if (!orderId || !customerName.trim() || !address.trim()) return;
    onSave({
      orderId, customerName: customerName.trim(), address: address.trim(),
      carrier: carrier.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      trackingUrl: trackingUrl.trim() || undefined,
      shippingCost, status,
      shippedDate: shippedDate ? new Date(shippedDate).toISOString() : undefined,
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery).toISOString() : undefined,
      deliveredDate: deliveredDate ? new Date(deliveredDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova spedizione" : "Modifica spedizione"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <Field label="Ordine collegato">
        <select value={orderId} onChange={e => {
          setOrderId(e.target.value);
          const o = orders.find(x => x.id === e.target.value);
          if (o) { setCustomerName(o.customerName); setAddress(o.shippingAddress ?? ""); if (o.shippingCost) setShippingCost(o.shippingCost); }
        }} className="w-full bg-card border border-border rounded-lg p-3">
          <option value="">—</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.externalNumber} · {o.customerName}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cliente"><input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Corriere"><input value={carrier} onChange={e => setCarrier(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" placeholder="BRT, GLS, SDA…" /></Field>
      </div>
      <Field label="Indirizzo">
        <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tracking number"><input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Tracking URL"><input value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://…" className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Costo (€)">
          <input type="number" step="0.01" value={shippingCost ?? ""} onChange={e => setShippingCost(e.target.value === "" ? undefined : Number(e.target.value))} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Stato">
          <select value={status} onChange={e => setStatus(e.target.value as ShipmentStatus)} className="w-full bg-card border border-border rounded-lg p-3">
            {SHIP_STATUSES.map(s => <option key={s} value={s}>{SHIPMENT_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Data spedizione"><input type="date" value={shippedDate} onChange={e => setShippedDate(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Consegna prevista"><input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
        <Field label="Data consegna"><input type="date" value={deliveredDate} onChange={e => setDeliveredDate(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" /></Field>
      </div>
      <Field label="Note"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" /></Field>
    </Sheet>
  );
}

// ============= IMPORT TAB =============

function ImportTab({ onDone }: { onDone: () => void }) {
  const { addOnlineOrders } = useStore();
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<EcomPlatform>("shopify");
  const [preview, setPreview] = useState<Omit<OnlineOrder, "id" | "createdAt">[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parse = () => {
    setError(null);
    try {
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("CSV vuoto o senza intestazione.");
      const header = rows[0].map(h => h.trim().toLowerCase());
      const find = (...keys: string[]) => {
        for (const k of keys) {
          const i = header.indexOf(k);
          if (i >= 0) return i;
        }
        return -1;
      };
      const cols = {
        number: find("numero ordine", "order number", "name", "n. ordine", "numero"),
        date: find("data", "date", "created at", "data ordine"),
        customer: find("cliente", "customer", "billing name", "nome cliente"),
        email: find("email", "billing email", "customer email"),
        phone: find("telefono", "phone", "billing phone"),
        products: find("prodotti", "lineitems", "line items", "items"),
        total: find("totale", "total", "order total"),
        payment: find("stato pagamento", "financial status", "payment status"),
        status: find("stato ordine", "fulfillment status", "status"),
        address: find("indirizzo", "shipping address", "indirizzo spedizione"),
      };
      if (cols.number < 0 || cols.customer < 0 || cols.total < 0) {
        throw new Error("Colonne minime mancanti: numero ordine, cliente, totale.");
      }
      const out: Omit<OnlineOrder, "id" | "createdAt">[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[cols.number]?.trim()) continue;
        const dateStr = cols.date >= 0 ? r[cols.date] : "";
        const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
        const totalStr = (r[cols.total] ?? "0").replace(",", ".").replace(/[^\d.-]/g, "");
        const total = Number(totalStr) || 0;
        const payRaw = (cols.payment >= 0 ? r[cols.payment] : "pagato").toLowerCase();
        const paymentStatus: EcomPaymentStatus =
          /paid|pagato/.test(payRaw) ? "pagato" :
          /refund|rimbors/.test(payRaw) ? "rimborsato" : "da_pagare";
        const stRaw = (cols.status >= 0 ? r[cols.status] : "ricevuto").toLowerCase();
        const status: EcomOrderStatus =
          /fulfill|spedito|shipped/.test(stRaw) ? "spedito" :
          /deliver|consegnat/.test(stRaw) ? "consegnato" :
          /cancel|annull/.test(stRaw) ? "annullato" :
          /preparaz|process/.test(stRaw) ? "in_preparazione" : "ricevuto";
        out.push({
          date, platform,
          externalNumber: r[cols.number].trim(),
          customerName: r[cols.customer]?.trim() || "Cliente",
          email: cols.email >= 0 ? r[cols.email]?.trim() || undefined : undefined,
          phone: cols.phone >= 0 ? r[cols.phone]?.trim() || undefined : undefined,
          shippingAddress: cols.address >= 0 ? r[cols.address]?.trim() || undefined : undefined,
          items: [],
          total, status, paymentStatus,
          notes: cols.products >= 0 ? r[cols.products]?.trim() || undefined : undefined,
        });
      }
      setPreview(out);
    } catch (e) {
      setError((e as Error).message);
      setPreview([]);
    }
  };

  const onFile = async (file: File) => {
    const t = await file.text();
    setText(t);
  };

  const confirm = () => {
    if (preview.length === 0) return;
    addOnlineOrders(preview);
    setPreview([]);
    setText("");
    onDone();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <section className="bg-card rounded-xl p-4 space-y-3">
        <p className="text-xs uppercase font-bold text-brand-green">Importa CSV ordini</p>
        <p className="text-[11px] text-muted-foreground">
          Colonne riconosciute (qualsiasi ordine): numero ordine, data, cliente, email, telefono, prodotti, totale,
          stato pagamento, stato ordine, indirizzo. Compatibile con export Shopify/WooCommerce base.
        </p>
        <div className="flex gap-3 items-center">
          <select value={platform} onChange={e => setPlatform(e.target.value as EcomPlatform)} className="bg-background border border-border rounded-lg p-2 text-sm">
            {PLATFORMS.map(p => <option key={p} value={p}>{ECOM_PLATFORM_LABEL[p]}</option>)}
          </select>
          <input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-xs" />
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Incolla CSV qui…"
          className="w-full bg-background border border-border rounded-lg p-3 text-xs font-mono" />
        <div className="flex gap-2">
          <button onClick={parse} className="bg-brand-green text-brand-cream rounded-lg px-4 py-2 text-sm font-semibold">Anteprima</button>
          {preview.length > 0 && (
            <button onClick={confirm} className="bg-brand-gold text-white rounded-lg px-4 py-2 text-sm font-semibold">Importa {preview.length} ordini</button>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </section>

      {preview.length > 0 && (
        <section className="bg-card rounded-xl p-4">
          <p className="text-xs uppercase font-bold text-brand-green mb-2">Anteprima ({preview.length})</p>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {preview.slice(0, 50).map((p, i) => (
              <div key={i} className="text-xs flex justify-between border-b border-border/50 py-1">
                <span>{p.externalNumber} — {p.customerName}</span>
                <span className="font-semibold">{formatEuro(p.total)} · {p.status} / {p.paymentStatus}</span>
              </div>
            ))}
            {preview.length > 50 && <p className="text-[11px] text-muted-foreground italic mt-2">…e altri {preview.length - 50}</p>}
          </div>
        </section>
      )}
    </div>
  );
}

// Lightweight CSV parser (handles quoted fields, commas, newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < t.length) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === "," || c === ";") { cur.push(field); field = ""; i++; continue; }
    if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(x => x.trim().length > 0));
}
