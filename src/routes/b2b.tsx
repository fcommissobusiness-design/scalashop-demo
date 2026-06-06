import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatEuro, formatDate } from "@/components/AppShell";
import type { B2BClient, B2BStatus } from "@/lib/data";
import { telUrl } from "@/lib/whatsapp";
import { CopyBtn } from "@/components/QuickActions";
import { topB2BByRevenue } from "@/lib/metrics";

export const Route = createFileRoute("/b2b")({ component: B2BPage });

const STATUS_LABEL: Record<B2BStatus, string> = { prospect: "Prospect", attivo: "Attivo", sospeso: "Sospeso" };
const STATUS_STYLE: Record<B2BStatus, string> = {
  prospect: "bg-blue-600/15 text-blue-700",
  attivo: "bg-success/15 text-success",
  sospeso: "bg-warning/15 text-warning",
};
const DAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function B2BPage() {
  const { b2bClients, addB2BClient, updateB2BClient, deleteB2BClient } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | B2BStatus>("all");

  const list = b2bClients.filter(c => tab === "all" || c.status === tab)
    .sort((a, b) => a.name.localeCompare(b.name));
  const top = topB2BByRevenue(b2bClients, 3);
  const totalRev = b2bClients.reduce((s, c) => s + c.history.reduce((x, h) => x + h.total, 0), 0);

  return (
    <div>
      <TopBar title="Clienti B2B" subtitle={`${b2bClients.length} totali · ${formatEuro(totalRev)} fatturato`} />

      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Attivi" value={String(b2bClients.filter(c => c.status === "attivo").length)} />
        <Kpi label="Prospect" value={String(b2bClients.filter(c => c.status === "prospect").length)} />
        <Kpi label="Fatturato" value={formatEuro(totalRev)} highlight />
      </div>

      {top.length > 0 && (
        <div className="mx-4 md:mx-6 mb-3 bg-brand-cream-dark/40 rounded-xl p-3">
          <p className="text-xs uppercase font-bold text-brand-green mb-2">Top fatturato</p>
          <div className="space-y-1">
            {top.map(t => (
              <div key={t.client.id} className="flex justify-between text-sm">
                <span>{t.client.name}</span>
                <span className="font-semibold text-brand-green">{formatEuro(t.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 md:px-6 flex gap-2 pb-2">
        {(["all", "attivo", "prospect", "sospeso"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "all" ? "Tutti" : STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.length === 0 && <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">Nessun cliente B2B.</p>}
        {list.map(c => {
          const rev = c.history.reduce((s, h) => s + h.total, 0);
          const last = c.history.at(-1);
          return (
            <div key={c.id} className="bg-card rounded-xl p-4 shadow-sm">
              <button onClick={() => setEditId(c.id)} className="w-full text-left">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-display text-lg text-brand-green">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.contactName}{c.zone ? ` · ${c.zone}` : ""}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-muted-foreground">Giorni: {c.deliveryDays.join(", ") || "—"}</span>
                  <span className="font-semibold text-brand-green">{formatEuro(rev)}</span>
                </div>
                {last && <p className="text-[11px] text-muted-foreground mt-1">Ultimo ordine: {formatDate(last.date)} · {formatEuro(last.total)}</p>}
              </button>
              {c.phone && (
                <div className="flex gap-1.5 mt-3">
                  <a href={telUrl(c.phone)} className="flex-1 text-center text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 font-semibold">Chiama</a>
                  <CopyBtn text={c.phone} label="Copia tel" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <B2BSheet mode="new" onClose={() => setOpenNew(false)}
        onSave={(d) => { addB2BClient(d as Omit<B2BClient, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const c = b2bClients.find(x => x.id === editId);
        if (!c) return null;
        return <B2BSheet mode="edit" client={c} onClose={() => setEditId(null)}
          onSave={(p) => { updateB2BClient(c.id, p); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteB2BClient(c.id); setEditId(null); } }} />;
      })()}
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

function B2BSheet({ mode, client, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; client?: B2BClient;
  onClose: () => void; onSave: (c: Omit<B2BClient, "id"> | Partial<B2BClient>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [contactName, setContactName] = useState(client?.contactName ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [zone, setZone] = useState(client?.zone ?? "");
  const [days, setDays] = useState<string[]>(client?.deliveryDays ?? []);
  const [status, setStatus] = useState<B2BStatus>(client?.status ?? "prospect");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [newAmount, setNewAmount] = useState(0);

  const toggleDay = (d: string) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const save = () => {
    if (!name.trim()) return;
    const history = [...(client?.history ?? [])];
    if (newAmount > 0) history.push({ date: new Date().toISOString(), total: newAmount });
    onSave({
      name: name.trim(), contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined, zone: zone.trim() || undefined,
      deliveryDays: days, status, notes: notes.trim() || undefined, history,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo cliente B2B" : client?.name ?? "Cliente B2B"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome attività">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Referente">
          <input value={contactName} onChange={e => setContactName(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Telefono">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Zona">
          <input value={zone} onChange={e => setZone(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <Field label="Giorni di consegna">
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase ${days.includes(d) ? "bg-brand-green text-brand-cream" : "bg-card border border-border"}`}>{d}</button>
          ))}
        </div>
      </Field>
      <Field label="Status">
        <select value={status} onChange={e => setStatus(e.target.value as B2BStatus)}
          className="w-full bg-card border border-border rounded-lg p-3">
          {(Object.keys(STATUS_LABEL) as B2BStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      {mode === "edit" && (
        <Field label="Aggiungi ordine ad oggi (€)">
          <input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      )}
      {client && client.history.length > 0 && (
        <Field label={`Storico (${client.history.length})`}>
          <div className="max-h-40 overflow-y-auto bg-card border border-border rounded-lg divide-y divide-border">
            {[...client.history].reverse().map((h, i) => (
              <div key={i} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-muted-foreground">{formatDate(h.date)}</span>
                <span className="font-semibold">{formatEuro(h.total)}</span>
              </div>
            ))}
          </div>
        </Field>
      )}
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}
