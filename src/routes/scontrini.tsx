import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Fab, formatEuro, formatTime, formatDate } from "@/components/AppShell";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";
import { itemDisplayName } from "@/lib/metrics";
import { NewSaleSheet } from "@/routes/index";

export const Route = createFileRoute("/scontrini")({ component: ScontriniPage });

function ScontriniPage() {
  const { casualSales, clients, products, bundles, addClient, addCasualSale } = useStore();
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);

  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const inFrameSales = useMemo(
    () => casualSales.filter((s) => inFrame(s.date, tf)).sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [casualSales, tf]
  );

  const completati = inFrameSales.length;
  const fattGenerato = inFrameSales.reduce((s, x) => s + x.total, 0);
  const ticketMedio = completati === 0 ? 0 : fattGenerato / completati;

  const clientById = (id?: string) => (id ? clients.find((c) => c.id === id) : undefined);

  return (
    <div>
      <TopBar title="Scontrini" subtitle={`${tf.label} · ${inFrameSales.length} scontrini`} />

      <div className="px-4 md:px-6 pt-3 flex justify-end">
        <select
          value={tfId}
          onChange={(e) => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg p-2 text-sm font-semibold text-brand-green"
        >
          {TIME_FRAME_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPI con bordo */}
      <div className="p-4 md:p-6 grid grid-cols-3 gap-3">
        <Kpi label="Completati" value={completati.toString()} />
        <Kpi label="Fatturato generato" value={formatEuro(fattGenerato)} highlight />
        <Kpi label="Scontrino medio" value={formatEuro(ticketMedio)} />
      </div>

      <div className="p-4 md:p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
        {inFrameSales.length === 0 && (
          <div className="md:col-span-2 bg-card rounded-xl p-6 text-center text-sm text-muted-foreground border border-brand-green/20">
            Nessuno scontrino nel periodo.
          </div>
        )}
        {inFrameSales.map((s) => {
          const c = clientById(s.clientId);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setEditId(s.id)}
              className="bg-card rounded-xl p-3 text-sm text-left active:opacity-80 border border-brand-green/20 hover:border-brand-gold/40 transition"
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-brand-green truncate">
                  {c?.name ?? s.clientNameInput ?? "Anonimo"}
                </span>
                <span className="text-brand-green font-bold">{formatEuro(s.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTime(s.date)} · {formatDate(s.date)} · {s.paymentMethod ?? "—"}
              </p>
              <p className="text-xs text-foreground/70 mt-1 line-clamp-2">
                {s.items.map((i) => itemDisplayName(i, products, bundles)).join(", ")}
              </p>
              {s.notes && (
                <p className="text-xs italic text-muted-foreground mt-1 line-clamp-1">Note: {s.notes}</p>
              )}
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {(openNew || editId) && (
        <NewSaleSheet
          key={editId ?? "new"}
          open={true}
          saleId={editId ?? undefined}
          onClose={() => { setOpenNew(false); setEditId(null); }}
          onSave={(s, newClient) => {
            if (newClient) addClient(newClient);
            addCasualSale(s);
            setOpenNew(false);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "bg-brand-green text-brand-cream border-brand-green" : "bg-card border-brand-green/25"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl md:text-2xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}