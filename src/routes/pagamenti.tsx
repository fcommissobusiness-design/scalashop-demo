import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatEuro, formatDate } from "@/components/AppShell";
import {
  PAYMENT_CATEGORIES, FISCAL_CATEGORIES, type SupplierPayment, type SupplierPaymentStatus,
  type SupplierPaymentRecurrence, type SupplierPaymentBeneficiaryType,
  type PaymentMethod, type SupplierPaymentDocument, type PaymentAttachment,
  type FiscalCategory,
} from "@/lib/data";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";
import { putAttachment, getAttachmentUrl, deleteAttachment, downloadAttachment } from "@/lib/attachments";

export const Route = createFileRoute("/pagamenti")({ component: UscitePage });

const STATUS_LABEL: Record<SupplierPaymentStatus, string> = { da_pagare: "Da pagare", pagato: "Pagato", scaduto: "Scaduto" };
const STATUS_STYLE: Record<SupplierPaymentStatus, string> = {
  da_pagare: "bg-warning/15 text-warning",
  pagato: "bg-success/15 text-success",
  scaduto: "bg-danger/15 text-danger",
};

function UscitePage() {
  const { supplierPayments, suppliers, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment } = useStore();
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // riferimento data: dueDate se presente, altrimenti date
  const refIso = (p: SupplierPayment) => p.dueDate ?? p.date;

  const inPeriod = useMemo(() => supplierPayments.filter(p => inFrame(refIso(p), tf)), [supplierPayments, tf]);

  const nowTs = Date.now();
  const isOverdue = (p: SupplierPayment) =>
    p.status === "scaduto" || (p.status === "da_pagare" && p.dueDate && +new Date(p.dueDate) < nowTs);

  const kpi = useMemo(() => {
    let daPagare = 0, scaduti = 0, saldato = 0;
    for (const p of inPeriod) {
      if (p.status === "pagato") saldato += p.amount;
      else if (isOverdue(p)) scaduti += p.amount;
      else if (p.status === "da_pagare") daPagare += p.amount;
    }
    return { daPagare, scaduti, saldato };
  }, [inPeriod]);

  const list = useMemo(
    () => [...inPeriod].sort((a, b) => +new Date(refIso(b)) - +new Date(refIso(a))),
    [inPeriod],
  );

  return (
    <div>
      <TopBar title="Uscite" />

      <div className="px-4 md:px-6 pt-4 flex justify-end">
        <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
          {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-3 gap-3">
        <Kpi label="Da Pagare" value={formatEuro(kpi.daPagare)} warn />
        <Kpi label="Scaduti" value={formatEuro(kpi.scaduti)} danger />
        <Kpi label="Saldato" value={formatEuro(kpi.saldato)} ok />
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessuna uscita nel periodo.</p>}
        {list.map(p => (
          <div key={p.id} className="bg-card rounded-xl p-3">
            <button onClick={() => setEditId(p.id)} className="w-full text-left flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-display text-base text-brand-green truncate">{p.beneficiary}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category} · {p.beneficiaryType}{p.recurrence !== "una_tantum" ? ` · ${p.recurrence}` : ""}
                  {p.attachments && p.attachments.length > 0 && ` · 📎 ${p.attachments.length}`}
                </p>
                {p.dueDate && <p className="text-[11px] text-muted-foreground mt-0.5">Scadenza: {formatDate(p.dueDate)}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-lg text-brand-green">{formatEuro(p.amount)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
            </button>
            {p.status !== "pagato" && (
              <button onClick={() => updateSupplierPayment(p.id, { status: "pagato" })}
                className="w-full mt-2 text-xs bg-success text-white rounded-lg py-1.5 font-semibold">Segna come pagato</button>
            )}
          </div>
        ))}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <PaySheet mode="new" suppliers={suppliers} onClose={() => setOpenNew(false)}
        onSave={(d) => { addSupplierPayment(d as Omit<SupplierPayment, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const p = supplierPayments.find(x => x.id === editId);
        if (!p) return null;
        return <PaySheet mode="edit" payment={p} suppliers={suppliers} onClose={() => setEditId(null)}
          onSave={(patch) => { updateSupplierPayment(p.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteSupplierPayment(p.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function Kpi({ label, value, warn, danger, ok }: { label: string; value: string; warn?: boolean; danger?: boolean; ok?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : warn ? "text-warning" : ok ? "text-success" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

const METHODS: PaymentMethod[] = ["contanti", "pos", "bonifico", "carta", "altro"];
const RECS: SupplierPaymentRecurrence[] = ["una_tantum", "settimanale", "mensile", "annuale"];
const TYPES: SupplierPaymentBeneficiaryType[] = ["fornitore", "consulente", "servizio", "altro"];
const DOC_OPTIONS: { value: SupplierPaymentDocument; label: string }[] = [
  { value: "fattura", label: "Fattura" },
  { value: "preventivo", label: "Preventivo" },
  { value: "contratto", label: "Contratto" },
  { value: "nessuno", label: "Nessuno" },
];

export function PaySheet({ mode, payment, suppliers, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; payment?: SupplierPayment; suppliers: { id: string; name: string }[];
  onClose: () => void; onSave: (d: Omit<SupplierPayment, "id"> | Partial<SupplierPayment>) => void;
  onDelete?: () => void;
}) {
  const [beneficiary, setBeneficiary] = useState(payment?.beneficiary ?? "");
  const [beneficiaryType, setBeneficiaryType] = useState<SupplierPaymentBeneficiaryType>(payment?.beneficiaryType ?? "fornitore");
  const [supplierId, setSupplierId] = useState(payment?.supplierId ?? "");
  const [category, setCategory] = useState(payment?.category ?? PAYMENT_CATEGORIES[0]);
  const [amount, setAmount] = useState(payment?.amount ?? 0);
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "bonifico");
  const [status, setStatus] = useState<SupplierPaymentStatus>(payment?.status ?? "da_pagare");
  const [dueDate, setDueDate] = useState(payment?.dueDate?.slice(0, 10) ?? "");
  const [recurrence, setRecurrence] = useState<SupplierPaymentRecurrence>(payment?.recurrence ?? "una_tantum");
  const initialDoc: SupplierPaymentDocument = (() => {
    const d = payment?.document ?? "nessuno";
    return d === "ricevuta" ? "nessuno" : d;
  })();
  const [document, setDoc] = useState<SupplierPaymentDocument>(initialDoc);
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [deductible, setDeductible] = useState<boolean>(payment?.deductible ?? true);
  const [fiscalCategory, setFiscalCategory] = useState<FiscalCategory>(payment?.fiscalCategory ?? "Altro");
  const [attachments, setAttachments] = useState<PaymentAttachment[]>(payment?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const added: PaymentAttachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) { setUploadErr(`${f.name}: file > 10MB ignorato.`); continue; }
        const meta = await putAttachment(f);
        added.push(meta);
      }
      setAttachments(prev => [...prev, ...added]);
    } catch (e) { setUploadErr((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const removeAttachment = async (id: string) => {
    try { await deleteAttachment(id); } catch { /* ignore */ }
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const save = () => {
    if (!beneficiary.trim() || !amount) return;
    onSave({
      date: payment?.date ?? new Date().toISOString(),
      beneficiary: beneficiary.trim(), beneficiaryType, supplierId: supplierId || undefined,
      category, amount: Number(amount), method, status,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      recurrence, document, notes: notes.trim() || undefined,
      deductible, fiscalCategory,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova uscita" : "Modifica uscita"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Beneficiario">
          <input value={beneficiary} onChange={e => setBeneficiary(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Tipo">
          <select value={beneficiaryType} onChange={e => setBeneficiaryType(e.target.value as SupplierPaymentBeneficiaryType)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {beneficiaryType === "fornitore" && (
          <Field label="Fornitore collegato">
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-3">
              <option value="">— Nessuno —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Categoria">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {PAYMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Importo (€)">
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Metodo di pagamento">
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={e => setStatus(e.target.value as SupplierPaymentStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(STATUS_LABEL) as SupplierPaymentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Scadenza">
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Ricorrenza">
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as SupplierPaymentRecurrence)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {RECS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Tipo documento">
          <select value={document} onChange={e => setDoc(e.target.value as SupplierPaymentDocument)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {DOC_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
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
            className="w-full bg-card border border-border rounded-lg p-3">
            {FISCAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label={`Carica allegato (${attachments.length}) — PDF, JPG, PNG`}>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/jpg" multiple
            onChange={e => onPickFiles(e.target.files)} className="text-xs" />
          {uploading && <p className="text-xs text-muted-foreground">Caricamento in corso...</p>}
          {uploadErr && <p className="text-xs text-danger">{uploadErr}</p>}
          <div className="space-y-1.5">
            {attachments.map(a => (
              <AttachmentRow key={a.id} att={a} onDelete={() => removeAttachment(a.id)} />
            ))}
            {attachments.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nessun allegato. Max 10MB per file.</p>
            )}
          </div>
        </div>
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

function AttachmentRow({ att, onDelete }: { att: PaymentAttachment; onDelete: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImg = att.type.startsWith("image/");
  useEffect(() => {
    let alive = true; let url: string | null = null;
    if (isImg) getAttachmentUrl(att.id).then(u => { if (alive) { url = u; setPreviewUrl(u); } });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [att.id, isImg]);
  const open = async () => { const u = await getAttachmentUrl(att.id); if (u) window.open(u, "_blank"); };
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
        <p className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(0)} KB</p>
      </div>
      <button onClick={open} className="text-xs text-brand-green font-semibold px-2">Apri</button>
      <button onClick={() => downloadAttachment(att)} className="text-xs text-brand-green font-semibold px-2">Scarica</button>
      <button onClick={onDelete} className="text-xs text-danger font-semibold px-2">×</button>
    </div>
  );
}
