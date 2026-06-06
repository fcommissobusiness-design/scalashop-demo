import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, Sheet, Field, Fab } from "@/components/AppShell";
import { bundleMargin, SEGMENT_META, type Bundle, type Segment, type Product, type ProductCategory } from "@/lib/data";
import { TIME_FRAME_OPTIONS, makeTimeFrame, type TimeFrameId } from "@/lib/timeframe";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

export const Route = createFileRoute("/offerte")({ component: OffertePage });

const CATEGORIES: ProductCategory[] = [
  "Freschi di Bufala", "Freschi di Pecora", "Formaggi Stagionati", "Burro e Latticini",
  "Salumi", "Dispensa", "Pane", "Latte", "Bevande", "Vini", "Taralli", "Pasta",
];

const QTY_PRESETS = [0.1, 0.2, 0.3, 0.5, 1, 2];

function OffertePage() {
  const { bundles, updateBundle, addBundle, deleteBundle } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [waId, setWaId] = useState<string | null>(null);
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);

  // I bundle non sono ancora tracciati negli ordini → vendite=0. Mostriamo solo profittabilità reale.
  const topProfit = [...bundles].map(b => ({ b, m: bundleMargin(b) }))
    .filter(x => x.m.eur !== null).sort((a, b) => (b.m.eur ?? 0) - (a.m.eur ?? 0)).slice(0, 5);

  return (
    <div>
      <TopBar title="Offerte e Bundle" subtitle={`${bundles.length} bundle · ${bundles.filter(b => b.active).length} attivi`} />

      <div className="px-4 md:px-6 pt-4 flex justify-end">
        <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
          {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <div className="px-4 md:px-6 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <RankCard title={`Più venduti · ${tf.label}`} items={[]} empty="Dato non ancora disponibile" />
        <RankCard title={`Più profittevoli · ${tf.label}`} items={topProfit.map(({ b, m }) => ({ name: b.name, value: formatEuro(m.eur ?? 0) }))} />
        <RankCard title={`Mai venduti · ${tf.label}`} items={[]} empty="—" />
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {bundles.map((b) => {
          const m = bundleMargin(b);
          return (
            <div key={b.id} className={`bg-card rounded-xl p-4 shadow-sm ${!b.active ? "opacity-60" : ""}`}>
              <div className="flex justify-between items-start gap-3 mb-2">
                <button onClick={() => setEditId(b.id)} className="flex-1 text-left">
                  <h3 className="font-display text-lg text-brand-green leading-tight">{b.name}</h3>
                  <p className="text-[11px] text-brand-gold uppercase tracking-wide mt-0.5 font-semibold">{b.availability}</p>
                  {b.targetSegment && <span className={`text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded ${SEGMENT_META[b.targetSegment].color}`}>{SEGMENT_META[b.targetSegment].label}</span>}
                  {b.channel && <span className="text-[9px] ml-1 inline-block bg-brand-cream border border-border px-1.5 py-0.5 rounded text-foreground/70">{b.channel}</span>}
                </button>
                <button onClick={() => updateBundle(b.id, { active: !b.active })}
                  className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${b.active ? "bg-success" : "bg-muted-foreground/30"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition-transform ${b.active ? "translate-x-5" : ""}`} />
                </button>
              </div>

              <ul className="text-sm text-foreground/80 space-y-0.5 mb-3">
                {b.ingredients.map((i, idx) => <li key={idx}>· {i}</li>)}
              </ul>

              <div className="flex items-end justify-between bg-brand-cream rounded-lg p-3 gap-2">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Pieno</p>
                  <p className="text-sm text-muted-foreground line-through">{formatEuro(b.fullPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-brand-gold tracking-wide">Offerta</p>
                  <p className="font-display text-2xl font-bold text-brand-gold leading-none">
                    {b.offerPrice === null ? "TBD" : formatEuro(b.offerPrice)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Margine</p>
                  <p className={`text-sm font-bold ${m.pct === null ? "text-muted-foreground" : m.pct < 15 ? "text-danger" : m.pct < 25 ? "text-warning" : "text-success"}`}>
                    {m.pct === null ? "—" : m.pct.toFixed(0) + "%"}
                  </p>
                  {m.eur !== null && <p className="text-[10px] text-muted-foreground">{formatEuro(m.eur)}</p>}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditId(b.id)} className="flex-1 text-xs bg-brand-green text-brand-cream rounded-lg py-2 font-semibold">Modifica</button>
                <button onClick={() => setWaId(b.id)} className="flex-1 text-xs bg-success text-white rounded-lg py-2 font-semibold">Promo WhatsApp</button>
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <BundleSheet mode="new" onClose={() => setOpenNew(false)} onSave={(b) => { addBundle(b); setOpenNew(false); }} />}

      {editId && (() => {
        const b = bundles.find(x => x.id === editId);
        if (!b) return null;
        return (
          <BundleSheet mode="edit" bundle={b} onClose={() => setEditId(null)}
            onSave={(patch) => { updateBundle(b.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm(`Eliminare ${b.name}?`)) { deleteBundle(b.id); setEditId(null); } }} />
        );
      })()}

      {waId && (() => {
        const b = bundles.find(x => x.id === waId);
        if (!b) return null;
        return (
          <WhatsAppDialog open={true} onClose={() => setWaId(null)}
            phone="" context={{ bundle: b }}
            defaultTemplate="promo_bundle" templates={["promo_bundle", "libero"]}
            title={`Promo · ${b.name}`}
          />
        );
      })()}
    </div>
  );
}

function RankCard({ title, items, empty }: { title: string; items: { name: string; value: string }[]; empty?: string }) {
  return (
    <div className="bg-card rounded-xl p-4">
      <h3 className="font-display text-base text-brand-green mb-2">{title}</h3>
      {items.length === 0 && <p className="text-xs text-muted-foreground">{empty ?? "—"}</p>}
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

// ============ BUNDLE SHEET ============

interface IngredientRow {
  productId: string | null;
  name: string;     // se productId è null è il testo libero (per compat con bundle vecchi)
  qtyKg: number;    // quantità in kg
  unitCost: number | null;
  unitPrice: number;
}

// Parsing best-effort di una riga string ingrediente legacy (es. "Mozzarella 0,5 kg")
function parseLegacyIngredient(raw: string, products: Product[]): IngredientRow {
  const m = raw.match(/(.+?)\s+([\d.,]+)\s*kg/i);
  const name = (m ? m[1] : raw).trim();
  const qty = m ? parseFloat(m[2].replace(",", ".")) : 0.2;
  const prod = products.find(p => p.name.toLowerCase() === name.toLowerCase());
  return {
    productId: prod?.id ?? null,
    name,
    qtyKg: isNaN(qty) ? 0.2 : qty,
    unitCost: prod?.cost ?? null,
    unitPrice: prod?.price ?? 0,
  };
}

function ingredientToString(r: IngredientRow): string {
  const qty = r.qtyKg < 1 ? `${(r.qtyKg * 1000).toFixed(0)}g` : `${r.qtyKg.toString().replace(".", ",")} kg`;
  return `${r.name} ${qty}`;
}

function BundleSheet({ mode, bundle, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; bundle?: Bundle;
  onClose: () => void; onSave: (b: any) => void; onDelete?: () => void;
}) {
  const { products, addProduct } = useStore();

  const [name, setName] = useState(bundle?.name ?? "");
  const initialRows: IngredientRow[] = bundle
    ? bundle.ingredients.map(s => parseLegacyIngredient(s, products))
    : [];
  const [rows, setRows] = useState<IngredientRow[]>(initialRows);
  const [phase, setPhase] = useState<"build" | "review">(mode === "edit" ? "review" : "build");
  const [newProdOpen, setNewProdOpen] = useState(false);
  const [newProdAtIndex, setNewProdAtIndex] = useState<number | null>(null);

  const [availability, setAvailability] = useState(bundle?.availability ?? "Sempre attivo");
  const [fullPrice, setFullPrice] = useState<string>(bundle?.fullPrice?.toString() ?? "");
  const [offerPrice, setOfferPrice] = useState<string>(bundle?.offerPrice?.toString() ?? "");
  const [estimatedCost, setEstimatedCost] = useState<string>(bundle?.estimatedCost?.toString() ?? "");
  const [active, setActive] = useState(bundle?.active ?? true);
  const [startDate, setStartDate] = useState(bundle?.startDate ?? "");
  const [endDate, setEndDate] = useState(bundle?.endDate ?? "");
  const [channel, setChannel] = useState(bundle?.channel ?? "");
  const [targetSegment, setTargetSegment] = useState<Segment | "">((bundle?.targetSegment as any) ?? "");
  const [goal, setGoal] = useState(bundle?.goal ?? "");

  const totalCost = useMemo(
    () => rows.reduce((s, r) => s + (r.unitCost == null ? 0 : r.unitCost * r.qtyKg), 0),
    [rows],
  );
  const totalFullPrice = useMemo(
    () => rows.reduce((s, r) => s + r.unitPrice * r.qtyKg, 0),
    [rows],
  );
  const computedOffer = useMemo(() => {
    // suggerimento: ~85% del prezzo pieno arrotondato a 0.10
    const raw = totalFullPrice * 0.85;
    return Math.round(raw * 10) / 10;
  }, [totalFullPrice]);

  const finalize = () => {
    setFullPrice(totalFullPrice.toFixed(2));
    setEstimatedCost(totalCost.toFixed(2));
    if (!offerPrice) setOfferPrice(computedOffer.toFixed(2));
    setPhase("review");
  };

  const fp = parseFloat(fullPrice) || 0;
  const op = offerPrice === "" ? null : parseFloat(offerPrice);
  const ec = estimatedCost === "" ? null : parseFloat(estimatedCost);
  const price = op ?? fp;
  const margin = ec !== null && price > 0 ? ((price - ec) / price) * 100 : null;
  const marginEur = ec !== null && price > 0 ? price - ec : null;

  const addRow = (productId: string | null = null) => {
    if (productId) {
      const prod = products.find(p => p.id === productId);
      if (!prod) return;
      setRows(prev => [...prev, {
        productId: prod.id, name: prod.name, qtyKg: 0.2,
        unitCost: prod.cost ?? null, unitPrice: prod.price,
      }]);
    } else {
      setRows(prev => [...prev, { productId: null, name: "", qtyKg: 0.2, unitCost: null, unitPrice: 0 }]);
    }
  };
  const updateRow = (i: number, patch: Partial<IngredientRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const save = () => {
    if (!name.trim() || fp <= 0 || rows.length === 0) return;
    onSave({
      name: name.trim(),
      availability,
      ingredients: rows.map(ingredientToString),
      fullPrice: fp,
      offerPrice: op,
      estimatedCost: ec ?? undefined,
      active,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      channel: channel.trim() || undefined,
      targetSegment: targetSegment || undefined,
      goal: goal.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={mode === "new" ? "Nuova Offerta" : "Modifica Offerta"}
      footer={
        <div className="flex gap-3 items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Margine: </span>
            <span className={`font-bold ${margin === null ? "text-muted-foreground" : margin < 15 ? "text-danger" : margin < 25 ? "text-warning" : "text-success"}`}>
              {margin === null ? "n/d" : `${margin.toFixed(1)}%`}
            </span>
            {marginEur !== null && <span className="text-muted-foreground"> · {formatEuro(marginEur)}</span>}
          </div>
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!name.trim() || fp <= 0 || rows.length === 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma
          </button>
        </div>
      }
    >
      <Field label="Nome offerta">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>

      <Field label={`Ingredienti (${rows.length})`}>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <IngredientPicker key={i} row={r} products={products}
              onChange={(patch) => updateRow(i, patch)}
              onRemove={() => removeRow(i)}
              onCreateNew={() => { setNewProdAtIndex(i); setNewProdOpen(true); }} />
          ))}
          <IngredientSearch products={products}
            onPick={(productId) => addRow(productId)}
            onCreateNew={() => { setNewProdAtIndex(null); setNewProdOpen(true); }} />

          {rows.length > 0 && phase === "build" && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => addRow(null)}
                className="flex-1 text-xs border border-brand-green/40 text-brand-green rounded-lg py-2 font-semibold">
                + Aggiungi altro prodotto
              </button>
              <button onClick={finalize}
                className="flex-1 text-xs bg-brand-gold text-white rounded-lg py-2 font-semibold">
                Termina bundle
              </button>
            </div>
          )}

          {(phase === "review" || mode === "edit") && rows.length > 0 && (
            <div className="bg-brand-cream rounded-lg p-3 mt-2 text-xs space-y-1">
              <div className="flex justify-between"><span>Costo totale</span><strong>{formatEuro(totalCost)}</strong></div>
              <div className="flex justify-between"><span>Prezzo pieno</span><strong>{formatEuro(totalFullPrice)}</strong></div>
              <div className="flex justify-between text-brand-gold"><span>Offerta consigliata</span><strong>{formatEuro(computedOffer)}</strong></div>
            </div>
          )}
        </div>
      </Field>

      {(phase === "review" || mode === "edit") && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Prezzo pieno (€)">
              <input type="number" step="0.01" value={fullPrice} onChange={(e) => setFullPrice(e.target.value)}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Prezzo offerta (€)">
              <input type="number" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Costo stimato bundle (€)">
              <input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Disponibilità">
              <input value={availability} onChange={(e) => setAvailability(e.target.value)}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Canale consigliato">
              <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="es. WhatsApp broadcast"
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Segmento target">
              <select value={targetSegment} onChange={(e) => setTargetSegment(e.target.value as Segment | "")}
                className="w-full bg-card border border-border rounded-lg p-3">
                <option value="">— Nessuno —</option>
                {(Object.keys(SEGMENT_META) as Segment[]).map(s => <option key={s} value={s}>{SEGMENT_META[s].label}</option>)}
              </select>
            </Field>
            <Field label="Obiettivo">
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="es. Riattivare inattivi"
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Inizio">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Fine">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
          </div>

          <Field label="Attivo">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Visibile sul banco e proponibile
            </label>
          </Field>
        </>
      )}

      {newProdOpen && (
        <NewProductMini onClose={() => setNewProdOpen(false)}
          onCreate={(p) => {
            const created = addProduct(p);
            const row: IngredientRow = {
              productId: created.id, name: created.name, qtyKg: 0.2,
              unitCost: created.cost ?? null, unitPrice: created.price,
            };
            if (newProdAtIndex !== null) {
              setRows(prev => prev.map((r, i) => i === newProdAtIndex ? row : r));
            } else {
              setRows(prev => [...prev, row]);
            }
            setNewProdOpen(false);
            setNewProdAtIndex(null);
          }} />
      )}
    </Sheet>
  );
}

function IngredientSearch({ products, onPick, onCreateNew }: {
  products: Product[]; onPick: (id: string) => void; onCreateNew: () => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return products.filter(p => p.name.toLowerCase().includes(term)).slice(0, 8);
  }, [q, products]);

  return (
    <div className="bg-card border border-dashed border-border rounded-lg p-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca ingrediente..."
        className="w-full bg-background border border-border rounded p-2 text-sm" />
      {q && (
        <div className="mt-2 space-y-1">
          {matches.map(p => (
            <button key={p.id} onClick={() => { onPick(p.id); setQ(""); }}
              className="w-full text-left text-xs bg-background hover:bg-brand-cream rounded p-2">
              {p.name} <span className="text-muted-foreground">· {formatEuro(p.price)}/{p.unit}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <button onClick={() => { onCreateNew(); setQ(""); }}
              className="w-full text-left text-xs bg-brand-gold/15 text-brand-gold font-semibold rounded p-2">
              + Aggiungi prodotto "{q}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IngredientPicker({ row, products, onChange, onRemove, onCreateNew }: {
  row: IngredientRow; products: Product[];
  onChange: (patch: Partial<IngredientRow>) => void;
  onRemove: () => void;
  onCreateNew: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-2 space-y-2">
      <div className="flex gap-2 items-center">
        <select value={row.productId ?? ""} onChange={(e) => {
          if (e.target.value === "__new__") { onCreateNew(); return; }
          const prod = products.find(p => p.id === e.target.value);
          if (prod) onChange({ productId: prod.id, name: prod.name, unitCost: prod.cost ?? null, unitPrice: prod.price });
        }} className="flex-1 bg-background border border-border rounded p-2 text-sm">
          {!row.productId && <option value="">{row.name || "— seleziona —"}</option>}
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new__">+ Aggiungi prodotto nuovo</option>
        </select>
        <button onClick={onRemove} className="text-danger text-lg px-2">×</button>
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        {QTY_PRESETS.map(q => (
          <button key={q} onClick={() => onChange({ qtyKg: q })}
            className={`px-2 py-1 rounded text-[11px] font-semibold ${Math.abs(row.qtyKg - q) < 0.001 ? "bg-brand-green text-brand-cream" : "bg-background border border-border"}`}>
            {q.toString().replace(".", ",")} kg
          </button>
        ))}
        <input type="number" step="0.05" min="0"
          value={Number.isFinite(row.qtyKg) ? row.qtyKg : 0}
          onChange={(e) => onChange({ qtyKg: Math.max(0, Number(e.target.value)) })}
          className="w-20 bg-background border border-border rounded p-1 text-xs ml-1" />
        <span className="text-[10px] text-muted-foreground">kg</span>
      </div>
      <div className="text-[11px] text-muted-foreground flex justify-between">
        <span>Costo: {row.unitCost == null ? "n.d." : formatEuro(row.unitCost * row.qtyKg)}</span>
        <span>Pieno: {formatEuro(row.unitPrice * row.qtyKg)}</span>
      </div>
    </div>
  );
}

// Mini "crea prodotto" (stessa shape di entrate-merci). Aggiunge il prodotto al catalogo.
function NewProductMini({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (p: Omit<Product, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Dispensa");
  const [unit, setUnit] = useState<"kg" | "pz">("kg");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");

  const save = () => {
    if (!name.trim()) { alert("Inserisci il nome"); return; }
    onCreate({
      name: name.trim(), category, unit,
      cost: cost ? Number(cost) : null,
      price: price ? Number(price) : 0,
      active: true, available: true,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title="Nuovo prodotto"
      footer={<button onClick={save} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Crea e aggiungi al bundle</button>}>
      <Field label="Nome prodotto">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select value={category} onChange={e => setCategory(e.target.value as ProductCategory)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Unità">
          <select value={unit} onChange={e => setUnit(e.target.value as "kg" | "pz")}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="kg">Kg</option>
            <option value="pz">Pezzo</option>
          </select>
        </Field>
        <Field label="Costo €/unità">
          <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Prezzo €/unità">
          <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
    </Sheet>
  );
}
