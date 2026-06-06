import type { Client, Product, ProductCategory } from "./data";

/* ============ CSV light parser ============ */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === "," || c === ";" || c === "\t") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(c => c.trim().length));
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/* ============ Clients ============ */
export type ParsedClient = { name: string; phone: string };

export function parseClientsText(text: string): ParsedClient[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const out: ParsedClient[] = [];
  // CSV path: prima riga con header che contiene "nome"
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const looksCsv = /[,;\t]/.test(firstLine);
  if (looksCsv) {
    const rows = parseCsv(trimmed);
    if (rows.length) {
      const header = rows[0].map(h => norm(h));
      const hasHeader = header.some(h => /nome|name|cognome|telefono|phone|cell/.test(h));
      const startIdx = hasHeader ? 1 : 0;
      const idxName = hasHeader ? header.findIndex(h => /^nome|name/.test(h)) : -1;
      const idxSurname = hasHeader ? header.findIndex(h => /cognome|surname|last/.test(h)) : -1;
      const idxPhone = hasHeader ? header.findIndex(h => /tel|phone|cell|mobile/.test(h)) : -1;
      for (let r = startIdx; r < rows.length; r++) {
        const cols = rows[r];
        let name = "", phone = "";
        if (hasHeader) {
          const n = idxName >= 0 ? (cols[idxName] ?? "").trim() : "";
          const s = idxSurname >= 0 ? (cols[idxSurname] ?? "").trim() : "";
          name = [n, s].filter(Boolean).join(" ").trim();
          phone = (idxPhone >= 0 ? (cols[idxPhone] ?? "").trim() : "").replace(/[^\d+]/g, "");
        } else {
          // Euristica: cella con cifre => phone, le altre => name
          const phoneCol = cols.find(c => /\+?\d[\d\s.\-]{5,}/.test(c)) ?? "";
          phone = phoneCol.replace(/[^\d+]/g, "");
          name = cols.filter(c => c !== phoneCol).join(" ").trim();
        }
        if (name) out.push({ name, phone });
      }
      return dedupClients(out);
    }
  }
  // Riga per riga: "Nome Cognome  3331234567"
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const phoneMatch = line.match(/\+?\d[\d\s.\-]{5,}\d/);
    const phone = phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, "") : "";
    const name = (phoneMatch ? line.replace(phoneMatch[0], "") : line)
      .replace(/[,;|\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (name) out.push({ name, phone });
  }
  return dedupClients(out);
}

function dedupClients(arr: ParsedClient[]): ParsedClient[] {
  const seen = new Set<string>();
  return arr.filter(c => {
    const k = norm(c.name) + "|" + c.phone;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function toClient(p: ParsedClient): Omit<Client, "id"> {
  return {
    name: p.name,
    phone: p.phone,
    segment: "nuovi",
    stamps: 0,
    loyaltyHistory: [],
  };
}

/* ============ Products ============ */
export type ParsedProduct = {
  name: string;
  price: number;
  cost?: number;
  category?: string;
  unit?: "kg" | "pz";
};

const KNOWN_CATEGORIES: ProductCategory[] = [
  "Freschi di Bufala","Freschi di Pecora","Formaggi Stagionati","Burro e Latticini",
  "Salumi","Dispensa","Pane","Latte","Bevande","Vini","Taralli","Pasta",
];

function matchCategory(s: string): ProductCategory {
  const n = norm(s);
  const found = KNOWN_CATEGORIES.find(c => norm(c) === n || norm(c).includes(n) || n.includes(norm(c)));
  return found ?? "Dispensa";
}

function parsePrice(s: string): number | null {
  if (!s) return null;
  const m = String(s).replace(/[€\s]/g, "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseUnit(s: string): "kg" | "pz" | undefined {
  const n = norm(s);
  if (/\bkg\b|\/kg|chilo/.test(n)) return "kg";
  if (/\bpz\b|\bpezzo|\bcad\b|\bunit/.test(n)) return "pz";
  return undefined;
}

export function parseProductsText(text: string): ParsedProduct[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const out: ParsedProduct[] = [];
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const looksCsv = /[,;\t]/.test(firstLine);

  if (looksCsv) {
    const rows = parseCsv(trimmed);
    if (rows.length) {
      const header = rows[0].map(h => norm(h));
      const hasHeader = header.some(h => /nome|prodotto|name|prezzo|price|categ|costo|cost|unit/.test(h));
      const idx = (re: RegExp) => hasHeader ? header.findIndex(h => re.test(h)) : -1;
      const iName = idx(/nome|prodotto|name|descriz/);
      const iPrice = idx(/prezzo|price|vendita/);
      const iCost = idx(/costo|cost|acquisto/);
      const iCat = idx(/categ|reparto|tipo/);
      const iUnit = idx(/unit|um\b|misura/);
      const start = hasHeader ? 1 : 0;
      for (let r = start; r < rows.length; r++) {
        const cols = rows[r];
        const name = (iName >= 0 ? cols[iName] : cols[0] ?? "").trim();
        const priceStr = iPrice >= 0 ? cols[iPrice] : cols[1] ?? "";
        const price = parsePrice(priceStr) ?? 0;
        if (!name) continue;
        const cost = iCost >= 0 ? (parsePrice(cols[iCost]) ?? undefined) : undefined;
        const category = iCat >= 0 ? cols[iCat]?.trim() : undefined;
        const unit = iUnit >= 0 ? parseUnit(cols[iUnit] ?? "") : parseUnit(name);
        out.push({ name, price, cost: cost ?? undefined, category, unit });
      }
      return dedupProducts(out);
    }
  }

  // Riga per riga: "Nome prodotto ... 12,50"
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const priceMatch = line.match(/(\d+(?:[.,]\d{1,2}))(?:\s*€)?\s*(?:\/?(kg|pz))?\s*$/i);
    if (!priceMatch) {
      // Fallback: prezzo in mezzo
      const inner = line.match(/(\d+[.,]\d{1,2})\s*€?/);
      if (!inner) continue;
      const price = parsePrice(inner[1]) ?? 0;
      const name = line.replace(inner[0], "").replace(/[-|;,]\s*$/, "").trim();
      if (name) out.push({ name, price, unit: parseUnit(line) });
      continue;
    }
    const price = parsePrice(priceMatch[1]) ?? 0;
    const unit = (priceMatch[2]?.toLowerCase() as "kg" | "pz" | undefined) ?? parseUnit(line);
    const name = line.slice(0, line.length - priceMatch[0].length).replace(/[-|;,€\s]+$/, "").trim();
    if (name) out.push({ name, price, unit });
  }
  return dedupProducts(out);
}

function dedupProducts(arr: ParsedProduct[]): ParsedProduct[] {
  const seen = new Set<string>();
  return arr.filter(p => {
    const k = norm(p.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function toProduct(p: ParsedProduct): Omit<Product, "id"> {
  return {
    name: p.name,
    category: matchCategory(p.category ?? ""),
    cost: p.cost ?? null,
    price: p.price ?? 0,
    unit: p.unit ?? "pz",
    active: true,
    available: true,
    seasonal: false,
    magnet: false,
  };
}

/* ============ PDF text extraction (lazy) ============ */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  try {
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // fallback: disable worker
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, string[]>();
    for (const it of content.items as any[]) {
      const y = Math.round(it.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push(it.str);
    }
    const lines = Array.from(byY.entries()).sort((a, b) => b[0] - a[0]).map(([, arr]) => arr.join(" "));
    out += lines.join("\n") + "\n";
  }
  return out;
}