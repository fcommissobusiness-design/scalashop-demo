import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate } from "@/components/AppShell";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";
import { InvoiceRow } from "@/components/InvoiceField";
import type { PaymentAttachment } from "@/lib/data";

export const Route = createFileRoute("/fatture")({ component: FatturePage });

type InvoiceRowItem = {
  id: string;
  date: string;
  direction: "entrata" | "uscita";
  typeLabel: string;
  counterparty: string;
  amount: number;
  attachment: PaymentAttachment;
  ref: { kind: "order" | "sale" | "payment"; id: string };
};

function FatturePage() {
  const { orders, casualSales, supplierPayments, clients } = useStore();
  const navigate = useNavigate();
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);
  const [filter, setFilter] = useState<"all" | "entrata" | "uscita">("all");

  const items: InvoiceRowItem[] = useMemo(() => {
    const out: InvoiceRowItem[] = [];

    for (const o of orders) {
      if (!o.hasInvoice || !o.invoice) continue;
      if (!inFrame(o.pickupDate, tf)) continue;
      const client = clients.find(c => c.id === o.clientId);
      out.push({
        id: `ord_${o.id}`, date: o.pickupDate, direction: "entrata",
        typeLabel: "Ordine",
        counterparty: client?.name ?? "—",
        amount: o.total, attachment: o.invoice,
        ref: { kind: "order", id: o.id },
      });
    }
    for (const s of casualSales) {
      if (!s.hasInvoice || !s.invoice) continue;
      if (!inFrame(s.date, tf)) continue;
      const client = s.clientId ? clients.find(c => c.id === s.clientId) : null;
      out.push({
        id: `sale_${s.id}`, date: s.date, direction: "entrata",
        typeLabel: "Scontrino",
        counterparty: client?.name ?? s.clientNameInput ?? "Cliente occasionale",
        amount: s.total, attachment: s.invoice,
        ref: { kind: "sale", id: s.id },
      });
    }
    for (const p of supplierPayments) {
      const att = p.attachments?.[0];
      if (p.document !== "fattura" || !att) continue;
      if (!inFrame(p.date, tf)) continue;
      out.push({
        id: `pay_${p.id}`, date: p.date, direction: "uscita",
        typeLabel: "Uscita",
        counterparty: p.beneficiary,
        amount: p.amount, attachment: att,
        ref: { kind: "payment", id: p.id },
      });
    }
    return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [orders, casualSales, supplierPayments, clients, tf]);

  const visible = useMemo(
    () => filter === "all" ? items : items.filter(i => i.direction === filter),
    [items, filter],
  );

  const kpi = useMemo(() => {
    let inEntrate = 0, inUscite = 0;
    for (const i of items) {
      if (i.direction === "entrata") inEntrate += i.amount;
      else inUscite += i.amount;
    }
    return { inEntrate, inUscite, count: items.length };
  }, [items]);

  const openRef = (ref: InvoiceRowItem["ref"]) => {
    if (ref.kind === "order") navigate({ to: "/ordini" });
    else if (ref.kind === "sale") navigate({ to: "/incassi" });
    else navigate({ to: "/incassi" });
  };

  return (
    <div>
      <TopBar title="Fatture" subtitle="Documenti collegati a ordini, scontrini e uscite" />

      <div className="px-4 md:px-6 pt-4 flex justify-end">
        <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
          {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-3 gap-3">
        <Kpi label="Totale" value={String(kpi.count)} />
        <Kpi label="In Entrata" value={formatEuro(kpi.inEntrate)} ok />
        <Kpi label="In Uscita" value={formatEuro(kpi.inUscite)} danger />
      </div>

      <div className="px-4 md:px-6 flex gap-2 pb-2">
        {([
          { id: "all", label: "Tutte" },
          { id: "entrata", label: "In entrata" },
          { id: "uscita", label: "In uscita" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 space-y-3">
        {visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nessuna fattura nel periodo. Aggiungi una fattura da Ordine, Scontrino o Uscita.
          </p>
        )}
        {visible.map(i => (
          <div key={i.id} className="bg-card rounded-xl p-3">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className={`text-[10px] uppercase font-semibold tracking-wide ${i.direction === "entrata" ? "text-success" : "text-danger"}`}>
                  {i.direction === "entrata" ? "In entrata" : "In uscita"} · {i.typeLabel}
                </p>
                <p className="font-display text-base text-brand-green truncate">{i.counterparty}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(i.date)}</p>
              </div>
              <p className={`font-display text-lg shrink-0 ${i.direction === "entrata" ? "text-success" : "text-danger"}`}>
                {i.direction === "entrata" ? "+" : "−"} {formatEuro(i.amount)}
              </p>
            </div>
            <InvoiceRow att={i.attachment} />
            <button onClick={() => openRef(i.ref)}
              className="mt-2 text-xs text-brand-green font-semibold underline">
              Apri {i.ref.kind === "order" ? "ordine" : i.ref.kind === "sale" ? "scontrino" : "uscita"} collegato →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, ok, danger }: { label: string; value: string; ok?: boolean; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : ok ? "text-success" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}
