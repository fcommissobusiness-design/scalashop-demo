import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { OrderItem, Product, Bundle } from "@/lib/data";
import { QtyInput } from "@/components/QtyInput";
import { formatEuro } from "@/components/AppShell";
import {
  itemKind, itemDisplayName, itemUnitPrice, itemUnitCost, itemLineTotal,
} from "@/lib/metrics";

type Tab = "prodotto" | "bundle" | "custom";

interface Props {
  items: OrderItem[];
  onChange: (next: OrderItem[]) => void;
}

export function CartEditor({ items, onChange }: Props) {
  const { products, bundles } = useStore();
  const [tab, setTab] = useState<Tab>("prodotto");
  const [search, setSearch] = useState("");

  // ---------- helpers di mutazione carrello ----------
  const removeRow = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<OrderItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  // Prodotto: se già presente come "product", aggiorna qty; altrimenti aggiunge una riga
  const upsertProduct = (id: string, qty: number) => {
    const exIdx = items.findIndex(
      (it) => itemKind(it) === "product" && it.productId === id,
    );
    if (qty <= 0) {
      if (exIdx >= 0) removeRow(exIdx);
      return;
    }
    if (exIdx >= 0) updateRow(exIdx, { qty });
    else onChange([...items, { productId: id, qty, kind: "product" }]);
  };

  // Bundle: se già presente come "bundle", aggiorna qty
  const upsertBundle = (id: string, qty: number) => {
    const exIdx = items.findIndex(
      (it) => itemKind(it) === "bundle" && it.bundleId === id,
    );
    if (qty <= 0) {
      if (exIdx >= 0) removeRow(exIdx);
      return;
    }
    if (exIdx >= 0) updateRow(exIdx, { qty });
    else onChange([...items, { productId: "", qty, kind: "bundle", bundleId: id }]);
  };

  // Riga personalizzata: aggiunge sempre una nuova riga
  const addCustom = (row: {
    name: string;
    qty: number;
    price: number;
    cost?: number;
    productId?: string;
  }) => {
    const item: OrderItem = {
      productId: row.productId ?? "",
      qty: row.qty,
      kind: "custom",
      customName: row.name,
      customPrice: row.price,
      customCost: row.cost,
    };
    onChange([...items, item]);
  };

  const total = items.reduce((s, i) => s + itemLineTotal(i, products, bundles), 0);

  // ---------- liste filtrate ----------
  const productsFiltered = useMemo(
    () =>
      products
        .filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 30),
    [products, search],
  );
  const bundlesFiltered = useMemo(
    () =>
      bundles
        .filter((b) => b.active && b.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 30),
    [bundles, search],
  );

  return (
    <div>
      {/* Carrello corrente */}
      {items.length > 0 && (
        <div className="mb-3 space-y-1">
          {items.map((it, idx) => (
            <CartRow
              key={idx}
              item={it}
              products={products}
              bundles={bundles}
              onQtyChange={(q) => (q <= 0 ? removeRow(idx) : updateRow(idx, { qty: q }))}
              onRemove={() => removeRow(idx)}
            />
          ))}
          <div className="flex justify-between items-center px-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Totale carrello</span>
            <span className="font-display text-lg text-brand-green">{formatEuro(total)}</span>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-2 p-1 bg-card rounded-lg border border-border">
        {(["prodotto", "bundle", "custom"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setSearch(""); }}
            className={`flex-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors ${
              tab === t ? "bg-brand-green text-brand-cream" : "text-foreground/70 hover:bg-brand-cream/50"
            }`}
          >
            {t === "prodotto" ? "Prodotto" : t === "bundle" ? "Bundle" : "Personalizzata"}
          </button>
        ))}
      </div>

      {tab === "prodotto" && (
        <>
          <input
            placeholder="Cerca prodotto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-2.5 text-sm"
          />
          <div className="max-h-72 overflow-y-auto mt-2 space-y-1">
            {productsFiltered.map((p) => {
              const ex = items.find((it) => itemKind(it) === "product" && it.productId === p.id);
              const qty = ex?.qty ?? 0;
              const step = p.unit === "kg" ? 0.1 : 1;
              return (
                <div key={p.id} className="bg-card rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatEuro(p.price)}/{p.unit}</p>
                  </div>
                  <QtyInput value={qty} step={step} unit={p.unit} onChange={(n) => upsertProduct(p.id, n)} />
                </div>
              );
            })}
            {productsFiltered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nessun prodotto trovato.</p>
            )}
          </div>
        </>
      )}

      {tab === "bundle" && (
        <>
          <input
            placeholder="Cerca offerta o bundle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-2.5 text-sm"
          />
          <div className="max-h-72 overflow-y-auto mt-2 space-y-1">
            {bundlesFiltered.map((b) => {
              const ex = items.find((it) => itemKind(it) === "bundle" && it.bundleId === b.id);
              const qty = ex?.qty ?? 0;
              const price = b.offerPrice ?? b.fullPrice;
              return (
                <div key={b.id} className="bg-card rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">📦 {b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEuro(price)}
                      {b.offerPrice != null && b.offerPrice < b.fullPrice && (
                        <span className="line-through ml-1.5 opacity-60">{formatEuro(b.fullPrice)}</span>
                      )}
                    </p>
                  </div>
                  <QtyInput value={qty} step={1} onChange={(n) => upsertBundle(b.id, n)} />
                </div>
              );
            })}
            {bundlesFiltered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nessuna offerta o bundle disponibile.</p>
            )}
          </div>
        </>
      )}

      {tab === "custom" && <CustomRowForm products={products} onAdd={addCustom} />}
    </div>
  );
}

function CartRow({
  item, products, bundles, onQtyChange, onRemove,
}: {
  item: OrderItem;
  products: Product[];
  bundles: Bundle[];
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const name = itemDisplayName(item, products, bundles);
  const unitPrice = itemUnitPrice(item, products, bundles);
  const total = itemLineTotal(item, products, bundles);
  const kind = itemKind(item);
  const p = kind === "product" ? products.find((x) => x.id === item.productId) : undefined;
  const step = p?.unit === "kg" ? 0.1 : 1;
  const badge =
    kind === "bundle" ? "bg-brand-gold/15 text-brand-gold border-brand-gold/30"
    : kind === "custom" ? "bg-purple-500/15 text-purple-700 border-purple-500/30"
    : "bg-brand-green/10 text-brand-green border-brand-green/30";
  const badgeLabel = kind === "bundle" ? "BUNDLE" : kind === "custom" ? "PERS." : "PROD.";
  return (
    <div className="bg-brand-cream/60 border border-border rounded-lg p-2 flex items-center gap-2">
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge}`}>{badgeLabel}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatEuro(unitPrice)}{p?.unit ? `/${p.unit}` : ""} · subtot. {formatEuro(total)}
        </p>
      </div>
      <QtyInput value={item.qty} step={step} unit={p?.unit} onChange={onQtyChange} />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Rimuovi riga"
        className="text-danger border border-danger/40 hover:bg-danger/10 rounded-md w-7 h-7 text-sm leading-none"
      >×</button>
    </div>
  );
}

function CustomRowForm({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (row: { name: string; qty: number; price: number; cost?: number; productId?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);
  const [cost, setCost] = useState<string>("");
  const [productQ, setProductQ] = useState("");
  const [productId, setProductId] = useState<string>("");

  const productSugg = productQ.length >= 1
    ? products.filter((p) => p.active && p.name.toLowerCase().includes(productQ.toLowerCase())).slice(0, 5)
    : [];
  const linked = products.find((p) => p.id === productId);

  const linkedCost = linked?.cost ?? null;
  const computedCost = cost.trim() !== ""
    ? Number(cost.replace(",", "."))
    : (linkedCost ?? undefined);

  const canAdd = name.trim().length > 0 && qty > 0 && price > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      name: name.trim(),
      qty,
      price,
      cost: computedCost != null && !isNaN(computedCost) ? computedCost : undefined,
      productId: productId || undefined,
    });
    setName(""); setQty(1); setPrice(0); setCost(""); setProductQ(""); setProductId("");
  };

  return (
    <div className="space-y-2 bg-card border border-border rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">
        Vendita custom (es. "Mozz. metà bocconcini metà trancio"). Non crea né modifica il catalogo prodotti.
      </p>
      <div>
        <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Mozz. mista 500g"
          className="w-full bg-brand-cream border border-border rounded-lg p-2 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Quantità</label>
          <input type="number" step="0.01" min="0" value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full bg-brand-cream border border-border rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Prezzo (€/u)</label>
          <input type="number" step="0.01" min="0" value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full bg-brand-cream border border-border rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">
            Costo (€/u) {linkedCost != null && cost.trim() === "" && <span className="text-brand-gold">auto</span>}
          </label>
          <input type="number" step="0.01" min="0" value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder={linkedCost != null ? linkedCost.toFixed(2) : "opz."}
            className="w-full bg-brand-cream border border-border rounded-lg p-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase text-muted-foreground tracking-wide">
          Collega a prodotto esistente (facoltativo)
        </label>
        <input value={linked ? linked.name : productQ}
          onChange={(e) => { setProductQ(e.target.value); setProductId(""); }}
          placeholder="Cerca per nome..."
          className="w-full bg-brand-cream border border-border rounded-lg p-2 text-sm" />
        {productSugg.length > 0 && !linked && (
          <div className="bg-brand-cream border border-border rounded-lg mt-1 max-h-32 overflow-y-auto">
            {productSugg.map((p) => (
              <button key={p.id} type="button"
                onClick={() => { setProductId(p.id); setProductQ(""); }}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-card border-b border-border last:border-0">
                {p.name} <span className="text-muted-foreground">· {formatEuro(p.price)}/{p.unit}</span>
              </button>
            ))}
          </div>
        )}
        {linked && (
          <p className="text-[11px] text-brand-gold mt-1">
            Collegato a {linked.name}. Margine calcolato sul costo registrato ({linked.cost != null ? formatEuro(linked.cost) : "n/d"}/u).
            <button type="button" onClick={() => { setProductId(""); }} className="ml-1 underline">Scollega</button>
          </p>
        )}
      </div>
      <button type="button" onClick={submit} disabled={!canAdd}
        className="w-full bg-brand-green text-brand-cream rounded-lg py-2 text-sm font-semibold disabled:opacity-40">
        Aggiungi al carrello
      </button>
    </div>
  );
}
