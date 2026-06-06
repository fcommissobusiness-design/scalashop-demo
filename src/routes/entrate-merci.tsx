import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatDate, formatEuro } from "@/components/AppShell";
import { QtyInput } from "@/components/QtyInput";
import {
  type GoodsReceipt, type GoodsReceiptItem, type GoodsReceiptStatus,
  type GoodsReceiptAttachment, type InvoicePaymentStatus, type DocumentKind,
  type PaymentMethod, type Product, type ProductCategory,
  type FiscalCategory, type SupplierPayment,
  FISCAL_CATEGORIES,
  GOODS_RECEIPT_STATUS_LABEL, INVOICE_STATUS_LABEL, calcReceiptTotal,
} from "@/lib/data";
import { putAttachment, getAttachmentUrl, deleteAttachment, downloadAttachment } from "@/lib/attachments";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";

export const Route = createFileRoute("/entrate-merci")({ component: EntrateMerciPage });

// Filtro lista: stati attivi semplificati
const FILTER_STATUSES: GoodsReceiptStatus[] = ["attesa", "ricevuta", "annullata"];
// Stati selezionabili nella scheda
const SHEET_STATUSES: GoodsReceiptStatus[] = ["attesa", "ricevuta", "annullata"];
const PAY_STATUSES: InvoicePaymentStatus[] = ["da_pagare", "pagato", "scaduto", "non_applicabile"];
const PAYMENT_METHODS: PaymentMethod[] = ["contanti", "pos", "bonifico", "carta", "altro"];


function isOverdue(r: GoodsReceipt): boolean {
  if (r.paymentStatus !== "da_pagare") return false;
  if (!r.paymentDueDate) return false;
  return new Date(r.paymentDueDate).getTime() < Date.now();
}

function EntrateMerciPage() {
  const { goodsReceipts, suppliers, products, deleteGoodsReceipt } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GoodsReceiptStatus>("all");
  const [payFilter, setPayFilter] = useState<"all" | InvoicePaymentStatus | "scaduto_only">("all");
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);

  const list = useMemo(() => {
    let base = goodsReceipts.filter(r => inFrame(r.date, tf));
    if (supplierFilter) base = base.filter(r => r.supplierId === supplierFilter);
    if (statusFilter !== "all") base = base.filter(r => r.status === statusFilter);
    if (payFilter === "scaduto_only") base = base.filter(isOverdue);
    else if (payFilter !== "all") base = base.filter(r => r.paymentStatus === payFilter);
    if (q.trim()) {
      const s = q.toLowerCase();
      base = base.filter(r => {
        const sup = suppliers.find(x => x.id === r.supplierId);
        return (sup?.name ?? "").toLowerCase().includes(s)
          || (r.invoiceNumber ?? "").toLowerCase().includes(s)
          || (r.ddtNumber ?? "").toLowerCase().includes(s)
          || (r.notes ?? "").toLowerCase().includes(s);
      });
    }
    return base.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [goodsReceipts, suppliers, q, supplierFilter, statusFilter, payFilter, tf]);

  return (
    <div>
      <TopBar title="Scarico Prodotti" subtitle="Carico merce in magazzino" />

      <div className="px-4 md:px-6 pt-4 flex justify-end">
        <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
          {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>


      <div className="px-4 md:px-6 space-y-2 pb-2">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cerca fornitore, fattura, DDT, note..."
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-2">
          <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
            <option value="">Tutti i fornitori</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
            <option value="all">Tutti gli stati</option>
            {FILTER_STATUSES.map(s => <option key={s} value={s}>{GOODS_RECEIPT_STATUS_LABEL[s]}</option>)}
          </select>

          <select value={payFilter} onChange={e => setPayFilter(e.target.value as any)}
            className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
            <option value="all">Tutti pagamenti</option>
            <option value="da_pagare">Da pagare</option>
            <option value="scaduto_only">Solo scadute</option>
            <option value="pagato">Pagate</option>
            <option value="scaduto">Stato scaduto</option>
            <option value="non_applicabile">N/A</option>
          </select>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {list.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nessuna consegna trovata.</p>
        )}
        {list.map(r => {
          const sup = suppliers.find(s => s.id === r.supplierId);
          const tot = r.documentTotal ?? calcReceiptTotal(r);
          const overdue = isOverdue(r);
          return (
            <button key={r.id} onClick={() => setEditId(r.id)}
              className="w-full text-left bg-card rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-display text-base text-brand-green truncate">{sup?.name ?? "Fornitore"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.date)} · {r.items.length} articoli
                    {r.invoiceNumber ? ` · ${r.invoiceNumber}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg text-brand-green">{formatEuro(tot)}</p>
                  <p className="text-[10px] text-muted-foreground">{(r.attachments ?? []).length} allegati</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge>{GOODS_RECEIPT_STATUS_LABEL[r.status]}</Badge>
                {r.paymentStatus && (
                  <Badge tone={overdue ? "danger" : r.paymentStatus === "pagato" ? "success" : r.paymentStatus === "da_pagare" ? "warn" : undefined}>
                    {overdue ? "Scaduto" : INVOICE_STATUS_LABEL[r.paymentStatus]}
                  </Badge>
                )}
                {r.paymentDueDate && r.paymentStatus === "da_pagare" && (
                  <Badge>scad. {formatDate(r.paymentDueDate)}</Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <ReceiptSheet mode="new" onClose={() => setOpenNew(false)} />
      )}
      {editId && (() => {
        const r = goodsReceipts.find(x => x.id === editId);
        if (!r) return null;
        return (
          <ReceiptSheet mode="edit" receipt={r} onClose={() => setEditId(null)}
            onDelete={async () => {
              if (!confirm("Eliminare questa consegna? Lo stock verrà riportato indietro.")) return;
              for (const a of r.attachments ?? []) {
                try { await deleteAttachment(a.id); } catch {}
              }
              deleteGoodsReceipt(r.id);
              setEditId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function Kpi({ label, value, sub, warn, danger }: { label: string; value: string; sub?: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : warn ? "text-warning" : "text-brand-green"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "success" | "warn" | "danger" }) {
  const cls =
    tone === "success" ? "bg-success/15 text-success" :
    tone === "warn" ? "bg-warning/15 text-warning" :
    tone === "danger" ? "bg-danger/15 text-danger" :
    "bg-muted text-foreground/70";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{children}</span>;
}

// --------- Sheet ---------

function ReceiptSheet({ mode, receipt, onClose, onDelete }: {
  mode: "new" | "edit";
  receipt?: GoodsReceipt;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const { suppliers, products, goodsReceipts, addGoodsReceipt, updateGoodsReceipt, addProduct, updateProduct, addSupplier, addSupplierPayment } = useStore();

  // Corrieri già registrati (da ricevute esistenti)
  const carriers = useMemo(() => {
    const set = new Set<string>();
    goodsReceipts.forEach(r => { if (r.carrier?.trim()) set.add(r.carrier.trim()); });
    return Array.from(set).sort();
  }, [goodsReceipts]);

  const [supplierId, setSupplierId] = useState(receipt?.supplierId ?? suppliers[0]?.id ?? "");
  const [supplierQ, setSupplierQ] = useState<string>("");
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [date, setDate] = useState(receipt?.date.slice(0, 16) ?? new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<GoodsReceiptStatus>(receipt?.status ?? "ricevuta");
  const [items, setItems] = useState<GoodsReceiptItem[]>(receipt?.items ?? []);
  const [carrier, setCarrier] = useState(receipt?.carrier ?? "");
  const [addingCarrier, setAddingCarrier] = useState(false);
  const [newProductFor, setNewProductFor] = useState<number | "append" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(receipt?.paymentMethod ?? "");
  const [notes, setNotes] = useState(receipt?.notes ?? "");


  const [invoiceNumber, setInvoiceNumber] = useState(receipt?.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(receipt?.invoiceDate?.slice(0, 10) ?? "");
  const [ddtNumber, setDdtNumber] = useState(receipt?.ddtNumber ?? "");
  const [taxableAmount, setTaxableAmount] = useState(receipt?.taxableAmount?.toString() ?? "");
  const [vatAmount, setVatAmount] = useState(receipt?.vatAmount?.toString() ?? "");
  const [documentTotal, setDocumentTotal] = useState(receipt?.documentTotal?.toString() ?? "");
  const [paymentDueDate, setPaymentDueDate] = useState(receipt?.paymentDueDate?.slice(0, 10) ?? "");
  const [paymentStatus, setPaymentStatus] = useState<InvoicePaymentStatus | "">(receipt?.paymentStatus ?? "");
  const [deductible, setDeductible] = useState<boolean>(true);
  const [fiscalCategory, setFiscalCategory] = useState<FiscalCategory>("Acquisti merci");
  const [autoPayment, setAutoPayment] = useState<boolean>(mode === "new");

  const [attachments, setAttachments] = useState<GoodsReceiptAttachment[]>(receipt?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const supplierProducts = useMemo(() => {
    const sup = suppliers.find(s => s.id === supplierId);
    const ids = new Set(sup?.productIds ?? []);
    const linked = products.filter(p => ids.has(p.id));
    const others = products.filter(p => !ids.has(p.id));
    return [...linked, ...others];
  }, [suppliers, products, supplierId]);

  const computedTotal = useMemo(
    () => items.reduce((s, it) => s + (it.unitCost ?? 0) * it.qty, 0),
    [items]
  );

  const addItem = () => {
    const first = supplierProducts[0];
    if (!first) return;
    setItems(prev => [...prev, { productId: first.id, qty: 1, unitCost: first.cost ?? undefined }]);
  };

  const updateItem = (idx: number, patch: Partial<GoodsReceiptItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const added: GoodsReceiptAttachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) {
          setUploadErr(`${f.name}: file > 10MB ignorato.`);
          continue;
        }
        const meta = await putAttachment(f);
        added.push({ ...meta, kind: guessKind(f.name) });
      }
      setAttachments(prev => [...prev, ...added]);
    } catch (e) {
      setUploadErr((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = async (id: string) => {
    try { await deleteAttachment(id); } catch {}
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const save = () => {
    if (!supplierId) { alert("Seleziona un fornitore"); return; }
    // Override prezzo costo: se il costo unitario inserito differisce da quello in scheda prodotto, chiedi all'utente
    for (const it of items) {
      if (it.unitCost == null) continue;
      const p = products.find(x => x.id === it.productId);
      if (!p) continue;
      const cur = p.cost ?? 0;
      if (Math.abs(cur - it.unitCost) > 0.005) {
        if (confirm(`"${p.name}": costo in scheda ${formatEuro(cur)}, costo in questa consegna ${formatEuro(it.unitCost)}.\n\nAggiornare il costo di listino?`)) {
          updateProduct(p.id, { cost: it.unitCost });
        }
      }
    }
    const payload: Omit<GoodsReceipt, "id" | "createdAt"> = {
      supplierId,
      date: new Date(date).toISOString(),
      status,
      items,
      totalCost: documentTotal ? Number(documentTotal) : computedTotal || undefined,
      carrier: carrier.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      notes: notes.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
      ddtNumber: ddtNumber.trim() || undefined,
      taxableAmount: taxableAmount ? Number(taxableAmount) : undefined,
      vatAmount: vatAmount ? Number(vatAmount) : undefined,
      documentTotal: documentTotal ? Number(documentTotal) : undefined,
      paymentDueDate: paymentDueDate ? new Date(paymentDueDate).toISOString() : undefined,
      paymentStatus: paymentStatus || undefined,
      attachments,
    };
    if (mode === "new") {
      const created = addGoodsReceipt(payload);
      // Auto-crea uscita collegata (alimenta Cassa / Fiscalità / Finanziario)
      const amount = payload.documentTotal ?? payload.totalCost ?? computedTotal;
      if (autoPayment && amount && amount > 0) {
        const supName = suppliers.find(s => s.id === supplierId)?.name ?? "Fornitore";
        const payStatus = (paymentStatus === "pagato") ? "pagato"
                        : (paymentStatus === "scaduto") ? "scaduto" : "da_pagare";
        addSupplierPayment({
          date: created.date,
          beneficiary: supName,
          beneficiaryType: "fornitore",
          supplierId,
          category: "Merce",
          amount,
          method: (paymentMethod || "bonifico") as PaymentMethod,
          status: payStatus,
          dueDate: payload.paymentDueDate,
          recurrence: "una_tantum",
          document: payload.invoiceNumber ? "fattura" : "nessuno",
          notes: `Auto da Scarico Prodotti${payload.invoiceNumber ? ` · Fatt. ${payload.invoiceNumber}` : ""}`,
          deductible,
          fiscalCategory,
        } as Omit<SupplierPayment, "id">);
      }
    }
    else if (receipt) updateGoodsReceipt(receipt.id, payload);
    onClose();
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Scarico Prodotti" : "Scarico Prodotti"}

      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete}
              className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save}
            className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fornitore">
          {(() => {
            const sel = suppliers.find(s => s.id === supplierId);
            const sugg = supplierQ.length >= 1
              ? suppliers.filter(s => s.name.toLowerCase().includes(supplierQ.toLowerCase())).slice(0, 8)
              : [];
            return (
              <div className="relative">
                <input value={sel ? sel.name : supplierQ}
                  onChange={e => { setSupplierQ(e.target.value); setSupplierId(""); }}
                  placeholder="Cerca fornitore…"
                  className="w-full bg-card border border-border rounded-lg p-3" />
                {sugg.length > 0 && !sel && (
                  <div className="bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto">
                    {sugg.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setSupplierId(s.id); setSupplierQ(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-brand-cream text-sm border-b border-border last:border-0">
                        {s.name} <span className="text-xs text-muted-foreground">{s.category}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!sel && supplierQ.trim().length >= 2 && (
                  <button type="button" onClick={() => setNewSupplierOpen(true)}
                    className="mt-1 text-xs bg-brand-gold/15 text-brand-gold font-semibold rounded p-2 w-full text-left">
                    + Aggiungi nuovo fornitore "{supplierQ.trim()}"
                  </button>
                )}
              </div>
            );
          })()}
        </Field>
        <Field label="Data e ora">
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Stato consegna">
          <select value={status} onChange={e => setStatus(e.target.value as GoodsReceiptStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {SHEET_STATUSES.map(s => <option key={s} value={s}>{GOODS_RECEIPT_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Corriere consegna">
          {addingCarrier ? (
            <input value={carrier} onChange={e => setCarrier(e.target.value)} autoFocus
              placeholder="Nome corriere"
              onBlur={() => setAddingCarrier(false)}
              className="w-full bg-card border border-border rounded-lg p-3" />
          ) : (
            <select value={carrier} onChange={e => {
              if (e.target.value === "__add__") { setCarrier(""); setAddingCarrier(true); }
              else setCarrier(e.target.value);
            }} className="w-full bg-card border border-border rounded-lg p-3">
              <option value="__add__">+ Aggiungi corriere</option>
              <option value="">— Nessuno —</option>
              {carriers.map(c => <option key={c} value={c}>{c}</option>)}
              {carrier && !carriers.includes(carrier) && <option value={carrier}>{carrier}</option>}
            </select>
          )}
        </Field>

      </div>

      {/* ITEMS */}
      <Field label={`Prodotti consegnati (${items.length}) · totale stimato ${formatEuro(computedTotal)}`}>
        <div className="space-y-2">
          {items.map((it, i) => {
            const prod = products.find(p => p.id === it.productId);
            const unitLabel = prod?.unit === "kg" ? "kg" : "pz";
            const step = prod?.unit === "kg" ? 0.1 : 1;
            return (
            <div key={i} className="bg-card border border-border rounded-lg p-2 space-y-2">
              <select value={it.productId} onChange={e => {
                if (e.target.value === "__new__") setNewProductFor(i);
                else {
                  const np = products.find(p => p.id === e.target.value);
                  updateItem(i, { productId: e.target.value, unitCost: np?.cost ?? it.unitCost });
                }
              }} className="w-full bg-background border border-border rounded p-2 text-sm">
                <option value="__new__">+ Aggiungi prodotto nuovo</option>
                {supplierProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <p className="text-[10px] text-muted-foreground mb-1">Quantità ({unitLabel})</p>
                  <QtyInput value={it.qty} step={step} unit={unitLabel}
                    onChange={(q) => updateItem(i, { qty: q })} />
                </div>
                <label className="col-span-6 text-[10px] text-muted-foreground">
                  Costo unitario (€)
                  <input type="number" step="0.01" value={it.unitCost ?? ""}
                    onChange={e => updateItem(i, { unitCost: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded p-2 text-sm mt-1" />
                </label>
                <button onClick={() => removeItem(i)} className="col-span-1 text-danger text-lg pb-1">×</button>
                <label className="col-span-8 text-[10px] text-muted-foreground">
                  Lotto (opz.) <span className="text-muted-foreground/70">— stesso prodotto + stesso lotto = somma</span>
                  <input value={it.lotCode ?? ""}
                    onChange={e => updateItem(i, { lotCode: e.target.value })}
                    placeholder="auto se vuoto"
                    className="w-full bg-background border border-border rounded p-2 text-xs mt-1 font-mono" />
                </label>
                <label className="col-span-4 text-[10px] text-muted-foreground">
                  Subtotale
                  <p className="font-semibold text-sm py-2">{formatEuro((it.unitCost ?? 0) * it.qty)}</p>
                </label>
              </div>
            </div>
          );})}
          <select onChange={e => {
            if (e.target.value === "__new__") setNewProductFor("append");
            else if (e.target.value) {
              setItems(prev => [...prev, { productId: e.target.value, qty: 1, unitCost: supplierProducts.find(p => p.id === e.target.value)?.cost ?? undefined }]);
            }
            e.target.value = "";
          }} className="w-full text-sm border border-dashed border-border rounded-lg p-2 bg-card text-brand-green font-semibold">
            <option value="">+ Scegli prodotto dal listino</option>
            <option value="__new__">+ Aggiungi prodotto nuovo</option>
            {supplierProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </Field>

      {newProductFor !== null && (
        <NewProductMini
          onClose={() => setNewProductFor(null)}
          onCreate={(p) => {
            const created = addProduct(p);
            const baseItem: GoodsReceiptItem = { productId: created.id, qty: 1, unitCost: p.cost ?? undefined };
            setItems(prev => {
              if (newProductFor === "append") return [...prev, baseItem];
              return prev.map((it, i) => i === newProductFor ? baseItem : it);
            });
            setNewProductFor(null);
          }}
        />
      )}

      {newSupplierOpen && (
        <Sheet open={true} onClose={() => setNewSupplierOpen(false)} title="Nuovo fornitore">
          <NewSupplierMini initialName={supplierQ.trim()}
            onCancel={() => setNewSupplierOpen(false)}
            onCreate={(name, category) => {
              const s = addSupplier({ name, category: category || "Altro" });
              setSupplierId(s.id); setSupplierQ(""); setNewSupplierOpen(false);
            }} />
        </Sheet>
      )}





      {/* DOCUMENTO */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="N. Fattura">
          <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data fattura">
          <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="N. DDT">
          <input value={ddtNumber} onChange={e => setDdtNumber(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Metodo pagamento">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod | "")}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">—</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Imponibile €">
          <input type="number" step="0.01" value={taxableAmount} onChange={e => setTaxableAmount(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="IVA €">
          <input type="number" step="0.01" value={vatAmount} onChange={e => setVatAmount(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Totale documento €">
          <input type="number" step="0.01" value={documentTotal} onChange={e => setDocumentTotal(e.target.value)}
            placeholder={computedTotal ? computedTotal.toFixed(2) : ""}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Scadenza pagamento">
          <input type="date" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Stato pagamento">
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as InvoicePaymentStatus | "")}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">—</option>
            {PAY_STATUSES.map(s => <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Deducibile fiscalmente">
          <select value={deductible ? "si" : "no"} onChange={e => setDeductible(e.target.value === "si")}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="si">Sì</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Categoria fiscale">
          <select value={fiscalCategory} onChange={e => setFiscalCategory(e.target.value as FiscalCategory)}
            className="w-full bg-card border border-border rounded-lg p-3 col-span-2">
            {FISCAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {mode === "new" && (
        <label className="flex items-start gap-2 bg-muted/40 border border-border rounded-lg p-3 text-xs cursor-pointer">
          <input type="checkbox" checked={autoPayment} onChange={e => setAutoPayment(e.target.checked)}
            className="mt-0.5" />
          <span>
            <strong>Registra automaticamente l'uscita collegata</strong>
            <span className="block text-muted-foreground mt-0.5">
              Crea un movimento in Uscite/Cassa che alimenta Fiscalità e Finanziario senza reinserire i dati.
            </span>
          </span>
        </label>
      )}

      {/* ALLEGATI */}
      <Field label={`Allegati (${attachments.length}) — fattura, DDT, ricevuta, foto...`}>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple
            onChange={e => onPickFiles(e.target.files)}
            className="text-xs" />
          {uploading && <p className="text-xs text-muted-foreground">Caricamento in corso...</p>}
          {uploadErr && <p className="text-xs text-danger">{uploadErr}</p>}
          <div className="space-y-1.5">
            {attachments.map(a => (
              <AttachmentRow key={a.id} att={a} onDelete={() => removeAttachment(a.id)} />
            ))}
            {attachments.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nessun allegato. PDF e immagini, max 10MB.</p>
            )}
          </div>
        </div>
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      {mode === "edit" && (
        <div className="text-xs text-muted-foreground">
          <Link to="/fornitori" className="underline">Apri scheda fornitore →</Link>
        </div>
      )}
    </Sheet>
  );
}

function guessKind(name: string): DocumentKind {
  const n = name.toLowerCase();
  if (n.includes("fatt")) return "fattura";
  if (n.includes("ddt")) return "ddt";
  if (n.includes("ricev")) return "ricevuta";
  if (n.includes("prev")) return "preventivo";
  return "altro";
}

function AttachmentRow({ att, onDelete }: { att: GoodsReceiptAttachment; onDelete: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImg = att.type.startsWith("image/");

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    if (isImg) {
      getAttachmentUrl(att.id).then(u => { if (alive) { url = u; setPreviewUrl(u); } });
    }
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [att.id, isImg]);

  const open = async () => {
    const u = await getAttachmentUrl(att.id);
    if (u) window.open(u, "_blank");
  };

  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-2">
      {isImg && previewUrl ? (
        <img src={previewUrl} alt="" className="w-10 h-10 object-cover rounded" />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground/60">
          {att.type.includes("pdf") ? "PDF" : "FILE"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{att.name}</p>
        <p className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(0)} KB · {att.kind ?? "altro"}</p>
      </div>
      <button onClick={open} className="text-xs text-brand-green font-semibold px-2">Apri</button>
      <button onClick={() => downloadAttachment(att)} className="text-xs text-brand-green font-semibold px-2">Scarica</button>
      <button onClick={onDelete} className="text-xs text-danger font-semibold px-2">×</button>
    </div>
  );
}

const CATEGORIES: ProductCategory[] = [
  "Freschi di Bufala", "Freschi di Pecora", "Formaggi Stagionati", "Burro e Latticini",
  "Salumi", "Dispensa", "Pane", "Latte", "Bevande", "Vini", "Taralli", "Pasta",
];

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
      footer={<button onClick={save} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Crea prodotto</button>}>
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
        <Field label="Costo €">
          <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Prezzo €">
          <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
    </Sheet>
  );
}

function NewSupplierMini({ initialName, onCancel, onCreate }: {
  initialName: string;
  onCancel: () => void;
  onCreate: (name: string, category: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  return (
    <>
      <Field label="Nome">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <Field label="Categoria">
        <input value={category} onChange={e => setCategory(e.target.value)}
          placeholder="es. Salumi, Pane, Latte..."
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <div className="flex gap-2 mt-3">
        <button onClick={onCancel} className="flex-1 border border-border rounded-lg py-2 text-sm">Annulla</button>
        <button onClick={() => name.trim() && onCreate(name.trim(), category.trim())}
          className="flex-1 bg-brand-gold text-white rounded-lg py-2 text-sm font-semibold">Crea</button>
      </div>
    </>
  );
}
