import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Sheet, Field, formatEuro } from "@/components/AppShell";
import { CartEditor } from "@/components/CartEditor";
import type { Delivery, DeliveryStatus, DeliveryPayment, OrderItem, OrderStatus, Order } from "@/lib/data";
import { cartTotal } from "@/lib/metrics";
import { buildDeliveryComanda, printComanda } from "@/lib/comanda";

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  da_preparare: "Da preparare", in_consegna: "In consegna",
  consegnata: "Consegnata", annullata: "Annullata",
};

function statusToOrder(s: DeliveryStatus): OrderStatus {
  return s === "consegnata" ? "consegnato"
    : s === "annullata" ? "annullato"
    : s === "in_consegna" ? "da_consegnare"
    : "da_consegnare";
}

export function DeliveryFullSheet({ mode, deliveryId, onClose }: {
  mode: "new" | "edit";
  deliveryId?: string;
  onClose: () => void;
}) {
  const {
    clients, deliveries, orders, products, bundles,
    addClient, updateClient, addOrder, updateOrder, updateDelivery, deleteDelivery,
  } = useStore();
  const existing = deliveryId ? deliveries.find(d => d.id === deliveryId) : null;
  const linkedOrder = existing?.orderId ? orders.find(o => o.id === existing.orderId) : null;

  const [clientQ, setClientQ] = useState<string | null>(null);
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [date, setDate] = useState(() => {
    const d = existing ? new Date(existing.date) : new Date();
    if (!existing) d.setHours(10, 0, 0, 0);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(+d - tz).toISOString().slice(0, 16);
  });
  const [slot, setSlot] = useState(existing?.timeSlot ?? "10:00-12:00");
  const [status, setStatus] = useState<DeliveryStatus>(existing?.status ?? "da_preparare");
  const [payment, setPayment] = useState<DeliveryPayment>(existing?.payment ?? "da_pagare");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [items, setItems] = useState<OrderItem[]>(linkedOrder?.items ?? []);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.id === clientId);

  useEffect(() => {
    setPhone(selectedClient?.phone ?? "");
    if (mode === "new" && selectedClient?.deliveryZone && !address) setAddress(selectedClient.deliveryZone);
  }, [clientId, selectedClient?.phone]);

  const allPhones = useMemo(() => selectedClient
    ? Array.from(new Set([selectedClient.phone, ...(selectedClient.phones ?? [])].filter(Boolean))) : [],
    [selectedClient]);
  const allAddresses = useMemo(() => selectedClient
    ? Array.from(new Set([selectedClient.deliveryZone, ...(selectedClient.addresses ?? [])].filter(Boolean) as string[])) : [],
    [selectedClient]);

  const clientQText = clientQ ?? "";
  const sugg = clientQText.length >= 1
    ? clients.filter(c => c.name.toLowerCase().includes(clientQText.toLowerCase()) || c.phone.includes(clientQText)).slice(0, 8)
    : [];
  const typedNew = clientQText.trim().length >= 2 && !clients.some(c => c.name.toLowerCase() === clientQText.trim().toLowerCase());

  const total = cartTotal(items, products, bundles);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  const persistContacts = (cid: string) => {
    const c = clients.find(x => x.id === cid);
    if (!c) return;
    const patch: Partial<typeof c> = {};
    const tp = phone.trim();
    if (tp && tp !== c.phone) {
      const others = (c.phones ?? []).filter(p => p && p !== tp && p !== c.phone);
      patch.phone = tp; patch.phones = [c.phone, ...others].filter(Boolean);
    }
    const ta = address.trim();
    const exA = [c.deliveryZone, ...(c.addresses ?? [])].filter(Boolean) as string[];
    if (ta && !exA.includes(ta)) {
      patch.addresses = Array.from(new Set([...(c.addresses ?? []), ta]));
      if (!c.deliveryZone) patch.deliveryZone = ta;
    }
    if (Object.keys(patch).length) updateClient(c.id, patch);
  };

  const save = () => {
    if (!address.trim()) return;
    // Resolve cliente
    let effClientId = clientId;
    const typed = (clientQ ?? "").trim();
    if (typed && (!selectedClient || selectedClient.name.toLowerCase() !== typed.toLowerCase())) {
      const exact = clients.find(c => c.name.toLowerCase() === typed.toLowerCase());
      if (exact) effClientId = exact.id;
      else {
        const created = addClient({
          name: typed, phone: phone.trim(), segment: "nuovi", stamps: 0,
          deliveryZone: address.trim() || undefined,
          addresses: address.trim() ? [address.trim()] : undefined,
        });
        effClientId = created.id;
      }
    }
    if (!effClientId) return;
    persistContacts(effClientId);

    const isoDate = new Date(date).toISOString();
    const orderStatus = statusToOrder(status);
    const nameFallback = ((clientQ ?? "").trim() || selectedClient?.name || "").trim() || undefined;

    if (mode === "new") {
      // Crea Ordine domicilio (genera anche la Delivery collegata)
      const order = addOrder({
        clientId: effClientId,
        clientNameInput: nameFallback,
        items,
        pickupDate: isoDate, status: orderStatus, total,
        notes: notes.trim() || undefined, source: "negozio",
        delivery: "domicilio", address: address.trim(),
        payment, paymentMethod: "contanti",
      } as Omit<Order, "id" | "createdAt">);
      // Aggiorna la Delivery con timeSlot e dati specifici
      if (order.deliveryId) {
        updateDelivery(order.deliveryId, {
          timeSlot: slot, status, address: address.trim(),
          notes: notes.trim() || undefined, date: isoDate, payment,
          clientNameInput: nameFallback,
        });
      }
    } else if (existing) {
      // Aggiorna l'ordine collegato (se presente) con items, indirizzo, stato, totale, data
      if (linkedOrder) {
        updateOrder(linkedOrder.id, {
          clientId: effClientId,
          clientNameInput: nameFallback,
          items, total,
          pickupDate: isoDate, status: orderStatus,
          delivery: "domicilio", address: address.trim(),
          payment, notes: notes.trim() || undefined,
        });
      }
      updateDelivery(existing.id, {
        clientId: effClientId,
        clientNameInput: nameFallback,
        address: address.trim(), date: isoDate,
        timeSlot: slot, status, payment,
        notes: notes.trim() || undefined,
      });
    }
    onClose();
  };


  const handlePrint = () => {
    if (!existing) return;
    const c = clients.find(x => x.id === existing.clientId);
    printComanda(buildDeliveryComanda(existing, c, linkedOrder ?? null, products, bundles));
    setMenuOpen(false);
  };
  const handleDelete = () => {
    if (!existing) return;
    if (confirm("Eliminare la consegna?")) { deleteDelivery(existing.id); onClose(); }
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova consegna" : "Modifica consegna"}
      footer={
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <p className="text-[10px] uppercase text-muted-foreground">Totale</p>
            <p className="font-display text-2xl text-brand-green leading-none">{formatEuro(total)}</p>
          </div>
          {mode === "edit" && (
            <button onClick={handlePrint}
              className="bg-card border border-border rounded-xl px-3 py-3 text-sm font-semibold">🖨️ Stampa Comanda</button>
          )}
          {mode === "edit" && (
            <button onClick={handleDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!address.trim() || (!clientId && !((clientQ ?? "").trim()))}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">Conferma</button>
        </div>
      }>

      {mode === "edit" && (
        <div className="flex justify-end -mt-2 -mr-1" ref={menuRef}>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-lg leading-none" aria-label="Altre azioni">⋮</button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[180px]">
                <button onClick={handlePrint}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-cream">🖨️ Stampa Comanda</button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Cliente">
          <input placeholder="Cerca o seleziona..."
            value={clientQ !== null ? clientQ : (selectedClient?.name ?? "")}
            onChange={(e) => setClientQ(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
          {sugg.length > 0 && clientQ !== null && (
            <div className="bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto">
              {sugg.map(c => (
                <button key={c.id} onClick={() => { setClientId(c.id); setClientQ(null); if (c.deliveryZone && !address) setAddress(c.deliveryZone); }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-cream text-sm border-b border-border last:border-0">
                  {c.name} <span className="text-xs text-muted-foreground">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {typedNew && (
            <p className="text-[11px] text-brand-gold mt-1">Nuovo cliente: scheda creata al salvataggio.</p>
          )}
        </Field>
        <Field label="Telefono">
          <div className="flex gap-1">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 ..."
              className="flex-1 bg-card border border-border rounded-lg p-3" />
            {allPhones.length > 1 && (
              <select value={phone} onChange={(e) => setPhone(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 text-sm">
                {allPhones.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        </Field>
        <Field label="Indirizzo">
          <div className="flex gap-1">
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Via, civico, città"
              className="flex-1 bg-card border border-border rounded-lg p-3" />
            {allAddresses.length > 1 && (
              <select value={address} onChange={(e) => setAddress(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 text-sm">
                {allAddresses.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>
        </Field>
        <Field label="Data e ora">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Fascia oraria">
          <input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="10:00-12:00"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Stato consegna">
          <select value={status} onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(STATUS_LABEL) as DeliveryStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Pagamento">
          <select value={payment} onChange={(e) => setPayment(e.target.value as DeliveryPayment)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="pagato_anticipo">Pagato in anticipo</option>
            <option value="da_pagare">Ancora da pagare</option>
            <option value="pagato_consegna">Pagato alla consegna</option>
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
    </Sheet>
  );
}
