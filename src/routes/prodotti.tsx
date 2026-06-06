import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, Sheet, Field, Fab, formatDate } from "@/components/AppShell";
import { calcMargin, type Product, type ProductCategory } from "@/lib/data";
import { productSalesStats, marginColor } from "@/lib/metrics";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";

export const Route = createFileRoute("/prodotti")({
  component: ProdottiPage,
});

const CATEGORIES: ProductCategory[] = [
  "Freschi di Bufala", "Freschi di Pecora", "Formaggi Stagionati", "Burro e Latticini",
  "Salumi", "Dispensa", "Pane", "Latte", "Bevande", "Vini", "Taralli", "Pasta",
];

const BADGE_COLORS: Record<string, string> = {
  DOP: "bg-brand-gold text-white",
  IGP: "bg-warning text-white",
  DOC: "bg-brand-green text-brand-cream",
  DOCG: "bg-brand-green-dark text-brand-cream",
  BIO: "bg-success text-white",
};

function isOutOfStock(p: Product): boolean {
  return p.stock !== undefined && p.stock <= 0;
}

function ProdottiPage() {
  const navigate = useNavigate();
  const { products, orders, casualSales, updateProduct, deleteProduct } = useStore();
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);

  const ordersInFrame = useMemo(() => orders.filter(o => inFrame(o.pickupDate, tf)), [orders, tf]);
  const salesInFrame = useMemo(() => casualSales.filter(s => inFrame(s.date, tf)), [casualSales, tf]);

  const stats = useMemo(
    () => productSalesStats(ordersInFrame, salesInFrame, products),
    [ordersInFrame, salesInFrame, products],
  );
  const statsById = useMemo(() => new Map(stats.map(s => [s.product.id, s])), [stats]);

  const negativi = products.filter(p => { const m = calcMargin(p); return m !== null && m < 0; });

  const grouped = useMemo(() => {
    const list = products.filter(p => {
      if (filter !== "all" && p.category !== filter) return false;
      if (!showInactive && !p.active) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const map = new Map<ProductCategory, Product[]>();
    for (const cat of CATEGORIES) {
      const items = list.filter(p => p.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [products, filter, showInactive, q]);

  const topVendite = [...stats].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topProfitti = [...stats].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const lentiZero = products.filter(p => p.active && !statsById.has(p.id)).slice(0, 8);

  return (
    <div>
      <TopBar title="Prodotti" subtitle={`${products.length} totali · ${products.filter(p => p.active).length} attivi`} />

      <div className="px-4 md:px-6 pt-4 flex justify-end">
        <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
          {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {negativi.length > 0 && (
        <div className="mx-4 md:mx-6 mt-3 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
          <strong>Alert:</strong> {negativi.length} prodotto/i sotto costo: {negativi.map(p => p.name).join(", ")}
        </div>
      )}

      <div className="px-4 md:px-6 pt-3 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto..."
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === "all" ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            Tutte
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === c ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
              {c}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 text-xs whitespace-nowrap">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Inattivi
          </label>
        </div>
      </div>

      {filter === "all" && !q && (
        <div className="px-4 md:px-6 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <RankCard title={`Più venduti · ${tf.label}`} items={topVendite.map(s => ({ name: s.product.name, value: `${s.qty.toFixed(s.product.unit === "kg" ? 1 : 0)} ${s.product.unit}` }))} />
          <RankCard title={`Più profittevoli · ${tf.label}`} items={topProfitti.map(s => ({ name: s.product.name, value: formatEuro(s.profit) }))} />
          <RankCard title={`Mai venduti · ${tf.label}`} items={lentiZero.map(p => ({ name: p.name, value: "—" }))} />
        </div>
      )}

      <div className="p-4 md:p-6 space-y-5">
        {[...grouped.entries()].map(([cat, items]) => (
          <section key={cat}>
            <h2 className="font-display text-lg text-brand-green mb-2">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map(p => {
                const margin = calcMargin(p);
                const stat = statsById.get(p.id);
                const outOfStock = isOutOfStock(p);
                return (
                  <div key={p.id} className={`bg-card rounded-xl p-3 shadow-sm ${!p.active ? "opacity-60" : ""}`}>
                    <button onClick={() => setEditId(p.id)} className="w-full text-left">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm leading-tight text-brand-green flex-1">{p.name}</p>
                        {p.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${BADGE_COLORS[p.badge] ?? "bg-brand-gold text-white"}`}>{p.badge}</span>}
                        {outOfStock && <span className="text-[9px] bg-danger/15 text-danger px-1.5 py-0.5 rounded font-bold">ESAURITO</span>}
                      </div>
                      <div className="mt-1.5 flex gap-3 text-xs flex-wrap">
                        <span className="text-muted-foreground">Costo: {p.cost == null ? "n.d." : formatEuro(p.cost) + "/" + p.unit}</span>
                        <span className="text-foreground font-semibold">Prezzo: {formatEuro(p.price)}/{p.unit}</span>
                        <span className={`font-bold ${marginColor(margin)}`}>
                          Margine: {margin === null ? "n/d" : `${margin.toFixed(1)}%`}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Venduto {tf.label.toLowerCase()}: {stat ? `${stat.qty.toFixed(p.unit === "kg" ? 1 : 0)} ${p.unit} · ${formatEuro(stat.revenue)}` : "—"}
                      </p>
                    </button>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => updateProduct(p.id, { active: !p.active })}
                        className={`flex-1 text-[10px] rounded-lg py-1 font-semibold ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {p.active ? "Attivo" : "Non attivo"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Fab onClick={() => navigate({ to: "/entrate-merci" })} />

      {editId && (() => {
        const p = products.find(x => x.id === editId);
        if (!p) return null;
        return (
          <ProductSheet product={p} onClose={() => setEditId(null)}
            onSave={(patch) => { updateProduct(p.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm(`Eliminare ${p.name}?`)) { deleteProduct(p.id); setEditId(null); } }} />
        );
      })()}
    </div>
  );
}

function RankCard({ title, items }: { title: string; items: { name: string; value: string }[] }) {
  return (
    <div className="bg-card rounded-xl p-4">
      <h3 className="font-display text-base text-brand-green mb-2">{title}</h3>
      {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
      <ul className="text-xs space-y-1">
        {items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-2">
            <span className="truncate flex-1">{idx + 1}. {i.name}</span>
            <span className="font-semibold text-brand-green">{i.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductSheet({ product, onClose, onSave, onDelete }: {
  product: Product;
  onClose: () => void; onSave: (p: any) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<ProductCategory>(product.category);
  const [badge, setBadge] = useState<string>(product.badge ?? "");
  const [cost, setCost] = useState<string>(product.cost?.toString() ?? "");
  const [price, setPrice] = useState<string>(product.price?.toString() ?? "");
  const [unit, setUnit] = useState<"kg" | "pz">(product.unit);
  const [active, setActive] = useState<boolean>(product.active);
  const [notes, setNotes] = useState(product.notes ?? "");
  const [supplierId, setSupplierId] = useState<string>(product.supplierId ?? "");
  const { suppliers } = useStore();

  const c = cost === "" ? null : parseFloat(cost);
  const pr = parseFloat(price) || 0;
  const margin = c !== null && pr > 0 ? ((pr - c) / pr) * 100 : null;
  const marginEur = c !== null && pr > 0 ? pr - c : null;

  const save = () => {
    if (!name.trim() || pr <= 0) return;
    onSave({
      name: name.trim(), category, cost: c, price: pr, unit, active,
      badge: badge ? (badge as any) : undefined,
      notes: notes.trim() || undefined,
      supplierId: supplierId || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={product.name}
      footer={
        <div className="flex gap-3 items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Margine: </span>
            <span className={`font-bold ${marginColor(margin)}`}>
              {margin === null ? "n/d" : `${margin.toFixed(1)}% · ${formatEuro(marginEur ?? 0)}`}
            </span>
          </div>
          {onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!name.trim() || pr <= 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="w-full bg-card border border-border rounded-lg p-3">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Certificazione">
          <select value={badge} onChange={(e) => setBadge(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">— Nessuna —</option>
            <option value="DOP">DOP</option>
            <option value="IGP">IGP</option>
            <option value="DOC">DOC</option>
            <option value="DOCG">DOCG</option>
            <option value="BIO">BIO</option>
          </select>
        </Field>
        <Field label="Unità">
          <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className="w-full bg-card border border-border rounded-lg p-3">
            <option value="kg">kg</option>
            <option value="pz">pz</option>
          </select>
        </Field>
        <Field label="Costo (€)">
          <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Prezzo finale (€)">
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setActive(!active)}
          className={`rounded-lg p-3 text-xs font-semibold border ${active ? "bg-brand-green text-brand-cream border-brand-green" : "bg-card text-muted-foreground border-border"}`}>
          {active ? "Attivo" : "Non attivo"}
        </button>
      </div>

      <Field label="Fornitore">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          <option value="">— Nessuno —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      {(product.priceHistory ?? []).length > 0 && (
        <Field label="Storico variazioni prezzo">
          <ul className="bg-card rounded-lg p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
            {(product.priceHistory ?? []).slice().reverse().map((h, idx) => (
              <li key={idx} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                <span className="text-muted-foreground">{formatDate(h.date)}</span>
                <span>costo {h.cost == null ? "n.d." : formatEuro(h.cost)} · prezzo {formatEuro(h.price)}</span>
              </li>
            ))}
          </ul>
        </Field>
      )}
    </Sheet>
  );
}
