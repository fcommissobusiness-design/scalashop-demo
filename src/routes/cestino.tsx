import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatDate } from "@/components/AppShell";
import type { TrashKind } from "@/lib/data";

export const Route = createFileRoute("/cestino")({ component: CestinoPage });

const KIND_LABEL: Record<TrashKind, string> = {
  order: "Ordine",
  casualSale: "Scontrino",
  delivery: "Consegna",
  bundle: "Bundle",
  supplier: "Fornitore",
  supplierPayment: "Pagamento",
  fixedCost: "Costo fisso",
  client: "Cliente",
  b2bClient: "Cliente B2B",
  product: "Prodotto",
};

const KIND_COLORS: Record<TrashKind, string> = {
  order: "bg-brand-green/15 text-brand-green",
  casualSale: "bg-brand-gold/15 text-brand-gold",
  delivery: "bg-blue-500/15 text-blue-700",
  bundle: "bg-purple-500/15 text-purple-700",
  supplier: "bg-teal-500/15 text-teal-700",
  supplierPayment: "bg-rose-500/15 text-rose-700",
  fixedCost: "bg-orange-500/15 text-orange-700",
  client: "bg-cyan-500/15 text-cyan-700",
  b2bClient: "bg-indigo-500/15 text-indigo-700",
  product: "bg-pink-500/15 text-pink-700",
};

function CestinoPage() {
  const { trash, restoreTrash, purgeTrash, emptyTrash } = useStore();
  const [filter, setFilter] = useState<TrashKind | "all">("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    return (trash ?? [])
      .filter(t => filter === "all" || t.kind === filter)
      .filter(t => !q.trim() || t.label.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }, [trash, filter, q]);

  const kinds = Array.from(new Set((trash ?? []).map(t => t.kind))) as TrashKind[];

  return (
    <div>
      <TopBar
        title="Cestino"
        subtitle={`${trash?.length ?? 0} elementi eliminati`}
        right={
          (trash?.length ?? 0) > 0 ? (
            <button
              onClick={() => { if (confirm("Svuotare il cestino? L'operazione è irreversibile.")) emptyTrash(); }}
              className="bg-danger text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Svuota cestino
            </button>
          ) : null
        }
      />

      <div className="px-4 md:px-6 py-3 flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cerca..."
          className="flex-1 min-w-[180px] bg-card border border-border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Tutti i tipi</option>
          {kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {list.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Il cestino è vuoto.
          </p>
        )}
        {list.map(t => (
          <div key={t.id} className="bg-card rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded font-semibold ${KIND_COLORS[t.kind]}`}>
              {KIND_LABEL[t.kind]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">
                Eliminato il {formatDate(t.deletedAt)} · {new Date(t.deletedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              onClick={() => restoreTrash(t.id)}
              className="text-xs bg-success text-white rounded-lg px-3 py-1.5 font-semibold"
            >
              Ripristina
            </button>
            <button
              onClick={() => { if (confirm("Eliminare definitivamente?")) purgeTrash(t.id); }}
              className="text-xs border border-danger text-danger rounded-lg px-3 py-1.5 font-semibold"
            >
              Elimina
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
