import { useState } from "react";
import type { OrderItem, Product, Bundle } from "@/lib/data";
import { formatEuro } from "@/components/AppShell";
import { itemKind, itemUnitPrice, itemUnitCost, itemDisplayName } from "@/lib/metrics";

/**
 * Calcola il margine sul carrello e segnala righe con dato mancante
 * (costo non disponibile oppure prezzo a zero).
 */
export function cartMarginInfo(items: OrderItem[], products: Product[], bundles: Bundle[]) {
  let margin = 0;
  const missing: { name: string; reason: "costo" | "prezzo" }[] = [];
  for (const it of items) {
    const price = itemUnitPrice(it, products, bundles);
    const cost = itemUnitCost(it, products, bundles);
    const name = itemDisplayName(it, products, bundles);
    if (price <= 0) { missing.push({ name, reason: "prezzo" }); continue; }
    if (cost == null) { missing.push({ name, reason: "costo" }); continue; }
    margin += (price - cost) * it.qty;
  }
  return { margin, missing };
}

export function CartTotalMargin({
  items, products, bundles, total,
}: {
  items: OrderItem[];
  products: Product[];
  bundles: Bundle[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const { margin, missing } = cartMarginInfo(items, products, bundles);
  const hasMissing = missing.length > 0;

  return (
    <div className="flex-1 min-w-[160px]">
      <p className="text-[10px] uppercase text-muted-foreground">Totale · margine</p>
      <p className="font-display text-2xl text-brand-green leading-none">
        {formatEuro(total)}
        {hasMissing ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-2 text-[11px] font-semibold text-brand-gold underline underline-offset-2 align-middle"
          >
            Margine non disponibile · vedi perché
          </button>
        ) : (
          <span className="text-sm text-muted-foreground"> · {formatEuro(margin)}</span>
        )}
      </p>

      {open && hasMissing && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[120] bg-black/50 flex items-end md:items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-5 max-w-md w-full shadow-xl"
          >
            <h3 className="font-display text-lg text-brand-green mb-2">Margine non disponibile</h3>
            <p className="text-sm text-foreground/80 mb-3">
              Per calcolare il margine servono sia il <strong>costo</strong> sia il <strong>prezzo</strong> di ogni prodotto.
              Mancano dei dati per:
            </p>
            <ul className="text-sm space-y-1 mb-3 max-h-48 overflow-y-auto">
              {missing.map((m, i) => {
                const it = items.find((x) => itemDisplayName(x, products, bundles) === m.name);
                const k = it ? itemKind(it) : "product";
                const scheda = k === "bundle" ? "scheda offerta/bundle" : k === "custom" ? "riga personalizzata" : "scheda prodotto";
                return (
                  <li key={i} className="border border-border rounded-lg p-2">
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-muted-foreground"> — manca il dato <strong>{m.reason}</strong>. Vai nell'apposita {scheda} per inserirlo e poi torna qui per vedere il margine.</span>
                  </li>
                );
              })}
            </ul>
            <div className="text-right">
              <button
                onClick={() => setOpen(false)}
                className="bg-brand-green text-brand-cream rounded-lg px-4 py-2 text-sm font-semibold"
              >Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}