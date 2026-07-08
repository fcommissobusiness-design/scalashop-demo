import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import type { OrderItem, Product, Bundle } from "@/lib/data";
import { QtyInput } from "@/components/QtyInput";
import { formatEuro } from "@/components/AppShell";
import {
  itemKind, itemDisplayName, itemLineTotal,
} from "@/lib/metrics";
import { DemoLockOverlay } from "@/components/DemoLock";

type Tab = "prodotto" | "bundle" | "custom";

interface Props {
  items: OrderItem[];
  onChange: (next: OrderItem[]) => void;
}

export function CartEditor({ items, onChange }: Props) {
  const { products, bundles, orders, casualSales, deliveries } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("prodotto");
  const [search, setSearch] = useState("");

  // ---------- helpers di mutazione carrello ----------
  const removeRow = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<OrderItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  // Prodotto: se già presente come "product", aggiorna qty; altrimenti aggiunge una riga.
  // Importante (richiesta utente): se l'utente porta la quantità a 0 NON rimuoviamo la riga,
  // la rimozione avviene SOLO dal pulsante X. Aggiungiamo soltanto quando qty > 0.
  const upsertProduct = (id: string, qty: number) => {
    const exIdx = items.findIndex(
      (it) => itemKind(it) === "product" && it.productId === id,
    );
    if (exIdx >= 0) {
      updateRow(exIdx, { qty: Math.max(0, qty) });
      return;
    }
    if (qty <= 0) return;
    onChange([...items, { productId: id, qty, kind: "product" }]);
  };

  const upsertBundle = (id: string, qty: number) => {
    const exIdx = items.findIndex(
      (it) => itemKind(it) === "bundle" && it.bundleId === id,
    );
    if (exIdx >= 0) {
      updateRow(exIdx, { qty: Math.max(0, qty) });
      return;
    }
    if (qty <= 0) return;
    onChange([...items, { productId: "", qty, kind: "bundle", bundleId: id }]);
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

  // Calcolo "più usati / più recenti" per la lista iniziale (senza ricerca).
  const productUsage = useMemo(() => {
    const m = new Map<string, number>();
    const bump = (id?: string, w = 1) => { if (!id) return; m.set(id, (m.get(id) ?? 0) + w); };
    for (const o of orders) for (const it of o.items) bump(it.productId);
    for (const s of casualSales) for (const it of s.items) bump(it.productId);
    for (const d of deliveries) {
      const linked = d.orderId ? orders.find((o) => o.id === d.orderId) : null;
      if (linked) for (const it of linked.items) bump(it.productId, 0.5);
    }
    return m;
  }, [orders, casualSales, deliveries]);

  const productsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = products.filter((p) => p.active);
    if (q) {
      return active.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
    }
    // Niente ricerca: max 5, ordinati per utilizzo (poi inserimento più recente).
    const sorted = [...active].sort((a, b) => (productUsage.get(b.id) ?? 0) - (productUsage.get(a.id) ?? 0));
    return sorted.slice(0, 5);
  }, [products, search, productUsage]);
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
              onQtyChange={(q) => updateRow(idx, { qty: q })}
              onLineTotalChange={(t) => {
                const q = Math.max(0.0001, it.qty || 1);
                const newUnit = +(t / q).toFixed(2);
                const k = itemKind(it);
                if (k === "custom") updateRow(idx, { customPrice: newUnit });
                else updateRow(idx, { unitPriceOverride: newUnit });
              }}
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
            {/* "Aggiungi nuovo prodotto" SEMPRE visibile, in cima */}
            <button type="button"
              onClick={() => navigate({ to: "/prodotti", search: { new: 1, name: search } as any })}
              className="w-full bg-brand-gold/10 border-2 border-dashed border-brand-gold/40 text-brand-green rounded-lg py-2 text-sm font-semibold hover:bg-brand-gold/15 transition">
              + Aggiungi nuovo prodotto{search.trim() ? ` "${search.trim()}"` : ""}
            </button>
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
            {productsFiltered.length === 0 && search.trim() && (
              <p className="text-xs text-muted-foreground text-center py-2">Nessun prodotto trovato per "{search}".</p>
            )}
            {!search.trim() && productsFiltered.length > 0 && products.filter(p=>p.active).length > productsFiltered.length && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">Mostrati {productsFiltered.length} prodotti più usati. Digita per cercarne altri.</p>
            )}
          </div>
        </>
      )}

      {tab === "bundle" && (
        <div className="relative">
          <input
            placeholder="Cerca offerta o bundle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-2.5 text-sm"
          />
          <div className="max-h-72 overflow-y-auto mt-2 space-y-1 min-h-[180px]">
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
          <DemoLockOverlay feature="Bundle" compact />
        </div>
      )}

      {tab === "custom" && <CustomRowForm products={products} onAdd={addCustom} />}
    </div>
  );
}

function CartRow({
  item, products, bundles, onQtyChange, onLineTotalChange, onRemove,
}: {
  item: OrderItem;
  products: Product[];
  bundles: Bundle[];
  onQtyChange: (qty: number) => void;
  onLineTotalChange: (total: number) => void;
  onRemove: () => void;
}) {
  const name = itemDisplayName(item, products, bundles);
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
        <div className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
          <span>Totale prodotto €</span>
          <PriceInput value={total} onChange={onLineTotalChange} />
        </div>
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

function PriceInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const fmt = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");
  const [text, setText] = useState<string>(value > 0 ? fmt(value) : "");
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, "");
        setText(v);
        if (v === "") return; // keep row, don't propagate 0
        const n = parseFloat(v.replace(",", "."));
        if (!isNaN(n) && n >= 0) onChange(+n.toFixed(2));
      }}
      onBlur={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, "");
        const n = parseFloat(v.replace(",", "."));
        if (v === "" || isNaN(n) || n < 0) {
          setText(fmt(value));
        } else {
          onChange(+n.toFixed(2));
          setText(fmt(+n.toFixed(2)));
        }
      }}
      onFocus={(e) => e.target.select()}
      aria-label="Prezzo unitario"
      className="w-14 text-foreground bg-card border border-border rounded px-1 py-0.5 text-[11px]"
    />
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
  // Campi liberi (l'utente deve poter cancellare lo zero e digitare manualmente).
  const [qtyText, setQtyText] = useState<string>("1");
  const [priceText, setPriceText] = useState<string>("");
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

  const qty = Number((qtyText || "").replace(",", "."));
  const price = Number((priceText || "").replace(",", "."));
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
    setName(""); setQtyText("1"); setPriceText(""); setCost(""); setProductQ(""); setProductId("");
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
          <input type="text" inputMode="decimal" value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^\d.,]/g, ""))}
            onFocus={(e) => e.target.select()}
            placeholder="es. 1"
            className="w-full bg-brand-cream border border-border rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Prezzo (€/u)</label>
          <input type="text" inputMode="decimal" value={priceText}
            onChange={(e) => setPriceText(e.target.value.replace(/[^\d.,]/g, ""))}
            onFocus={(e) => e.target.select()}
            placeholder="es. 5,00"
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
