import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate, formatTime, Sheet, Field, Fab } from "@/components/AppShell";
import type { Order, OrderItem, OrderStatus, OrderSource, DeliveryMode, DeliveryPayment, PaymentMethod, PaymentAttachment } from "@/lib/data";
import { InvoiceField } from "@/components/InvoiceField";
import { orderMargin, itemDisplayName, itemDisplayUnit, cartTotal } from "@/lib/metrics";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";
import { CartEditor } from "@/components/CartEditor";
import { buildOrderComanda, printComanda } from "@/lib/comanda";

interface Search { f?: string }

export const Route = createFileRoute("/ordini")({
  component: OrdiniPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ f: typeof s.f === "string" ? s.f : undefined }),
});

const STATUS_STYLE: Record<OrderStatus, string> = {
  in_attesa: "bg-warning/15 text-warning border-warning/30",
  pronto: "bg-blue-600/15 text-blue-700 border-blue-600/30",
  da_consegnare: "bg-purple-600/15 text-purple-700 border-purple-600/30",
  ritirato: "bg-success/15 text-success border-success/30",
  consegnato: "bg-success/15 text-success border-success/30",
  annullato: "bg-danger/15 text-danger border-danger/30",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  in_attesa: "In Attesa", pronto: "Pronto",
  da_consegnare: "Da Consegnare", consegnato: "Consegnato",
  ritirato: "Ritirato", annullato: "Annullato",
};

const STATUS_ORDER: OrderStatus[] = ["in_attesa", "pronto", "da_consegnare", "consegnato", "ritirato", "annullato"];

const SOURCE_LABEL: Record<OrderSource, string> = {
  negozio: "Negozio", whatsapp: "WhatsApp", telefono: "Telefono",
  sito: "Sito", altro: "Altro",
  consegna: "Negozio", b2b: "Negozio",
};
const SOURCE_OPTIONS: OrderSource[] = ["negozio", "whatsapp", "telefono", "sito", "altro"];

const DELIVERY_LABEL: Record<DeliveryMode, string> = {
  ritiro: "Ritiro in negozio",
  domicilio: "Consegna a domicilio",
};

function toDateInput(d: Date) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(+d - tz).toISOString().slice(0, 10);
}

function OrdiniPage() {
  const search = useSearch({ from: "/ordini" }) as Search;
  const { orders, clients, products, bundles, addOrder } = useStore();
  const [statusSel, setStatusSel] = useState<Set<OrderStatus>>(new Set());
  const [deliverySel, setDeliverySel] = useState<Set<DeliveryMode>>(new Set());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [waOpen, setWaOpen] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Timeframe
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const today = new Date();
  const [customStart, setCustomStart] = useState(toDateInput(today));
  const [customEnd, setCustomEnd] = useState(toDateInput(today));
  const tf = useMemo(() => {
    if (tfId === "custom") return makeTimeFrame("custom", new Date(customStart), new Date(customEnd));
    return makeTimeFrame(tfId);
  }, [tfId, customStart, customEnd]);

  useEffect(() => {
    if (search.f === "nuovo") setOpenNew(true);
    if (search.f === "oggi") setTfId("today");
    else if (search.f === "domani") setTfId("tomorrow");
    else if (search.f === "attesa") setStatusSel(new Set(["in_attesa"]));
    else if (search.f === "pronti") setStatusSel(new Set(["pronto"]));
    else if (search.f === "ritirati") setStatusSel(new Set(["ritirato"]));
  }, [search.f]);

  const toggleStatus = (s: OrderStatus) => setStatusSel(prev => {
    const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n;
  });
  const toggleDelivery = (d: DeliveryMode) => setDeliverySel(prev => {
    const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n;
  });

  const inPeriod = useMemo(() => orders.filter(o => inFrame(o.pickupDate, tf)), [orders, tf]);

  const filtered = useMemo(() => inPeriod.filter((o) => {
    const c = clients.find((c) => c.id === o.clientId);
    if (q && !(c?.name.toLowerCase().includes(q.toLowerCase()) || c?.phone.includes(q))) return false;
    if (statusSel.size > 0 && !statusSel.has(o.status)) return false;
    if (deliverySel.size > 0 && !deliverySel.has(o.delivery ?? "ritiro")) return false;
    return true;
  }).sort((a, b) => +new Date(b.pickupDate) - +new Date(a.pickupDate)), [inPeriod, q, clients, statusSel, deliverySel]);

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      <TopBar title="Ordini" subtitle={`${filtered.length} totali · ${tf.label}`} />

      <div className="px-4 md:px-6 pt-3 sticky top-0 md:static bg-brand-cream z-30 space-y-2">
        {/* Top row: search + timeframe */}
        <div className="flex flex-col md:flex-row gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente o telefono..."
            className="flex-1 bg-card border border-border rounded-lg p-2.5 text-sm" />
          <div className="flex gap-1.5 items-center md:justify-end">
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
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold shrink-0">Status</span>
          {STATUS_ORDER.map((s) => {
            const active = statusSel.has(s);
            return (
              <button key={s} onClick={() => toggleStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${active ? `${STATUS_STYLE[s]} ring-1 ring-current` : "bg-card text-foreground/60 border-border"}`}>
                {STATUS_LABEL[s]}
              </button>
            );
          })}
          {statusSel.size > 0 && (
            <button onClick={() => setStatusSel(new Set())} className="px-2 py-1.5 text-[11px] text-muted-foreground underline whitespace-nowrap">azzera</button>
          )}
        </div>

        {/* Delivery filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold shrink-0">Delivery</span>
          {(Object.keys(DELIVERY_LABEL) as DeliveryMode[]).map((d) => {
            const active = deliverySel.has(d);
            return (
              <button key={d} onClick={() => toggleDelivery(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${active ? (d === "ritiro" ? "bg-brand-green/15 text-brand-green border-brand-green/40 ring-1 ring-brand-green/40" : "bg-blue-600/15 text-blue-700 border-blue-600/40 ring-1 ring-blue-600/40") : "bg-card text-foreground/60 border-border"}`}>
                {DELIVERY_LABEL[d]}
              </button>
            );
          })}
          {deliverySel.size > 0 && (
            <button onClick={() => setDeliverySel(new Set())} className="px-2 py-1.5 text-[11px] text-muted-foreground underline whitespace-nowrap">azzera</button>
          )}
        </div>
      </div>

      {/* KPI di periodo */}
      <div className="px-4 md:px-6 pt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        {(() => {
          const completedStatuses: OrderStatus[] = ["consegnato", "ritirato"];
          const completati = inPeriod.filter(o => completedStatuses.includes(o.status));
          const aperti = inPeriod.filter(o => !completedStatuses.includes(o.status) && o.status !== "annullato");
          const fattGen = completati.reduce((s, o) => s + (o.total || 0), 0);
          const valoreTot = inPeriod.filter(o => o.status !== "annullato").reduce((s, o) => s + (o.total || 0), 0);
          return (
            <>
              <KpiMini label="Aperti" value={aperti.length.toString()} />
              <KpiMini label="Completati" value={completati.length.toString()} />
              <KpiMini label="Fatturato" value={formatEuro(fattGen)} highlight />
              <KpiMini label="Valore totale" value={formatEuro(valoreTot)} />
            </>
          );
        })()}
      </div>


      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-12 md:col-span-2">Nessun ordine in questo periodo.</p>}
        {filtered.map((o) => {
          const c = clientById(o.clientId);
          const m = orderMargin(o, products, bundles);
          const overdue = o.status === "in_attesa" && +new Date(o.pickupDate) < Date.now() - 86400000;
          return (
            <div key={o.id} className={`bg-card rounded-xl p-4 shadow-sm ${overdue ? "ring-2 ring-danger/40" : ""}`}>
              <div className="flex justify-between items-start mb-2 gap-2">
                <button onClick={() => setEditId(o.id)} className="text-left min-w-0 flex-1">
                  <p className="font-display text-lg text-brand-green leading-tight truncate">{c?.name ?? o.clientNameInput ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c?.phone ?? "—"} · {SOURCE_LABEL[o.source ?? "negozio"]}</p>
                  {o.label && <p className="text-xs text-brand-gold font-semibold mt-0.5 truncate">{o.label}</p>}
                </button>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap border ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${o.delivery === "domicilio" ? "bg-blue-600/15 text-blue-700" : "bg-brand-green/10 text-brand-green"}`}>
                    {o.delivery === "domicilio" ? "Domicilio" : "Ritiro"}
                  </span>
                </div>
              </div>
              <button onClick={() => setEditId(o.id)} className="w-full text-left">
                <p className="text-xs text-muted-foreground mb-2">
                  {formatDate(o.pickupDate)} · {formatTime(o.pickupDate)} · <span className="font-semibold text-brand-green">{formatEuro(o.total)}</span> · margine <span className="font-semibold">{formatEuro(m)}</span>
                </p>
                <ul className="text-sm space-y-0.5">
                  {o.items.slice(0, 3).map((i, idx) => {
                    const name = itemDisplayName(i, products, bundles);
                    const unit = itemDisplayUnit(i, products);
                    return <li key={idx} className="text-foreground/80">· {name} <span className="text-muted-foreground">x{i.qty}{unit === "kg" ? "kg" : ""}</span></li>;
                  })}
                  {o.items.length > 3 && <li className="text-xs text-muted-foreground">+ altri {o.items.length - 3}</li>}
                </ul>
                {o.notes && <p className="text-xs italic text-muted-foreground mt-2 line-clamp-2">Note: {o.notes}</p>}
              </button>
              <div className="flex flex-wrap gap-1.5 mt-3 items-center">
                <button onClick={() => setEditId(o.id)}
                  className="flex-1 min-w-[80px] text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 px-3 font-semibold">Modifica</button>
                {c?.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()}
                    className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 font-semibold">Chiama</a>
                )}
                {c?.phone && (
                  <button onClick={() => setWaOpen(o.id)}
                    className="text-xs bg-[#1FA855] text-white rounded-lg px-3 py-1.5 font-semibold">WhatsApp</button>
                )}

                <button onClick={() => setConfirmDel(o.id)} aria-label="Elimina"
                  className="text-danger border border-danger/40 hover:bg-danger/10 rounded-lg px-2 py-1.5 text-sm">🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <OrderSheet mode="new" onClose={() => setOpenNew(false)}
          onSave={(payload) => { addOrder(payload); setOpenNew(false); }} />
      )}

      {editId && (
        <OrderSheet mode="edit" orderId={editId} onClose={() => setEditId(null)} />
      )}

      {waOpen && (() => {
        const o = orders.find(x => x.id === waOpen);
        if (!o) return null;
        const c = clientById(o.clientId);
        return (
          <WhatsAppDialog
            open={true} onClose={() => setWaOpen(null)}
            phone={c?.phone ?? ""}
            context={{ client: c, order: o, productNames: o.items.map(i => itemDisplayName(i, products, bundles)) }}
            defaultTemplate={o.status === "pronto" ? "ordine_pronto" : "promemoria_ritiro"}
            templates={["conferma_ordine", "promemoria_ritiro", "ordine_pronto", "libero"]}
          />
        );
      })()}

      {confirmDel && (
        <DeleteOrderDialog orderId={confirmDel} onClose={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

function KpiMini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-lg leading-tight mt-0.5 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function DeleteOrderDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {

  const { deleteOrder } = useStore();
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-cream rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl text-brand-green mb-2">Elimina ordine</h3>
        <p className="text-sm text-foreground/80 mb-4">Sei sicuro di voler eliminare quest'ordine? L'operazione non è reversibile.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-card border border-border text-sm font-semibold">Annulla</button>
          <button onClick={() => { deleteOrder(orderId); onClose(); }} className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold">Elimina</button>
        </div>
      </div>
    </div>
  );
}

export function OrderSheet({ mode, orderId, onClose, onSave }: {
  mode: "new" | "edit";
  orderId?: string;
  onClose: () => void;
  onSave?: (o: Omit<Order, "id" | "createdAt">) => void;
}) {
  const { clients, products, bundles, orders, addClient, updateOrder, updateClient, deleteOrder, duplicateOrder } = useStore();
  const existing = orderId ? orders.find((o) => o.id === orderId) : null;

  // Per il bug "cancellazione nome": clientQ === null => mostra nome del cliente selezionato;
  // appena l'utente digita (anche stringa vuota) controlla il valore dell'input.
  const [clientQ, setClientQ] = useState<string | null>(() => {
    if (!existing) return null;
    return clients.some((c) => c.id === existing.clientId) ? null : (existing.clientNameInput ?? "");
  });
  const [clientId, setClientId] = useState(existing?.clientId ?? clients[0]?.id ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [items, setItems] = useState<OrderItem[]>(existing?.items ?? []);
  const [date, setDate] = useState(() => {
    const d = existing ? new Date(existing.pickupDate) : new Date();
    if (!existing) { d.setMinutes(0); d.setHours(d.getHours() + 1); }
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(+d - tz).toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<OrderStatus>(existing?.status ?? "in_attesa");
  const initialSource: OrderSource = (() => {
    const s = existing?.source ?? "negozio";
    return (SOURCE_OPTIONS as OrderSource[]).includes(s) ? s : "negozio";
  })();
  const [source, setSource] = useState<OrderSource>(initialSource);
  const [delivery, setDelivery] = useState<DeliveryMode>(existing?.delivery ?? "ritiro");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [payment, setPayment] = useState<DeliveryPayment>(existing?.payment ?? "da_pagare");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? "contanti");
  const [hasInvoice, setHasInvoice] = useState<boolean>(existing?.hasInvoice ?? false);
  const [invoice, setInvoice] = useState<PaymentAttachment | undefined>(existing?.invoice);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.id === clientId);

  // Phone management
  const [phone, setPhone] = useState(selectedClient?.phone ?? "");
  useEffect(() => {
    setPhone(selectedClient?.phone ?? "");
    if (!existing && selectedClient?.deliveryZone && !address) setAddress(selectedClient.deliveryZone);
  }, [clientId, selectedClient?.phone]);
  const allPhones = useMemo(() => {
    if (!selectedClient) return [] as string[];
    const list = [selectedClient.phone, ...(selectedClient.phones ?? [])].filter(Boolean);
    return Array.from(new Set(list));
  }, [selectedClient]);
  const allAddresses = useMemo(() => {
    if (!selectedClient) return [] as string[];
    const list = [selectedClient.deliveryZone, ...(selectedClient.addresses ?? [])].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [selectedClient]);


  // Close menu on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  const total = cartTotal(items, products, bundles);
  const margin = orderMargin({ items } as Order, products, bundles);

  const clientQText = clientQ ?? "";
  const clientSuggestions = clientQText.length >= 1
    ? clients.filter(c => c.name.toLowerCase().includes(clientQText.toLowerCase()) || c.phone.includes(clientQText)).slice(0, 6)
    : [];
  const typedNotMatchedClient = clientQText.trim().length >= 2 && !clients.some(c => c.name.toLowerCase() === clientQText.trim().toLowerCase());

  const persistPhoneIfChanged = () => {
    if (!selectedClient) return;
    const trimmed = phone.trim();
    if (!trimmed || trimmed === selectedClient.phone) return;
    const others = (selectedClient.phones ?? []).filter(p => p && p !== trimmed && p !== selectedClient.phone);
    const newPhones = [selectedClient.phone, ...others].filter(Boolean);
    updateClient(selectedClient.id, { phone: trimmed, phones: newPhones });
  };
  const persistAddressIfChanged = () => {
    if (!selectedClient || delivery !== "domicilio") return;
    const trimmed = address.trim();
    if (!trimmed) return;
    const existing = [selectedClient.deliveryZone, ...(selectedClient.addresses ?? [])].filter(Boolean) as string[];
    if (existing.includes(trimmed)) return;
    const newAddresses = Array.from(new Set([...(selectedClient.addresses ?? []), trimmed]));
    const patch: Partial<typeof selectedClient> = { addresses: newAddresses };
    if (!selectedClient.deliveryZone) patch.deliveryZone = trimmed;
    updateClient(selectedClient.id, patch);
  };

  const handleSave = () => {
    if (items.length === 0) return;
    // Autocreate nuovo cliente se l'utente ha digitato un nome non corrispondente
    let effectiveClientId = clientId;
    const typed = (clientQ ?? "").trim();
    if (typed && (!selectedClient || selectedClient.name.toLowerCase() !== typed.toLowerCase())) {
      const exact = clients.find(c => c.name.toLowerCase() === typed.toLowerCase());
      if (exact) effectiveClientId = exact.id;
      else {
        const created = addClient({
          name: typed,
          phone: phone.trim(),
          segment: "nuovi",
          stamps: 0,
          addresses: delivery === "domicilio" && address.trim() ? [address.trim()] : undefined,
          deliveryZone: delivery === "domicilio" && address.trim() ? address.trim() : undefined,
        } as Omit<import("@/lib/data").Client, "id">);
        effectiveClientId = created.id;
      }
    }
    if (!effectiveClientId && typed) {
      const created = addClient({
        name: typed,
        phone: phone.trim(),
        segment: "nuovi",
        stamps: 0,
        addresses: delivery === "domicilio" && address.trim() ? [address.trim()] : undefined,
        deliveryZone: delivery === "domicilio" && address.trim() ? address.trim() : undefined,
      } as Omit<import("@/lib/data").Client, "id">);
      effectiveClientId = created.id;
    }
    if (!effectiveClientId) return;
    if (effectiveClientId === clientId) { persistPhoneIfChanged(); persistAddressIfChanged(); }
    const payload: Omit<Order, "id" | "createdAt"> = {
      clientId: effectiveClientId,
      clientNameInput: (typed || selectedClient?.name || "").trim() || undefined,
      label: label.trim() || undefined, items,
      pickupDate: new Date(date).toISOString(),
      status, total, notes: notes.trim() || undefined, source, delivery,
      address: delivery === "domicilio" ? address.trim() || undefined : undefined,
      payment: delivery === "domicilio" ? payment : undefined,
      paymentMethod,
      hasInvoice, invoice: hasInvoice ? invoice : undefined,
    };
    if (mode === "new") onSave?.(payload);
    else if (existing) { updateOrder(existing.id, payload); onClose(); }
  };


  const handlePrintComanda = () => {
    if (!existing) return;
    const c = clients.find(x => x.id === existing.clientId);
    printComanda(buildOrderComanda(existing, c, products, bundles));
    setMenuOpen(false);
  };


  const handleDelete = () => {
    if (!existing) return;
    if (confirm(`Eliminare definitivamente l'ordine?`)) {
      deleteOrder(existing.id);
      onClose();
    }
  };

  const handleDuplicate = () => {
    if (!existing) return;
    duplicateOrder(existing.id);
    setMenuOpen(false);
    onClose();
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Ordine" : `Ordine · ${selectedClient?.name ?? existing?.clientNameInput ?? "—"}`}
      footer={
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <p className="text-[10px] uppercase text-muted-foreground">Totale · margine</p>
            <p className="font-display text-2xl text-brand-green leading-none">{formatEuro(total)} <span className="text-sm text-muted-foreground">· {formatEuro(margin)}</span></p>
          </div>
          {mode === "edit" && (
            <button onClick={handlePrintComanda}
              className="bg-card border border-border rounded-xl px-3 py-3 text-sm font-semibold">🖨️ Stampa Comanda</button>
          )}
          {mode === "edit" && (
            <button onClick={handleDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={handleSave} disabled={items.length === 0 || (!clientId && !((clientQ ?? "").trim()))}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma
          </button>
        </div>
      }

    >
      {mode === "edit" && (
        <div className="flex justify-end -mt-2 -mr-1" ref={menuRef}>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-lg leading-none" aria-label="Altre azioni">⋮</button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[180px]">
                <button onClick={handleDuplicate}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-cream">Duplica ordine</button>
                <button onClick={handlePrintComanda}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-cream border-t border-border">🖨️ Stampa Comanda</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Cliente">
          <input placeholder="Cerca o seleziona..."
            value={clientQ !== null ? clientQ : (selectedClient?.name ?? existing?.clientNameInput ?? "")}
            onChange={(e) => { setClientQ(e.target.value); }}
            className="w-full bg-card border border-border rounded-lg p-3" />
          {clientSuggestions.length > 0 && clientQ !== null && (
            <div className="bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto">
              {clientSuggestions.map(c => (
                <button key={c.id} onClick={() => { setClientId(c.id); setClientQ(null); }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-cream text-sm border-b border-border last:border-0">
                  {c.name} <span className="text-xs text-muted-foreground">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {typedNotMatchedClient && (
            <p className="text-[11px] text-brand-gold mt-1">Nuovo cliente: verrà creata una scheda al salvataggio.</p>
          )}
        </Field>
        <Field label="Telefono">
          <div className="flex gap-1">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 ..."
              className="flex-1 bg-card border border-border rounded-lg p-3" />
            {allPhones.length > 1 && (
              <select value={phone} onChange={(e) => setPhone(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 text-sm" aria-label="Scegli numero">
                {allPhones.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
          {selectedClient && phone.trim() && phone.trim() !== selectedClient.phone && (
            <p className="text-[10px] text-brand-gold mt-1">Salvando, questo numero diventerà il principale del cliente.</p>
          )}
        </Field>
        <Field label="Nome ordine (opz.)">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. Festa compleanno"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data e ora ritiro/consegna">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Origine">
          <select value={source} onChange={(e) => setSource(e.target.value as OrderSource)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Delivery">
          <select value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryMode)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(DELIVERY_LABEL) as DeliveryMode[]).map(d => <option key={d} value={d}>{DELIVERY_LABEL[d]}</option>)}
          </select>
        </Field>
        {delivery === "domicilio" && (
          <>
            <Field label="Indirizzo consegna">
              <div className="flex gap-1">
                <input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="Via, civico, città"
                  className="flex-1 bg-card border border-border rounded-lg p-3" />
                {allAddresses.length > 1 && (
                  <select value={address} onChange={(e) => setAddress(e.target.value)}
                    className="bg-card border border-border rounded-lg px-2 text-sm" aria-label="Scegli indirizzo">
                    {allAddresses.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                )}
              </div>
            </Field>
            <Field label="Pagamento">
              <select value={payment} onChange={(e) => setPayment(e.target.value as DeliveryPayment)}
                className="w-full bg-card border border-border rounded-lg p-3">
                <option value="pagato_anticipo">Pagato in anticipo</option>
                <option value="da_pagare">Ancora da pagare</option>
                <option value="pagato_consegna">Pagato alla consegna</option>
              </select>
            </Field>
          </>
        )}

        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="in_attesa">In Attesa</option>
            <option value="pronto">Pronto</option>
            <option value="da_consegnare">Da Consegnare</option>
            <option value="consegnato">Consegnato</option>
            <option value="ritirato">Ritirato</option>
            <option value="annullato">Annullato</option>
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

      <Field label="Prodotti, bundle e righe personalizzate">
        <CartEditor items={items} onChange={setItems} />
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      <InvoiceField
        hasInvoice={hasInvoice}
        onHasInvoiceChange={setHasInvoice}
        invoice={invoice}
        onInvoiceChange={setInvoice}
      />

      {existing?.timeline && existing.timeline.length > 0 && (
        <Field label="Timeline">
          <ul className="text-xs space-y-1 bg-card rounded-lg p-3">
            {existing.timeline.slice(-8).map((ev, idx) => (
              <li key={idx} className="text-foreground/80">
                <span className="font-mono text-muted-foreground">{new Date(ev.date).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                {" · "}<span className="font-semibold uppercase tracking-wide">{ev.type}</span>
                {ev.note && <span className="text-muted-foreground"> — {ev.note}</span>}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </Sheet>
  );
}
