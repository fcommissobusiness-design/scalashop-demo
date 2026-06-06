import { useState, useRef, useEffect } from "react";
import { Field } from "@/components/AppShell";
import { putAttachment, getAttachmentUrl, deleteAttachment, downloadAttachment } from "@/lib/attachments";
import type { PaymentAttachment } from "@/lib/data";

export function InvoiceField({
  hasInvoice, onHasInvoiceChange, invoice, onInvoiceChange,
}: {
  hasInvoice: boolean;
  onHasInvoiceChange: (v: boolean) => void;
  invoice?: PaymentAttachment;
  onInvoiceChange: (a: PaymentAttachment | undefined) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = async (files: FileList | null) => {
    const f = files?.[0]; if (!f) return;
    setErr(null);
    if (f.size > 10 * 1024 * 1024) { setErr("File > 10MB"); return; }
    if (!/pdf|jpeg|jpg|png/i.test(f.type)) { setErr("Solo PDF, JPG, PNG"); return; }
    setBusy(true);
    try {
      if (invoice) await deleteAttachment(invoice.id).catch(() => {});
      const meta = await putAttachment(f);
      onInvoiceChange(meta);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const remove = async () => {
    if (invoice) { try { await deleteAttachment(invoice.id); } catch {} }
    onInvoiceChange(undefined);
  };

  return (
    <div className="space-y-2">
      <Field label="Presenza fattura">
        <select
          value={hasInvoice ? "si" : "no"}
          onChange={(e) => {
            const v = e.target.value === "si";
            onHasInvoiceChange(v);
            if (!v) remove();
          }}
          className="w-full bg-card border border-border rounded-lg p-3">
          <option value="no">No</option>
          <option value="si">Sì</option>
        </select>
      </Field>
      {hasInvoice && (
        <Field label="Carica fattura (PDF, JPG, PNG)">
          <input ref={fileRef} type="file"
            accept="application/pdf,image/jpeg,image/png,image/jpg"
            onChange={(e) => onPick(e.target.files)} className="text-xs" />
          {busy && <p className="text-xs text-muted-foreground mt-1">Caricamento...</p>}
          {err && <p className="text-xs text-danger mt-1">{err}</p>}
          {invoice && <InvoiceRow att={invoice} onDelete={remove} />}
        </Field>
      )}
    </div>
  );
}

export function InvoiceRow({ att, onDelete }: { att: PaymentAttachment; onDelete?: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImg = att.type.startsWith("image/");
  useEffect(() => {
    let alive = true; let url: string | null = null;
    if (isImg) getAttachmentUrl(att.id).then(u => { if (alive) { url = u; setPreviewUrl(u); } });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [att.id, isImg]);
  const open = async () => { const u = await getAttachmentUrl(att.id); if (u) window.open(u, "_blank"); };
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-2 mt-2">
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
      <button type="button" onClick={open} className="text-xs text-brand-green font-semibold px-2">Apri</button>
      <button type="button" onClick={() => downloadAttachment(att)} className="text-xs text-brand-green font-semibold px-2">Scarica</button>
      {onDelete && <button type="button" onClick={onDelete} className="text-xs text-danger font-semibold px-2">×</button>}
    </div>
  );
}
