// Centro WhatsApp: normalizzazione numeri + template messaggi + apertura chat
import type { Order, Client, Bundle, Delivery, Product, CasualSale } from "./data";

export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  // se inizia per +, mantieni
  if (digits.startsWith("+")) return digits.slice(1).replace(/\D/g, "");
  // se inizia per 00, sostituisci
  if (digits.startsWith("00")) return digits.slice(2);
  // se inizia per 3 (numero IT mobile), prepend 39
  if (/^3\d{8,10}$/.test(digits)) return "39" + digits;
  // se inizia per 39, ok
  if (digits.startsWith("39")) return digits;
  return digits;
}

export function whatsappUrl(phone: string, message: string): string {
  const n = normalizePhone(phone);
  const text = encodeURIComponent(message);
  if (!n) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${n}?text=${text}`;
}

export function openWhatsApp(phone: string, message: string) {
  if (typeof window !== "undefined") {
    window.open(whatsappUrl(phone, message), "_blank", "noopener,noreferrer");
  }
}

export function telUrl(phone: string): string {
  const n = normalizePhone(phone);
  return n ? `tel:+${n}` : "tel:";
}

export function mapsUrl(address: string): string {
  const a = (address || "").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
}

export function openMaps(address: string) {
  if (!address?.trim() || typeof window === "undefined") return;
  window.open(mapsUrl(address), "_blank", "noopener,noreferrer");
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" });
const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

export type TemplateId =
  | "conferma_ordine"
  | "promemoria_ritiro"
  | "ordine_pronto"
  | "consegna_in_arrivo"
  | "promo_bundle"
  | "cliente_inattivo"
  | "premio_disponibile"
  | "ringraziamento"
  | "libero";

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  conferma_ordine: "Conferma ordine",
  promemoria_ritiro: "Promemoria ritiro",
  ordine_pronto: "Ordine pronto",
  consegna_in_arrivo: "Consegna in arrivo",
  promo_bundle: "Promo bundle",
  cliente_inattivo: "Cliente inattivo",
  premio_disponibile: "Premio fedeltà",
  ringraziamento: "Ringraziamento",
  libero: "Messaggio libero",
};

export interface MessageContext {
  client?: Client;
  order?: Order;
  bundle?: Bundle;
  delivery?: Delivery;
  productNames?: string[];
  custom?: string;
}

export function buildMessage(template: TemplateId, ctx: MessageContext): string {
  const nome = ctx.client?.name?.split(" ")[0] ?? "";
  const prodList = ctx.productNames?.length ? ctx.productNames.join(", ") : "[PRODOTTI]";
  const isDomicilio = ctx.order?.delivery === "domicilio";
  const modo = isDomicilio ? "che le consegneremo a domicilio" : "da ritirare in negozio";
  switch (template) {
    case "conferma_ordine":
      return `Buongiorno${nome ? " " + nome : ""},\nle confermiamo il suo ordine di ${prodList} ${modo} il giorno ${ctx.order ? formatDateLong(ctx.order.pickupDate) : "[X]"} alle ore ${ctx.order ? formatTime(ctx.order.pickupDate) : "[Y]"}.${ctx.order ? `\n\nTotale: ${eur(ctx.order.total)}` : ""}\n\nGrazie,\nCaseificio Sciorio dal 1947`;
    case "promemoria_ritiro": {
      const ora = ctx.order ? formatTime(ctx.order.pickupDate) : "[X]";
      return `Buongiorno ${nome || "[NOME]"}, le ricordiamo il ritiro del suo ordine di ${prodList} dalla fascia oraria ${ora} di oggi.\n\nA presto in caseificio,\nCaseificio Sciorio`;
    }
    case "ordine_pronto":
      return `Buongiorno${nome ? " " + nome : ""},\nil suo ordine di ${prodList} è pronto e l'aspetta in caseificio${ctx.order ? ` (ritiro previsto ${formatTime(ctx.order.pickupDate)})` : ""}.\n\nA presto,\nCaseificio Sciorio`;
    case "consegna_in_arrivo":
      return `Buongiorno${nome ? " " + nome : ""},\nla sua consegna di ${prodList} è in arrivo${ctx.delivery ? ` nella fascia ${ctx.delivery.timeSlot}` : ""}.\n\nCi vediamo a breve!\nCaseificio Sciorio`;
    case "promo_bundle":
      return ctx.bundle
        ? `Buongiorno${nome ? " " + nome : ""}, abbiamo una proposta / box in offerta.\n\n${ctx.bundle.name}\n• ${ctx.bundle.ingredients.join("\n• ")}\nPrezzo: ${eur(ctx.bundle.offerPrice ?? ctx.bundle.fullPrice)}${ctx.bundle.offerPrice ? ` (anziché ${eur(ctx.bundle.fullPrice)})` : ""}\n\nSe ne vuole uno anche lei ci scriva pure, glielo mettiamo da parte.\n\nCaseificio Sciorio dal 1947`
        : `Buongiorno${nome ? " " + nome : ""}, abbiamo una proposta / box in offerta.\n\n[DETTAGLI BUNDLE]\n\nSe ne vuole uno anche lei ci scriva pure, glielo mettiamo da parte.\n\nCaseificio Sciorio dal 1947`;
    case "cliente_inattivo":
      return `Buongiorno ${nome || "[NOME]"}, è da un po' che non ci vediamo.\n\nSe passa a trovarci le riserviamo una piccola sorpresa.\n\n[DETTAGLI OFFERTA]\n\nA presto,\nCaseificio Sciorio`;
    case "premio_disponibile":
      return `${nome ? nome + ", complimenti" : "Complimenti"}! Ha completato la cartolina fedeltà: 1kg di mozzarella di bufala in omaggio sul suo prossimo ritiro.\nLa aspettiamo,\nCaseificio Sciorio`;
    case "ringraziamento":
      return `Grazie ${nome || "di cuore"} per il suo acquisto!${ctx.order ? `\nLe auguriamo di gustare al meglio i prodotti scelti.` : ""}\nA presto in caseificio,\nCaseificio Sciorio dal 1947`;
    case "libero":
      return ctx.custom ?? "";
  }
}

export function productName(p?: Product): string {
  return p?.name ?? "";
}

// ===== Export operativi rapidi (testo copiabile) =====
const dt = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
const tm = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const isSameDay = (iso: string, day: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};

export function buildOrdersTodayText(orders: Order[], clients: Client[], products: Product[], day = new Date()): string {
  const list = orders
    .filter((o) => isSameDay(o.pickupDate, day) && o.status !== "annullato")
    .sort((a, b) => +new Date(a.pickupDate) - +new Date(b.pickupDate));
  const header = `ORDINI ${day.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}\n${list.length} ordini\n`;
  if (!list.length) return header + "\nNessun ordine.";
  const lines = list.map((o) => {
    const c = clients.find((x) => x.id === o.clientId);
    const items = o.items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      return `  · ${p?.name ?? i.productId} x${i.qty}${p?.unit === "kg" ? "kg" : ""}`;
    }).join("\n");
    return `${tm(o.pickupDate)} — ${c?.name ?? "—"} (${c?.phone ?? "—"}) — ${eur(o.total)} [${o.status}]\n${items}${o.notes ? `\n  Note: ${o.notes}` : ""}`;
  });
  return header + "\n" + lines.join("\n\n");
}

export function buildDeliveriesTodayText(deliveries: Delivery[], clients: Client[], orders: Order[], day = new Date()): string {
  const list = deliveries
    .filter((d) => isSameDay(d.date, day) && d.status !== "annullata")
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  const header = `CONSEGNE ${day.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}\n${list.length} consegne\n`;
  if (!list.length) return header + "\nNessuna consegna.";
  const lines = list.map((d) => {
    const c = clients.find((x) => x.id === d.clientId);
    const o = d.orderId ? orders.find((o) => o.id === d.orderId) : null;
    return `${d.timeSlot} — ${c?.name ?? "—"} (${c?.phone ?? "—"})\n  ${d.address}${o ? `\n  Totale: ${eur(o.total)}` : ""}${d.notes ? `\n  Note: ${d.notes}` : ""}`;
  });
  return header + "\n" + lines.join("\n\n");
}

export function buildRecoverableText(clients: Client[]): string {
  const header = `CLIENTI DA RECUPERARE — ${clients.length}\n`;
  if (!clients.length) return header + "\nNessun cliente da recuperare.";
  const lines = clients.map((c) => `· ${c.name} — ${c.phone || "—"}${c.lastOrder ? ` — ultimo ${dt(c.lastOrder)}` : ""}`);
  return header + "\n" + lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// silenzia type non usato
export type _CasualSale = CasualSale;

