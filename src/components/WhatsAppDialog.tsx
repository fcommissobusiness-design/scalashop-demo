import { useState } from "react";
import { Sheet, Field } from "./AppShell";
import {
  buildMessage, openWhatsApp, normalizePhone,
  TEMPLATE_LABEL, type TemplateId, type MessageContext,
} from "@/lib/whatsapp";

interface Props {
  open: boolean;
  onClose: () => void;
  phone: string;
  context: MessageContext;
  defaultTemplate?: TemplateId;
  templates?: TemplateId[];
  title?: string;
}

const ALL: TemplateId[] = [
  "conferma_ordine", "promemoria_ritiro", "ordine_pronto",
  "consegna_in_arrivo", "promo_bundle", "cliente_inattivo",
  "premio_disponibile", "ringraziamento", "libero",
];

export function WhatsAppDialog({ open, onClose, phone, context, defaultTemplate, templates = ALL, title = "Messaggio WhatsApp" }: Props) {
  const [tpl, setTpl] = useState<TemplateId>(defaultTemplate ?? templates[0]);
  const [custom, setCustom] = useState("");
  const text = tpl === "libero" ? custom : buildMessage(tpl, context);
  const phoneOk = normalizePhone(phone).length >= 10;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <Sheet
      open={open} onClose={onClose} title={title}
      footer={
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 bg-card border border-border rounded-xl py-3 text-sm font-semibold text-brand-green">Copia testo</button>
          <button
            onClick={() => openWhatsApp(phone, text)}
            disabled={!text.trim()}
            className="flex-[2] bg-success text-white rounded-xl py-3 font-semibold disabled:opacity-40"
          >
            {phoneOk ? "Apri chat WhatsApp" : "Apri WhatsApp"}
          </button>
        </div>
      }
    >
      <Field label="Template">
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button key={t} onClick={() => setTpl(t)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold ${tpl === t ? "bg-brand-green text-brand-cream" : "bg-card border border-border text-foreground/70"}`}>
              {TEMPLATE_LABEL[t]}
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Numero (${phoneOk ? "ok" : "non valido / vuoto"})`}>
        <input value={phone} readOnly className="w-full bg-card border border-border rounded-lg p-2.5 text-sm text-muted-foreground" />
      </Field>

      <Field label="Anteprima messaggio">
        {tpl === "libero" ? (
          <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={8}
            placeholder="Scrivi il messaggio..."
            className="w-full bg-card border border-border rounded-lg p-3 text-sm whitespace-pre-wrap" />
        ) : (
          <div className="bg-card border border-border rounded-lg p-3 text-sm whitespace-pre-wrap min-h-[200px]">{text}</div>
        )}
      </Field>
    </Sheet>
  );
}
