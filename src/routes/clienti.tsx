import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatDate, Sheet, Field, Fab, formatEuro } from "@/components/AppShell";
import { SEGMENT_META, type Client, type Segment } from "@/lib/data";
import {
  clientLTV, clientOrderCount, clientAvgTicket, clientFrequencyPerMonth,
  daysInactive, suggestSegment, clientTopProducts, clientBadges,
  clientPreferredTimeSlotAuto,
} from "@/lib/metrics";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { CallBtn } from "@/components/QuickActions";

interface Search { f?: string }

export const Route = createFileRoute("/clienti")({
  component: ClientiPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ f: typeof s.f === "string" ? s.f : undefined }),
});

const SEGMENTS: (Segment | "all")[] = ["all", "top", "abituali", "occasionali", "nuovi", "inattivi"];

function ClientiPage() {
  const search = useSearch({ from: "/clienti" }) as Search;
  const { clients, orders, products, casualSales, addClient, updateClient, deleteClient } = useStore();
  const [tab, setTab] = useState<Segment | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    if (search.f === "inattivi") setTab("inattivi");
    if (search.f === "nuovi") setTab("nuovi");
  }, [search.f]);

  const counts = useMemo(() => {
    const m: Record<Segment, number> = { top: 0, abituali: 0, occasionali: 0, nuovi: 0, inattivi: 0 };
    for (const c of clients) m[c.segment]++;
    return m;
  }, [clients]);

  const filtered = useMemo(() => clients.filter((c) => {
    if (tab !== "all" && c.segment !== tab) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!(c.name.toLowerCase().includes(t) || c.phone.includes(q))) return false;
    }
    return true;
  }), [clients, tab, q]);

  return (
    <div>
      <TopBar title="Clienti" subtitle={`${clients.length} schede totali`} />

      {/* Segmenti header — solo lettura */}
      <div className="px-4 md:px-6 pt-3 grid grid-cols-5 gap-2">
        {(Object.keys(SEGMENT_META) as Segment[]).map((s) => (
          <div key={s} className="bg-card rounded-lg p-2 text-center">
            <p className="font-display text-lg text-brand-green leading-none">{counts[s]}</p>
            <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{SEGMENT_META[s].label}</p>
          </div>
        ))}
      </div>

      <div className="px-4 md:px-6 pt-3 space-y-2">
        <input placeholder="Cerca per nome o telefono..." value={q} onChange={(e) => setQ(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SEGMENTS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === s ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
              {s === "all" ? "Tutti" : SEGMENT_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && <p className="md:col-span-3 text-center text-sm text-muted-foreground py-8">Nessun cliente.</p>}
        {filtered.map((c) => {
          const meta = SEGMENT_META[c.segment];
          const ltv = clientLTV(orders, casualSales, c.id);
          const inactive = daysInactive(orders, casualSales, c);
          const avg = clientAvgTicket(orders, casualSales, c.id);
          const badges = clientBadges(orders, casualSales, c);
          return (
            <div key={c.id} className="bg-card rounded-xl p-4 shadow-sm hover:shadow-md">
              <button onClick={() => setOpenId(c.id)} className="w-full text-left">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-brand-green leading-tight truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone || "—"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${meta.color}`}>{meta.label}</span>
                </div>
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {badges.map((b) => (
                      <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        b === "caldo" ? "bg-success/15 text-success" :
                        b === "inattivo" ? "bg-neutral-700/15 text-neutral-700" :
                        b === "alto spendente" ? "bg-brand-gold/20 text-brand-gold" :
                        b === "vicino premio" ? "bg-warning/15 text-warning" :
                        "bg-brand-green/15 text-brand-green"
                      }`}>{b}</span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">LTV</p>
                    <p className="text-sm font-bold text-brand-green">{formatEuro(ltv)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Ultimo ordine</p>
                    <p className="text-sm font-bold leading-tight">{c.lastOrder ? formatDate(c.lastOrder) : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{inactive === null ? "" : `${inactive}gg fa`}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Scontr. medio</p>
                    <p className="text-sm font-bold text-brand-green">{formatEuro(avg)}</p>
                  </div>
                </div>
              </button>
              <div className="flex gap-1.5 mt-3">
                <button onClick={() => setOpenId(c.id)}
                  className="flex-1 text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 px-3 font-semibold">Modifica</button>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} aria-label="Chiama"
                    className="text-xs bg-blue-600 text-white rounded-lg px-2.5 py-1.5 font-semibold">Chiama</a>
                ) : null}
                {c.phone ? (
                  <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} aria-label="WhatsApp"
                    className="text-xs bg-[#1FA855] text-white rounded-lg px-2.5 py-1.5 font-semibold">WhatsApp</a>
                ) : null}
                <button onClick={() => setConfirmDel(c.id)} aria-label="Elimina"
                  className="text-danger border border-danger/40 hover:bg-danger/10 rounded-lg px-2 py-1.5 text-sm">🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <ClientSheet onClose={() => setOpenNew(false)} onSave={(c) => { addClient(c as Omit<Client, "id">); setOpenNew(false); }} />
      )}

      {openId && (() => {
        const c = clients.find(c => c.id === openId);
        if (!c) return null;
        return (
          <ClientDetail
            client={c}
            onClose={() => setOpenId(null)}
            onSave={(patch) => { updateClient(c.id, patch); setOpenId(null); }}
            onDelete={() => setConfirmDel(c.id)}
          />
        );
      })()}

      {confirmDel && (() => {
        const c = clients.find(x => x.id === confirmDel);
        if (!c) return null;
        return (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => setConfirmDel(null)}>
            <div className="bg-brand-cream rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display text-xl text-brand-green mb-2">Elimina cliente</h3>
              <p className="text-sm text-foreground/80 mb-4">Sei sicuro di voler eliminare <strong>{c.name}</strong>?</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg bg-card border border-border text-sm font-semibold">Annulla</button>
                <button onClick={() => { deleteClient(c.id); setConfirmDel(null); setOpenId(null); }}
                  className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold">Conferma</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ClientDetail({ client, onClose, onSave, onDelete }: {
  client: Client;
  onClose: () => void;
  onSave: (patch: Partial<Client>) => void;
  onDelete: () => void;
}) {
  const { orders, casualSales, products, updateClient, addLoyaltyEvent, setLoyaltyStamps, logClientEvent } = useStore();
  const [openWa, setOpenWa] = useState(false);

  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [address, setAddress] = useState(client.deliveryZone ?? "");
  const [stamps, setStamps] = useState(client.stamps ?? 0);
  const [firstOrder, setFirstOrder] = useState(client.firstOrder ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(client.notes ?? "");

  const ltv = clientLTV(orders, casualSales, client.id);
  const ord = clientOrderCount(orders, casualSales, client.id);
  const avg = clientAvgTicket(orders, casualSales, client.id);
  const freq = clientFrequencyPerMonth(orders, casualSales, client);
  const inactive = daysInactive(orders, casualSales, client);
  const auto = suggestSegment(orders, casualSales, client);
  const top3 = clientTopProducts(orders, casualSales, products, client.id, 3);
  const autoSlot = clientPreferredTimeSlotAuto(orders, casualSales, client.id);

  const allPhones = useMemo(
    () => Array.from(new Set([client.phone, ...(client.phones ?? [])].filter(Boolean))),
    [client]
  );
  const allAddresses = useMemo(
    () => Array.from(new Set([client.deliveryZone, ...(client.addresses ?? [])].filter(Boolean) as string[])),
    [client]
  );

  const orderHist = orders.filter(o => o.clientId === client.id).sort((a, b) => +new Date(b.pickupDate) - +new Date(a.pickupDate));
  const saleHist = casualSales.filter(s => s.clientId === client.id).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const persistContactsIfChanged = () => {
    const patch: Partial<Client> = {};
    const tp = phone.trim();
    if (tp && tp !== client.phone) {
      const others = (client.phones ?? []).filter(p => p && p !== tp && p !== client.phone);
      patch.phone = tp;
      patch.phones = [client.phone, ...others].filter(Boolean);
    }
    const ta = address.trim();
    const ex = [client.deliveryZone, ...(client.addresses ?? [])].filter(Boolean) as string[];
    if (ta && !ex.includes(ta)) {
      patch.addresses = Array.from(new Set([...(client.addresses ?? []), ta]));
      if (!client.deliveryZone) patch.deliveryZone = ta;
    } else if (ta && ta !== (client.deliveryZone ?? "")) {
      patch.deliveryZone = ta;
    }
    if (Object.keys(patch).length) updateClient(client.id, patch);
  };

  const save = () => {
    if (!name.trim()) return;
    persistContactsIfChanged();
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      stamps: Math.max(0, Math.min(5, stamps)),
      firstOrder,
      notes: notes.trim() || undefined,
      // segment is recalculated automatically by the store / recomputeSegments
      segmentManual: false,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={client.name}
      footer={
        <div className="flex flex-wrap gap-2">
          <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          {client.phone && <CallBtn phone={client.phone} className="bg-brand-green text-brand-cream rounded-xl px-3 py-3 text-sm font-semibold" />}
          {client.phone && (
            <button onClick={() => { setOpenWa(true); logClientEvent(client.id, "whatsapp", "Aperto WhatsApp"); }} className="bg-[#1FA855] text-white rounded-xl px-4 py-3 text-sm font-semibold">WhatsApp</button>
          )}
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Salva
          </button>
        </div>
      }
    >
      {/* HEADER METRICHE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="LTV" value={formatEuro(ltv)} />
        <Stat label="Ordini" value={ord.toString()} />
        <Stat label="Scontr. medio" value={formatEuro(avg)} />
        <Stat label="Freq./mese" value={freq.toFixed(1)} />
        <Stat label="Inattivit." value={inactive === null ? "—" : inactive + "gg"} />
        <Stat label="Ultimo ordine" value={client.lastOrder ? formatDate(client.lastOrder) : "—"} />
        <Stat label="Segmento auto" value={SEGMENT_META[auto].label} />
        <Stat label="Fascia preferita" value={autoSlot ?? "—"} />
      </div>

      {/* FEDELTÀ */}
      <div className="bg-brand-cream rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-display text-base text-brand-green">Cartolina fedeltà</p>
          <span className="text-xs font-semibold text-brand-gold">{stamps}/5</span>
        </div>
        <div className="flex gap-2 mb-3">
          {[0,1,2,3,4].map(i => (
            <button key={i} onClick={() => setStamps(i + 1 === stamps ? i : i + 1)}
              className={`flex-1 h-12 rounded-lg flex items-center justify-center text-lg font-display border-2 transition-colors ${
                i < stamps ? "bg-brand-gold text-white border-brand-gold" : "bg-card border-border text-muted-foreground"
              }`}>{i + 1}</button>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={() => { setLoyaltyStamps(client.id, Math.min(5, stamps + 1)); setStamps(Math.min(5, stamps + 1)); }}
            className="flex-1 bg-brand-green text-brand-cream rounded-lg py-2 font-semibold">+ Timbro</button>
          <button onClick={() => { addLoyaltyEvent(client.id, { type: "reward", note: "Premio riscattato" }); setStamps(0); }}
            className="flex-1 bg-brand-gold text-white rounded-lg py-2 font-semibold">Riscatta premio</button>
          <button onClick={() => { addLoyaltyEvent(client.id, { type: "reset", note: "Reset manuale" }); setStamps(0); }}
            className="px-3 bg-card border border-border rounded-lg py-2 font-semibold">Azzera</button>
        </div>
        {stamps === 4 && <p className="text-xs text-warning mt-2 font-semibold">Quasi completato — proporre prossimo acquisto</p>}
        {stamps >= 5 && <p className="text-xs text-brand-gold mt-2 font-semibold">Premio pronto: 1kg mozzarella in omaggio</p>}
      </div>

      {/* DATI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Telefono">
          <div className="flex gap-1">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 ..."
              className="flex-1 bg-card border border-border rounded-lg p-3" />
            {allPhones.length > 1 && (
              <select value={phone} onChange={(e) => setPhone(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 text-sm" aria-label="Scegli numero">
                {allPhones.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        </Field>
        <Field label="Indirizzo">
          <div className="flex gap-1">
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via, civico, città"
              className="flex-1 bg-card border border-border rounded-lg p-3" />
            {allAddresses.length > 1 && (
              <select value={address} onChange={(e) => setAddress(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 text-sm" aria-label="Scegli indirizzo">
                {allAddresses.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>
        </Field>
        <Field label="Data primo ordine">
          <input type="date" value={firstOrder} onChange={(e) => setFirstOrder(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      <Field label="Prodotti preferiti (Top 3)">
        {top3.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nessun ordine registrato.</p>
        ) : (
          <ul className="bg-card rounded-lg p-3 text-sm space-y-1">
            {top3.map(t => (
              <li key={t.product!.id} className="flex justify-between">
                <span>{t.product!.name}</span>
                <span className="text-muted-foreground">x{t.qty.toFixed(t.product!.unit === "kg" ? 1 : 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {/* TIMELINE UNIFICATA */}
      <div className="space-y-3">
        <h3 className="font-display text-lg text-brand-green">Storico</h3>
        {orderHist.length === 0 && saleHist.length === 0 && (client.loyaltyHistory ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna attività registrata.</p>
        )}
        {orderHist.map(o => (
          <div key={o.id} className="bg-card rounded-lg p-3 text-sm border border-border">
            <div className="flex justify-between">
              <span><span className="text-[10px] uppercase text-brand-gold font-bold">Ordine</span> · {formatDate(o.pickupDate)}</span>
              <span className="font-semibold">{formatEuro(o.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {o.status} · {o.items.map(i => products.find(p => p.id === i.productId)?.name ?? i.productId).join(", ")}
            </p>
          </div>
        ))}
        {saleHist.map(s => (
          <div key={s.id} className="bg-card rounded-lg p-3 text-sm border border-border">
            <div className="flex justify-between">
              <span><span className="text-[10px] uppercase text-brand-green font-bold">Scontrino</span> · {formatDate(s.date)}</span>
              <span className="font-semibold">{formatEuro(s.total)}</span>
            </div>
          </div>
        ))}
        {(client.loyaltyHistory ?? []).slice().reverse().slice(0, 10).map((ev, idx) => (
          <div key={idx} className="bg-card rounded-lg p-2 text-xs border border-border">
            <span className="text-[10px] uppercase text-brand-gold font-bold">Fedeltà</span> · {formatDate(ev.date)} · {ev.type} {ev.note && `— ${ev.note}`}
          </div>
        ))}
      </div>

      {openWa && (
        <WhatsAppDialog
          open={true} onClose={() => setOpenWa(false)}
          phone={client.phone}
          context={{ client }}
          defaultTemplate={(client.stamps ?? 0) >= 5 ? "premio_disponibile" : (inactive ?? 0) > 60 ? "cliente_inattivo" : "libero"}
        />
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg p-2 text-center">
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-brand-green leading-tight">{value}</p>
    </div>
  );
}

function ClientSheet({ onClose, onSave }: {
  onClose: () => void; onSave: (c: Omit<Client, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), phone: phone.trim(), segment: "nuovi", stamps: 0,
      firstOrder: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title="Nuovo cliente"
      footer={
        <button onClick={save} disabled={!name.trim()}
          className="w-full bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
          Crea cliente
        </button>
      }
    >
      <Field label="Nome e cognome">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" autoFocus />
      </Field>
      <Field label="Telefono">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 ..." className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
    </Sheet>
  );
}
