import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatDate, formatEuro } from "@/components/AppShell";
import type { Supplier } from "@/lib/data";
import { calcReceiptTotal } from "@/lib/data";
import { telUrl } from "@/lib/whatsapp";
import { CopyBtn } from "@/components/QuickActions";

export const Route = createFileRoute("/fornitori")({ component: FornitoriPage });

function FornitoriPage() {
  const { suppliers, products, goodsReceipts, addSupplier, updateSupplier, deleteSupplier } = useStore();
  const navigate = useNavigate();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Stats derivate per fornitore dalle entrate merci
  const stats = useMemo(() => {
    const map = new Map<string, { total: number; lastDate: string | undefined; count: number }>();
    for (const r of goodsReceipts) {
      const cur = map.get(r.supplierId) ?? { total: 0, lastDate: undefined, count: 0 };
      cur.total += r.documentTotal ?? calcReceiptTotal(r);
      cur.count += 1;
      if (!cur.lastDate || r.date > cur.lastDate) cur.lastDate = r.date;
      map.set(r.supplierId, cur);
    }
    return map;
  }, [goodsReceipts]);

  const list = suppliers
    .filter(s => !q.trim() || s.name.toLowerCase().includes(q.toLowerCase()) || s.category.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <TopBar title="Fornitori" subtitle={`${suppliers.length} totali`} />

      <div className="px-4 md:px-6 py-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca fornitore o categoria..."
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.length === 0 && <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">Nessun fornitore.</p>}
        {list.map(s => {
          const prods = products.filter(p => s.productIds?.includes(p.id));
          const st = stats.get(s.id);
          return (
            <div key={s.id} className="bg-card rounded-xl p-4 shadow-sm">
              <button onClick={() => setEditId(s.id)} className="w-full text-left">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-display text-lg text-brand-green">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category}{s.contactName ? ` · ${s.contactName}` : ""}</p>
                  </div>
                  {(st?.lastDate ?? s.lastOrderDate) && (
                    <p className="text-[10px] text-muted-foreground">{formatDate(st?.lastDate ?? s.lastOrderDate!)}</p>
                  )}
                </div>
                {prods.length > 0 && (
                  <p className="text-xs text-foreground/70 mt-2 line-clamp-2">
                    {prods.map(p => p.name).join(" · ")}
                  </p>
                )}
                {st && st.count > 0 && (
                  <p className="text-[11px] text-brand-green mt-1 font-semibold">
                    {st.count} consegne · {formatEuro(st.total)} totali
                  </p>
                )}
                {s.notes && <p className="text-xs italic text-muted-foreground mt-1">{s.notes}</p>}
              </button>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {s.phone && (
                  <a href={telUrl(s.phone)} className="flex-1 text-center text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 font-semibold">Chiama</a>
                )}
                <button onClick={() => navigate({ to: "/entrate-merci" })}
                  className="flex-1 text-xs bg-brand-gold text-white rounded-lg py-1.5 font-semibold">Nuova consegna</button>
                {s.phone && <CopyBtn text={s.phone} label="Copia tel" />}
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <SupSheet mode="new" onClose={() => setOpenNew(false)}
        onSave={(d) => { addSupplier(d as Omit<Supplier, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const s = suppliers.find(x => x.id === editId);
        if (!s) return null;
        return <SupSheet mode="edit" supplier={s} onClose={() => setEditId(null)}
          onSave={(p) => { updateSupplier(s.id, p); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteSupplier(s.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function SupSheet({ mode, supplier, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; supplier?: Supplier;
  onClose: () => void; onSave: (s: Omit<Supplier, "id"> | Partial<Supplier>) => void;
  onDelete?: () => void;
}) {
  const { products, addProduct } = useStore();
  const [name, setName] = useState(supplier?.name ?? "");
  const [category, setCategory] = useState(supplier?.category ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [productIds, setProductIds] = useState<string[]>(supplier?.productIds ?? []);
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [productQ, setProductQ] = useState("");
  const [newProductOpen, setNewProductOpen] = useState(false);

  const toggle = (id: string) => setProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredProducts = useMemo(() => {
    const q = productQ.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productQ]);

  const exactMatch = products.some(p => p.name.toLowerCase() === productQ.trim().toLowerCase());

  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), category: category.trim() || "Altro", phone: phone.trim() || undefined,
      contactName: contactName.trim() || undefined, productIds: productIds.length ? productIds : undefined,
      notes: notes.trim() || undefined, lastOrderDate: supplier?.lastOrderDate });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo fornitore" : "Modifica fornitore"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Categoria">
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Salumi, Pane, Latte..."
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
      </div>
      <Field label={`Prodotti collegati (${productIds.length})`}>
        <input value={productQ} onChange={e => setProductQ(e.target.value)}
          placeholder="Cerca prodotto…"
          className="w-full bg-card border border-border rounded-lg p-2 text-sm mb-1" />
        {productQ.trim().length >= 2 && !exactMatch && (
          <button type="button" onClick={() => setNewProductOpen(true)}
            className="mb-1 text-xs bg-brand-gold/15 text-brand-gold font-semibold rounded p-2 w-full text-left">
            + Aggiungi nuovo prodotto "{productQ.trim()}"
          </button>
        )}
        <div className="max-h-48 overflow-y-auto border border-border rounded-lg bg-card divide-y divide-border">
          {filteredProducts.map(p => (
            <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
          {filteredProducts.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nessun prodotto trovato.</p>
          )}
        </div>
      </Field>
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      {newProductOpen && (
        <Sheet open={true} onClose={() => setNewProductOpen(false)} title="Nuovo prodotto">
          <SimpleNewProduct initialName={productQ.trim()}
            onCancel={() => setNewProductOpen(false)}
            onCreate={(n, u) => {
              const p = addProduct({
                name: n, category: "Dispensa", unit: u, cost: null, price: 0,
                active: true, available: true,
              });
              setProductIds(prev => [...prev, p.id]);
              setProductQ("");
              setNewProductOpen(false);
            }} />
        </Sheet>
      )}
    </Sheet>
  );
}

function SimpleNewProduct({ initialName, onCancel, onCreate }: {
  initialName: string;
  onCancel: () => void;
  onCreate: (name: string, unit: "kg" | "pz") => void;
}) {
  const [n, setN] = useState(initialName);
  const [u, setU] = useState<"kg" | "pz">("kg");
  return (
    <>
      <Field label="Nome prodotto">
        <input value={n} onChange={e => setN(e.target.value)} autoFocus
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <Field label="Unità">
        <select value={u} onChange={e => setU(e.target.value as "kg" | "pz")}
          className="w-full bg-card border border-border rounded-lg p-3">
          <option value="kg">Kg</option>
          <option value="pz">Pezzo</option>
        </select>
      </Field>
      <div className="flex gap-2 mt-3">
        <button onClick={onCancel} className="flex-1 border border-border rounded-lg py-2 text-sm">Annulla</button>
        <button onClick={() => n.trim() && onCreate(n.trim(), u)}
          className="flex-1 bg-brand-gold text-white rounded-lg py-2 text-sm font-semibold">Crea</button>
      </div>
    </>
  );
}
