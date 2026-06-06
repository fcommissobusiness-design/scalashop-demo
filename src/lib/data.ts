// Seed data and types for Sciorio HQ
export type Segment = "top" | "abituali" | "occasionali" | "nuovi" | "inattivi";
export type ProductCategory =
  | "Freschi di Bufala"
  | "Freschi di Pecora"
  | "Formaggi Stagionati"
  | "Burro e Latticini"
  | "Salumi"
  | "Dispensa"
  | "Pane"
  | "Latte"
  | "Bevande"
  | "Vini"
  | "Taralli"
  | "Pasta";

export interface PriceChange {
  date: string; // ISO
  cost: number | null;
  price: number;
}

export type Allergen =
  | "latte" | "glutine" | "uova" | "frutta_a_guscio" | "soia"
  | "pesce" | "crostacei" | "molluschi" | "sedano" | "senape"
  | "sesamo" | "solfiti" | "lupini" | "arachidi";

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  latte: "Latte", glutine: "Glutine", uova: "Uova",
  frutta_a_guscio: "Frutta a guscio", soia: "Soia",
  pesce: "Pesce", crostacei: "Crostacei", molluschi: "Molluschi",
  sedano: "Sedano", senape: "Senape", sesamo: "Sesamo",
  solfiti: "Solfiti", lupini: "Lupini", arachidi: "Arachidi",
};

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  cost: number | null;
  price: number;
  unit: "kg" | "pz";
  active: boolean;
  badge?: "DOP" | "IGP" | "DOC" | "DOCG" | "BIO";
  notes?: string;
  available?: boolean;     // disponibilità reale a scaffale
  seasonal?: boolean;
  magnet?: boolean;        // prodotto magnete / civetta
  priceHistory?: PriceChange[];
  // magazzino
  stock?: number;
  stockMin?: number;
  supplierId?: string;
  lastRestock?: string;
  // freschi / invenduto
  fresh?: boolean;                         // prodotto fresco/deperibile
  shelfLifeDays?: number;                  // durata stimata in giorni
  perishability?: "bassa" | "media" | "alta";
  trackUnsold?: boolean;                   // gestire invenduto sì/no
  // scheda food (EU 1169/2011 light)
  allergens?: Allergen[];
  ingredients?: string;
  origin?: string;          // es. "Latte di bufala Campania"
  conservation?: string;    // es. "Conservare a 0-4 °C"
  avgWeightKg?: number;     // peso medio per prodotti a peso
}

export interface LoyaltyEvent {
  date: string; // ISO
  type: "stamp" | "reward" | "reset" | "manual" | "segment" | "note" | "whatsapp";
  delta?: number;
  note?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  phones?: string[]; // numeri aggiuntivi opzionali
  addresses?: string[]; // indirizzi aggiuntivi salvati (storico)
  segment: Segment;
  segmentManual?: boolean;     // se true, non sovrascrivere segmento auto
  lastOrder?: string;
  firstOrder?: string;
  stamps: number;
  loyaltyHistory?: LoyaltyEvent[];
  notes?: string;
  preferredProducts?: string[]; // productId
  preferredTimeSlot?: string;   // es. "Mattina presto"
  deliveryZone?: string;
  tags?: string[];
}


export interface OrderItem {
  productId: string;
  qty: number;
  // Peso variabile (kg) per prodotti venduti a peso. Se presente, qty = numero pezzi/colli.
  // Se assente per prodotti kg, si interpreta qty stesso come kg (retrocompatibile).
  weightKg?: number;
  unitPriceOverride?: number; // override €/unità per sfridi/sconti spot
  lotId?: string;             // lotto usato per tracciabilità leggera
  // Tipo riga: assente = "product" (retro-compatibile).
  kind?: "product" | "bundle" | "custom";
  // Per kind="bundle": id del bundle catalogato.
  bundleId?: string;
  // Per kind="custom": vendita personalizzata (es. "Mozz. metà bocconcini metà trancio").
  customName?: string;
  customPrice?: number;       // €/unità per riga custom
  customCost?: number;        // costo unitario opzionale (per margine)
}

export type OrderStatus = "in_attesa" | "pronto" | "ritirato" | "da_consegnare" | "consegnato" | "annullato";
export type OrderSource = "negozio" | "whatsapp" | "telefono" | "consegna" | "sito" | "b2b" | "altro";
export type DeliveryMode = "ritiro" | "domicilio";

export interface OrderEvent {
  date: string; // ISO
  type: "creato" | "modificato" | "pronto" | "ritirato" | "annullato" | "consegna";
  note?: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientNameInput?: string;    // fallback nome digitato (sempre salvato)
  label?: string;
  items: OrderItem[];
  pickupDate: string; // ISO datetime
  status: OrderStatus;
  notes?: string;
  total: number;
  createdAt: string;
  source?: OrderSource;
  delivery?: DeliveryMode;
  address?: string;            // indirizzo consegna (se delivery=domicilio)
  payment?: DeliveryPayment;   // stato pagamento (se delivery=domicilio)
  paymentMethod?: PaymentMethod;
  timeline?: OrderEvent[];
  deliveryId?: string;
  hasInvoice?: boolean;
  invoice?: PaymentAttachment;
}



export interface Bundle {
  id: string;
  name: string;
  ingredients: string[];
  fullPrice: number;
  offerPrice: number | null;
  estimatedCost?: number;
  availability: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  channel?: string;          // es. "WhatsApp broadcast", "Vetrina"
  targetSegment?: Segment;
  goal?: string;             // es. "Riattivare inattivi"
}

export interface CasualSale {
  id: string;
  date: string; // ISO datetime
  items: OrderItem[];
  total: number;
  clientId?: string;
  clientNameInput?: string;
  notes?: string;
  source?: OrderSource;
  delivery?: DeliveryMode;
  paymentMethod?: PaymentMethod;
  hasInvoice?: boolean;
  invoice?: PaymentAttachment;
}

export type DeliveryStatus = "da_preparare" | "in_consegna" | "consegnata" | "annullata";
export type DeliveryPayment = "da_pagare" | "pagato_anticipo" | "pagato_consegna";

export interface Delivery {
  id: string;
  clientId: string;
  clientNameInput?: string;    // fallback nome digitato
  address: string;
  timeSlot: string; // es. "10:00-12:00"
  date: string;     // ISO date
  status: DeliveryStatus;
  payment: DeliveryPayment;
  orderId?: string;
  notes?: string;
  createdAt: string;
}


// ============= NUOVE ENTITÀ v4 =============

export type ProductionStatus = "da_preparare" | "preparato" | "completato";
export interface Production {
  id: string;
  date: string;        // ISO datetime (giorno preparazione)
  productId: string;
  qtyPlanned: number;
  qtyActual?: number;
  orderIds?: string[];
  notes?: string;
  status: ProductionStatus;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;     // es. "Latticini", "Salumi", "Pane"
  phone?: string;
  contactName?: string;
  productIds?: string[];
  notes?: string;
  lastOrderDate?: string;
}

export type CashType = "entrata" | "uscita";
export type PaymentMethod = "contanti" | "pos" | "bonifico" | "carta" | "altro";
export type CashRefType = "order" | "delivery" | "casual" | "payment" | "manual";
export interface CashEntry {
  id: string;
  date: string;          // ISO
  type: CashType;
  category: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
  refType?: CashRefType;
  refId?: string;
}

export type B2BStatus = "prospect" | "attivo" | "sospeso";
export interface B2BHistoryEntry { date: string; total: number; note?: string; }
export interface B2BClient {
  id: string;
  name: string;            // nome attività
  contactName?: string;    // referente
  phone?: string;
  zone?: string;
  priceListId?: string;
  deliveryDays: string[];  // es. ["lun","gio"]
  status: B2BStatus;
  notes?: string;
  history: B2BHistoryEntry[];
}

export type SupplierPaymentStatus = "da_pagare" | "pagato" | "scaduto";
export type SupplierPaymentRecurrence = "una_tantum" | "settimanale" | "mensile" | "annuale";
export type SupplierPaymentBeneficiaryType = "fornitore" | "consulente" | "servizio" | "altro";
export type SupplierPaymentDocument = "fattura" | "ricevuta" | "preventivo" | "contratto" | "nessuno";
export interface PaymentAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: string;
}
export const FISCAL_CATEGORIES = [
  "Affitto", "Utenze", "Consulenze", "Commercialista", "Software",
  "Marketing", "Carburante", "Acquisti merci", "Altro",
] as const;
export type FiscalCategory = typeof FISCAL_CATEGORIES[number];

export interface SupplierPayment {
  id: string;
  date: string;            // ISO data registrazione
  beneficiary: string;
  beneficiaryType: SupplierPaymentBeneficiaryType;
  category: string;        // merce, affitto, utenze, commercialista, ecc
  amount: number;
  method: PaymentMethod;
  status: SupplierPaymentStatus;
  dueDate?: string;
  recurrence: SupplierPaymentRecurrence;
  notes?: string;
  document?: SupplierPaymentDocument;
  supplierId?: string;
  attachments?: PaymentAttachment[];
  deductible?: boolean;        // deducibile fiscalmente
  fiscalCategory?: FiscalCategory;
}

// ============= COSTI FISSI =============
export type FixedCostFrequency = "mensile" | "annuale" | "una_tantum";
export type FixedCostStatus = "attivo" | "inattivo";
export const FIXED_COST_CATEGORIES = [
  "affitto", "utenze", "personale", "consulenti", "marketing",
  "software", "assicurazioni", "commercialista", "altro",
] as const;
export type FixedCostCategory = typeof FIXED_COST_CATEGORIES[number];

export interface FixedCost {
  id: string;
  name: string;
  category: FixedCostCategory;
  amount: number;
  frequency: FixedCostFrequency;
  status: FixedCostStatus;
  startDate?: string;
  notes?: string;
}

export const SEED_FIXED_COSTS: FixedCost[] = [];

// ============= CESTINO (soft delete) =============
export type TrashKind =
  | "order" | "casualSale" | "delivery" | "bundle"
  | "supplier" | "supplierPayment" | "fixedCost"
  | "client" | "b2bClient" | "product";

export interface TrashEntry {
  id: string;          // id univoco del cestino
  kind: TrashKind;
  refId: string;       // id originale dell'elemento
  label: string;       // descrizione leggibile (es. "Ordine Mario Rossi - 12/06")
  deletedAt: string;   // ISO
  data: unknown;       // snapshot completo per ripristino
}

export const SEED_TRASH: TrashEntry[] = [];

export const CASH_CATEGORIES = [
  "Vendita banco", "Vendita ordine", "Vendita consegna", "B2B", "Altro",
  "Merce", "Utenze", "Affitto", "Personale", "Manutenzione", "Trasporti",
  "Software", "Marketing", "Tasse", "Consulenza", "Cancelleria",
] as const;

export const PAYMENT_CATEGORIES = [
  "Merce", "Affitto", "Utenze", "Commercialista", "Consulenza marketing",
  "Personale", "Manutenzione", "Trasporti", "Software", "Tasse", "Altro",
] as const;

export const SEGMENT_META: Record<Segment, { label: string; mode: string; color: string }> = {
  top:         { label: "Top Fidelizzati", mode: "messaggio manuale con nome", color: "bg-brand-gold text-white" },
  abituali:    { label: "Abituali",        mode: "messaggio manuale con nome", color: "bg-success text-white" },
  occasionali: { label: "Occasionali",     mode: "broadcast",                  color: "bg-blue-600 text-white" },
  nuovi:       { label: "Nuovi",           mode: "broadcast + ricotta omaggio", color: "bg-teal-600 text-white" },
  inattivi:    { label: "Inattivi",        mode: "broadcast con offerta forte", color: "bg-neutral-700 text-white" },
};

const p = (
  name: string,
  category: ProductCategory,
  cost: number | null,
  price: number,
  unit: "kg" | "pz",
  active: boolean,
  badge?: Product["badge"],
  notes?: string,
  available: boolean = true,
): Product => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  name, category, cost, price, unit, active, badge, notes,
  available, seasonal: false, magnet: false,
});

const fresh = (p: Product, shelfLifeDays: number, perishability: "bassa" | "media" | "alta" = "alta"): Product =>
  ({ ...p, fresh: true, shelfLifeDays, perishability, trackUnsold: true });

// Listino aggiornato Maggio 2026
export const SEED_PRODUCTS: Product[] = [
  // 01 — Pane e Panificati
  p("Pane Casareccio D'Alise", "Pane", 2.00, 3.00, "kg", true),
  p("Panini D'Alise", "Pane", 2.50, 3.50, "kg", true),
  p("Panini Olio D'Alise", "Pane", 3.00, 3.50, "kg", true, undefined, "Attivo solo weekend"),

  // 02 — Freschi di Bufala
  fresh(p("Mozzarella di Bufala Campana DOP", "Freschi di Bufala", 10.50, 14.50, "kg", true, "DOP"), 2),
  fresh(p("Mozzarella Senza Lattosio DOP", "Freschi di Bufala", 11.50, 16.50, "kg", true, "DOP"), 2),
  fresh(p("Ricotta di Bufala", "Freschi di Bufala", 1.00, 1.50, "pz", true), 3),
  fresh(p("Burrata di Bufala Campana", "Freschi di Bufala", 10.50, 15.00, "kg", true), 2),

  // 03 — Freschi di Pecora
  fresh(p("Ricotta di Pecora", "Freschi di Pecora", 0.80, 1.20, "pz", true), 3),
  fresh(p("Marzolina di Pecora Bianca", "Freschi di Pecora", 1.20, 1.80, "pz", true), 5, "media"),
  fresh(p("Marzolina di Pecora Condita", "Freschi di Pecora", 1.20, 2.00, "pz", true), 5, "media"),
  p("Marzolina Sottovuoto", "Freschi di Pecora", 2.60, 4.20, "pz", true, undefined, "Daniele valuta riduzione a 3,20€"),

  // 04 — Formaggi Stagionati
  p("Caciocavallo Dolce", "Formaggi Stagionati", 14.50, 17.00, "kg", true, undefined, "Da aggiornare a 21,00€"),
  p("Caciocavallo Affumicato", "Formaggi Stagionati", 14.50, 17.00, "kg", true, undefined, "Da aggiornare a 21,00€"),
  p("Caciotta Bianca", "Formaggi Stagionati", 16.00, 18.00, "kg", false),
  p("Caciotta Mediterranea", "Formaggi Stagionati", 16.00, 21.50, "kg", true),
  p("Provolone del Monaco DOP", "Formaggi Stagionati", 23.29, 27.99, "kg", true, "DOP", "Da aggiornare a 34,00€"),
  p("Parmigiano Reggiano DOP", "Formaggi Stagionati", 18.60, 24.99, "kg", true, "DOP"),
  p("Asiago DOP", "Formaggi Stagionati", 9.90, 13.99, "kg", true, "DOP", "Decisione Daniele"),
  p("Pecorino Romano DOP", "Formaggi Stagionati", 14.90, 18.99, "kg", true, "DOP", "Da aggiornare a 22,00€"),
  p("Auricchio Giovane 1kg", "Formaggi Stagionati", 11.79, 14.99, "kg", true),
  p("Auricchio Semipiccante", "Formaggi Stagionati", 15.20, 0, "kg", true, undefined, "Esaurito — prezzo n.d.", false),
  p("Pecorino Sardo Dolce DOP", "Formaggi Stagionati", 14.70, 18.99, "kg", false, "DOP"),
  p("Scamorza Affumicata di Bufala", "Formaggi Stagionati", 14.50, 17.00, "kg", true, undefined, "Stesso prezzo Caciocavallo"),
  p("Brigante Pinna", "Formaggi Stagionati", null, 0, "kg", false, undefined, "Non attivo — costo e prezzo n.d."),

  // 05 — Burro e Latticini
  p("Burro di Bufala Gentile", "Burro e Latticini", 2.50, 3.50, "pz", false, undefined, "In programma"),
  p("Yogurt di Bufala Gentile", "Burro e Latticini", 1.30, 2.30, "pz", false, undefined, "Da riattivare a breve"),

  // 06 — Salumi
  p("Cotto Gran Tenerone", "Salumi", 9.60, 16.99, "kg", true),
  p("Prosciutto Crudo di Parma DOP Cavazzuti", "Salumi", 17.10, 24.99, "kg", true, "DOP"),
  p("Crudo Lui Renzini", "Salumi", 14.63, 19.99, "kg", true, undefined, "Da aggiornare a 22,00€"),
  p("Mortadella", "Salumi", 8.45, 13.99, "kg", true, undefined, "Da aggiornare a 14,50€"),
  p("Guanciale del Norcino Renzini", "Salumi", 10.96, 14.99, "kg", true, undefined, "Da aggiornare a 16,50€"),
  p("Lonza di Norcia Renzini", "Salumi", 11.70, 18.99, "kg", true, undefined, "Da aggiornare a 19,99€"),
  p("Salame Napoli", "Salumi", 11.35, 15.99, "kg", true),
  p("Salame Milanese", "Salumi", 11.85, 15.99, "kg", true),
  p("Salame Ungherese", "Salumi", 11.85, 15.99, "kg", true),
  p("Pancetta Tonda", "Salumi", 11.00, 16.99, "kg", true, undefined, "Da aggiornare a 17,50€"),
  p("Pancetta Tesa", "Salumi", 8.80, 14.99, "kg", true),
  p("Speck", "Salumi", 9.40, 15.99, "kg", true),
  p("Salsiccia Paesana SV Tucciarone", "Salumi", 16.00, 19.99, "kg", true),
  p("Fesa di Tacchino", "Salumi", 10.50, 0, "kg", false, undefined, "Non attivo — prezzo n.d."),
  p("Salame Strolghino Cavazzuti", "Salumi", 2.50, 3.50, "pz", false),

  // 07 — Dispensa e Olive
  p("Zucchine Grigliate Casa Marrazzo", "Dispensa", 7.35, 9.30, "pz", true),
  p("Melanzane a Filetti Casa Marrazzo", "Dispensa", 7.35, 6.90, "pz", true, undefined, "SOTTO COSTO — correggere urgente"),
  p("Carciofi Grigliati Casa Marrazzo", "Dispensa", 10.75, 11.80, "pz", true, undefined, "Da portare a 15,00€ o rimuovere"),
  p("Pomodori Secchi Sott'Olio Casa Marrazzo", "Dispensa", null, 6.90, "pz", true, undefined, "Verificare costo urgente"),
  p("Peperoni Grigliati Sott'Olio Casa Marrazzo", "Dispensa", null, 6.90, "pz", true, undefined, "Verificare costo urgente"),
  p("Confettura Albicocche Casa Marrazzo", "Dispensa", null, 6.90, "pz", true, undefined, "Verificare costo"),
  p("Confettura Mele Annurche Casa Marrazzo", "Dispensa", null, 6.90, "pz", true, undefined, "Verificare costo"),
  p("Confettura Mandarini Casa Marrazzo", "Dispensa", null, 6.90, "pz", true, undefined, "Verificare costo"),
  p("Olive Nere di Gaeta DOP", "Dispensa", null, 6.99, "kg", false, "DOP", "Da riattivare priorità massima"),
  p("Olive Verdi Riviera di Gaeta", "Dispensa", null, 6.99, "kg", false),
  p("Olio EVO Lazio", "Dispensa", null, 0, "pz", true, undefined, "Esaurito — da reinserire al riordino", false),
  p("Miele Artigianale del Territorio", "Dispensa", null, 0, "pz", true, undefined, "Esaurito — da reinserire al riordino", false),
  p("Alici di Gaeta Sott'Olio", "Dispensa", null, 0, "pz", false, undefined, "Non disponibile — trovare fornitore", false),
  p("Nduja di Spilinga Artigianale", "Dispensa", null, 0, "pz", false, undefined, "Non disponibile — trovare fornitore", false),

  // 08 — Latte
  p("Latte Intero Latte Sano", "Latte", 1.91, 2.20, "pz", true, undefined, "Da aggiornare a 2,60€"),
  p("Latte Parzialmente Scremato Latte Sano", "Latte", 1.88, 2.20, "pz", true, undefined, "Da aggiornare a 2,60€"),
  p("Latte Alta Digeribilità Latte Sano", "Latte", 1.91, 2.40, "pz", true, undefined, "Da aggiornare a 2,60€"),

  // 09 — Bevande
  p("Acqua piccola Lete", "Bevande", 0.17, 1.00, "pz", true),
  p("Acqua piccola Sorgesana", "Bevande", 0.13, 1.00, "pz", true),
  p("Acque grandi Levissima e Ferrarelle", "Bevande", 0.30, 2.00, "pz", true, undefined, "Esaurite — da riordinare", false),
  p("Coca-Cola lattina", "Bevande", 0.50, 2.00, "pz", true),
  p("Fanta lattina", "Bevande", 0.49, 2.00, "pz", true),
  p("Sprite lattina", "Bevande", 0.49, 2.00, "pz", true),
  p("Estathe lattina", "Bevande", 0.55, 2.00, "pz", true),
  p("RedBull", "Bevande", 0.88, 3.00, "pz", true),
  p("Birra Nastro Azzurro 33cl", "Bevande", 0.61, 2.00, "pz", true),
  p("Birra Peroni 33cl", "Bevande", 0.54, 2.00, "pz", true),
  p("Prosecco Maschio", "Bevande", 1.57, 3.00, "pz", true, undefined, "In esaurimento — valutare riordino"),
  p("Succo Yoga 1lt", "Bevande", 0.95, 2.50, "pz", true, undefined, "In esaurimento — non riordinare"),
  p("Schweppes", "Bevande", null, 2.50, "pz", true, undefined, "In esaurimento — non riordinare"),
  p("Energade", "Bevande", 0.46, 2.50, "pz", true, undefined, "In esaurimento — non riordinare"),

  // 10 — Vini
  p("Aglianico Campania DOC", "Vini", null, 8.90, "pz", true, "DOC"),
  p("Fiano di Avellino DOCG", "Vini", null, 10.95, "pz", true, "DOCG"),
  p("Greco di Tufo DOCG", "Vini", null, 9.95, "pz", true, "DOCG"),
  p("Falanghina del Sannio DOC", "Vini", null, 9.00, "pz", true, "DOC"),
  p("Vino Greco", "Vini", null, 7.90, "pz", true, undefined, "Verificare rotazione"),
  p("Lacryma", "Vini", null, 8.00, "pz", true, undefined, "Verificare rotazione"),
  p("NTERRA", "Vini", null, 9.00, "pz", true, undefined, "Verificare rotazione"),
  p("HYRIA", "Vini", null, 9.00, "pz", true, undefined, "Verificare rotazione"),
  p("Chianti DOCG", "Vini", null, 6.50, "pz", true, "DOCG", "Esaurito — da riordinare", false),

  // 11 — Taralli e Prodotti da Forno Di Costanzo
  p("Tarallini Classici all'Olio", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini ai Cereali", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini Multi Cereali", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini al Peperoncino", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini al Pepe", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini al Finocchietto", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini alle Olive", "Taralli", 0.88, 3.20, "pz", true),
  p("Tarallini al Pistacchio", "Taralli", 1.82, 3.20, "pz", true, undefined, "Da portare a 3,90€"),
  p("Tarallini alla Strega", "Taralli", 1.82, 3.20, "pz", true, undefined, "Da portare a 3,90€"),
  p("Tarallini al Limone", "Taralli", 1.82, 3.20, "pz", true, undefined, "Da portare a 3,90€"),
  p("Caserecci", "Taralli", 1.92, 3.20, "pz", true, undefined, "Da portare a 3,90€"),
  p("Intrecciati al Finocchietto", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato"),
  p("Geniose Classiche", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato"),
  p("Crostini Friabili", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato"),
  p("Crostini Integrali", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato"),
  p("Grissini Piemontesi", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,50€"),
  p("Fresina Bianca", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,50€"),
  p("Fresina al Finocchietto", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,50€"),
  p("Fresina ai Cereali", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,50€"),
  p("Fresina alla Curcuma", "Taralli", 1.55, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,50€"),
  p("Scaldatelle al Finocchio", "Taralli", 2.10, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,90€"),
  p("Naspro di Castellammare", "Taralli", 2.40, 3.20, "pz", true, undefined, "Da verificare stato — da portare a 3,90€"),

  // 12 — Pasta
  p("Pasta Di Costanzo", "Pasta", null, 2.90, "pz", false, undefined, "Non attivo — verificare costo prima di riattivare"),
  p("Quadrifoglio IGP", "Pasta", 3.90, 2.90, "pz", true, "IGP", "SOTTO COSTO — portare a 5,50€ o rimuovere urgente"),
  p("Lasagna IGP", "Pasta", 5.50, 2.90, "pz", true, "IGP", "SOTTO COSTO — rimuovere immediatamente"),
  p("Orecchiette di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Penne Rigate di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Rigatoni di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Pacchero di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Conchiglioni di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Fusilloni di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Linguine di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
  p("Spaghetti di Gragnano IGP", "Pasta", 2.90, 2.90, "pz", true, "IGP", "Portare a 4,50€"),
];


export const SEED_CLIENTS: Client[] = [
  { id: "c1", name: "Domenico Tibaldi", phone: "", segment: "top", segmentManual: true, stamps: 0 },
  { id: "c2", name: "Raffaele Ianniello", phone: "", segment: "top", segmentManual: true, stamps: 0 },
  { id: "c3", name: "Luisa Perfetto", phone: "", segment: "top", segmentManual: true, stamps: 0 },
  { id: "c-luciano-belzotti", name: "Luciano Belzotti", phone: "", segment: "top", segmentManual: true, stamps: 0 },
  { id: "c-giovanni-testa", name: "Giovanni Testa", phone: "", segment: "top", segmentManual: true, stamps: 0 },
  { id: "c4", name: "Antonio Sciorio", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c5", name: "Michelina Perrotta", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-anna", name: "Anna", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-vincenza-parente", name: "Vincenza Parente", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-gennarino-mignano", name: "Gennarino Mignano", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-nietta-falso", name: "Nietta Falso", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-elisa-ferro", name: "Elisa Ferro", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-monica-spinosi", name: "Monica Spinosi", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-marsilio-casale", name: "Marsilio Casale", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-salvatore-manzo", name: "Salvatore Manzo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-gaetano-di-siena", name: "Gaetano Di Siena", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-francesco-vecchio", name: "Francesco Vecchio", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-maria-carmine-falso", name: "Maria Carmine Falso", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-eufemia-domina", name: "Eufemia Domina", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-giuseppe-reccardo", name: "Giuseppe Reccardo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-filippo-bar-stop", name: "Filippo Bar Stop", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-giulio-falso", name: "Giulio Falso", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-alessandra-cardillo", name: "Alessandra Cardillo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-antonella-riccitteli", name: "Antonella Riccitteli", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-mario-moscati", name: "Mario Moscati", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-serena-casale", name: "Serena Casale", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-savore-carbone", name: "Savore Carbone", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-alessandra-polverino", name: "Alessandra Polverino", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-federica-russo", name: "Federica Russo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-sergio-formia", name: "Sergio Formia", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-stefania-mallozzi", name: "Stefania Mallozzi", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-calogero-timuneri", name: "Calogero Timuneri", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-enzo-perfetto", name: "Enzo Perfetto", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-enza-parente", name: "Enza Parente", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-enzo-testa", name: "Enzo Testa", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-enzo-rocco", name: "Enzo Rocco", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-mario-ottaviano", name: "Mario Ottaviano", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-cosimo-corrente", name: "Cosimo Corrente", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-stefano-russo", name: "Stefano Russo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-antonietta-tartaglia", name: "Antonietta Tartaglia", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-attilio-di-nardo", name: "Attilio Di Nardo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-lillo-carbone", name: "Lillo Carbone", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-giulio-gaveglia", name: "Giulio Gaveglia", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-antonio-corrente", name: "Antonio Corrente", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-ercole-sciorio", name: "Ercole Sciorio", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-enzo-riccardi", name: "Enzo Riccardi", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-domenico-rocco", name: "Domenico Rocco", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-evelina-coviello", name: "Evelina Coviello", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-vincenzo-sessa", name: "Vincenzo Sessa", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-angelo-cinquanta", name: "Angelo Cinquanta", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-silvano-di-marco", name: "Silvano Di Marco", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-antonio-di-rienzo", name: "Antonio Di Rienzo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-giusy-de-meo", name: "Giusy De Meo", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-nello-klimabus", name: "Nello Klimabus", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-damiano-ionta", name: "Damiano Ionta", phone: "", segment: "abituali", segmentManual: true, stamps: 0 },
  { id: "c-carla-pimpinella", name: "Carla Pimpinella", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-luciana-poccia", name: "Luciana Poccia", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-federica-fantasia", name: "Federica Fantasia", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-lucia-ionta", name: "Lucia Ionta", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-marzia-caddia", name: "Marzia Caddia", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-vincenza-verrico", name: "Vincenza Verrico", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-adelina-improta", name: "Adelina Improta", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-andrea-casale", name: "Andrea Casale", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-giulia-romanelli", name: "Giulia Romanelli", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-lidia-paraschiv", name: "Lidia Paraschiv", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-angela-falso", name: "Angela Falso", phone: "", segment: "occasionali", segmentManual: true, stamps: 0 },
  { id: "c-giuseppe-di-siena", name: "Giuseppe Di Siena", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-gennaro-ianniello", name: "Gennaro Ianniello", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-gaia-tedesco", name: "Gaia Tedesco", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-alessandro-ianniello", name: "Alessandro Ianniello", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-rossella-costanzo", name: "Rossella Costanzo", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-elisabetta-testa", name: "Elisabetta Testa", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-patrizia-romano", name: "Patrizia Romano", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-giuseppe-ciorra", name: "Giuseppe Ciorra", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-cristian-lanterna", name: "Cristian Lanterna", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-enrico-falso", name: "Enrico Falso", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-francesca-di-nardo", name: "Francesca Di Nardo", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-maria-rita-riccardi", name: "Maria Rita Riccardi", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-dario-iossa", name: "Dario Iossa", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-manuela-romanelli", name: "Manuela Romanelli", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-gabriele-stabile", name: "Gabriele Stabile", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-maria-di-paola", name: "Maria Di Paola", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-marianeve-marrese", name: "Marianeve Marrese", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
  { id: "c-angela-calegari", name: "Angela Calegari", phone: "", segment: "nuovi", segmentManual: true, stamps: 0 },
];

// Bundle aggiornati Maggio 2026
export const SEED_BUNDLES: Bundle[] = [
  { id: "b1",  name: "I Monti Bianchi",         ingredients: ["Mozzarella bufala 500g", "Ricotta bufala 1pz", "Marzolina condita 1pz"], fullPrice: 11.10, offerPrice: 9.50, estimatedCost: 6.70, availability: "Fisso sempre attivo", active: true, channel: "Vetrina", targetSegment: "abituali" },
  { id: "b2",  name: "Il Tagliere di Sciorio",  ingredients: ["Mozzarella bufala 500g", "Provolone del Monaco DOP 200g", "Salame Napoli 200g", "Taralli classici 1pz"], fullPrice: 20.90, offerPrice: 16.90, estimatedCost: 13.06, availability: "Fisso sempre attivo", active: true, channel: "Banco + WhatsApp", targetSegment: "top" },
  { id: "b3",  name: "La Tavola da Pranzo",     ingredients: ["Mozzarella bufala 500g", "Mortadella 200g", "Pane casareccio 500g", "Ricotta bufala 1pz"], fullPrice: 13.50, offerPrice: 10.90, estimatedCost: 8.19, availability: "Rotante venerdì e sabato", active: true },
  { id: "b4",  name: "Freschi Senza Lattosio",  ingredients: ["Mozzarella s/lattosio 500g", "Ricotta di pecora 2pz", "Marzolina bianca 1pz"], fullPrice: 13.00, offerPrice: 10.90, estimatedCost: 8.55, availability: "Fisso sempre attivo", active: true },
  { id: "b5",  name: "Il Panino dello Chef",    ingredients: ["Pane casareccio 250g", "Cotto Gran Tenerone 150g", "Marzolina condita 1pz"], fullPrice: 6.65, offerPrice: 4.90, estimatedCost: 3.14, availability: "Rotante martedì e giovedì", active: true, channel: "Banco pranzo", targetSegment: "occasionali" },
  { id: "b6",  name: "Il Banco dello Chef",     ingredients: ["Ricotta bufala 1pz", "Mozzarella bufala 250g", "Pane casareccio 500g", "Marzolina condita 1pz"], fullPrice: 12.50, offerPrice: 9.90, estimatedCost: 5.08, availability: "Rotante venerdì e sabato", active: true },
  { id: "b7",  name: "La Bufala Pontina",       ingredients: ["Mozzarella bufala 500g", "Caciocavallo Dolce 200g", "Ricotta bufala 1pz", "Taralli classici 1pz"], fullPrice: 16.50, offerPrice: 11.90, estimatedCost: 9.28, availability: "Rotante weekend", active: true },
  { id: "b8",  name: "La Merenda di Sciorio",   ingredients: ["Speck 150g", "Marzolina Sottovuoto 1pz", "Taralli classici 1pz", "Aglianico Campania DOC 1 bottiglia"], fullPrice: 16.30, offerPrice: null, estimatedCost: undefined, availability: "Rotante martedì e giovedì — prezzo da chiudere appena verificato costo Aglianico", active: true },
  { id: "b9",  name: "Box Famiglia",            ingredients: ["Mozzarella bufala 500g", "Mortadella 200g", "Pane casareccio 500g", "Ricotta bufala 1pz", "Coca-Cola 1 lattina"], fullPrice: 15.50, offerPrice: 11.90, estimatedCost: 8.69, availability: "Rotante sabato", active: true },
  { id: "b10", name: "Il Sacco di Sciorio",     ingredients: ["Panini 4pz", "Salame Napoli 200g", "Marzolina Condita 2pz"], fullPrice: 13.60, offerPrice: 10.90, estimatedCost: 7.19, availability: "Rotante martedì-venerdì", active: true },
  { id: "b11", name: "La Grigliata di Sciorio", ingredients: ["Salsiccia Paesana SV 400g", "Scamorza Affumicata 200g", "Peperoni grigliati Casa Marrazzo 300g"], fullPrice: 23.10, offerPrice: 16.90, estimatedCost: undefined, availability: "Temporaneo campagna estiva — margine min 20%", active: true },
  { id: "b12", name: "Il Tagliere Estivo",      ingredients: ["Burrata bufala 250g", "Provolone del Monaco DOP 150g", "Salame Napoli 100g", "Taralli classici 1pz"], fullPrice: 19.50, offerPrice: 13.90, estimatedCost: 8.15, availability: "Nuovo — estate 2026", active: true },
];


const today = new Date();
const isoToday = (h: number, m: number, dayOffset = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const SEED_ORDERS: Order[] = [];
export const SEED_CASUAL_SALES: CasualSale[] = [];
export const SEED_DELIVERIES: Delivery[] = [];

const isoDay = (dayOffset = 0) => {
  const d = new Date(today); d.setDate(d.getDate() + dayOffset); d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const SEED_PRODUCTIONS: Production[] = [];

// ============= FRESH / UNSOLD / CALENDAR =============

export type WeekdayKey = "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom";
export const WEEKDAYS: WeekdayKey[] = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
export const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  lun: "Lunedì", mar: "Martedì", mer: "Mercoledì", gio: "Giovedì",
  ven: "Venerdì", sab: "Sabato", dom: "Domenica",
};
// JS getDay(): 0=domenica
export function weekdayKey(d: Date | string): WeekdayKey {
  const n = new Date(d).getDay();
  return (["dom", "lun", "mar", "mer", "gio", "ven", "sab"] as WeekdayKey[])[n];
}

export interface DayHours { closed: boolean; open?: string; close?: string; }
export type BusinessHours = Record<WeekdayKey, DayHours>;
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  lun: { closed: true },
  mar: { closed: false, open: "08:00", close: "20:00" },
  mer: { closed: false, open: "08:00", close: "20:00" },
  gio: { closed: false, open: "08:00", close: "20:00" },
  ven: { closed: false, open: "08:00", close: "20:00" },
  sab: { closed: false, open: "08:00", close: "20:00" },
  dom: { closed: false, open: "08:00", close: "14:00" },
};

export interface FreshLog {
  id: string;
  date: string;        // ISO (giorno)
  productId: string;
  qtyStart: number;    // disponibile inizio giornata
  qtySold: number;     // venduto al normale
  qtyRecovered: number;// recuperato (TGTG / scontato)
  qtyDiscarded: number;// scarto
  qtyLeft?: number;    // rimasto fine giornata (calcolato se vuoto)
  notes?: string;
}

export type UnsoldDestination = "scontato" | "tgtg" | "consumo_interno" | "scarto" | "altro";
export const UNSOLD_DESTINATION_LABEL: Record<UnsoldDestination, string> = {
  scontato: "Venduto scontato",
  tgtg: "Too Good To Go",
  consumo_interno: "Consumo interno",
  scarto: "Scarto",
  altro: "Altro",
};
export interface UnsoldEntry {
  id: string;
  date: string;             // ISO
  productId: string;
  qty: number;
  destination: UnsoldDestination;
  valueLost?: number;       // valore perso (€)
  valueRecovered?: number;  // valore recuperato (€)
  tgtgBoxes?: number;       // numero box TGTG vendute
  notes?: string;
}

export type SpecialDayImpact = "basso" | "medio" | "alto";
export interface SpecialDay {
  id: string;
  date: string;     // ISO (YYYY-MM-DD)
  name: string;     // Natale, Pasqua, Ferragosto, ponte, ecc.
  impact: SpecialDayImpact;
  multiplier: number; // es. 1.0, 0.7, 1.3, 1.5, 2.0
  notes?: string;
}

export const SEED_FRESH_LOGS: FreshLog[] = [];

export const SEED_UNSOLD_ENTRIES: UnsoldEntry[] = [];

export const SEED_SPECIAL_DAYS: SpecialDay[] = [];

export const SEED_SUPPLIERS: Supplier[] = [
  { id: "sup1", name: "Tucciarone Salumi", category: "Salumi", phone: "+39 0771 555111", contactName: "Antonio", productIds: ["salsiccia-paesana-sottovuoto-tucciarone"], lastOrderDate: isoDay(-7) },
  { id: "sup2", name: "Casa Marrazzo", category: "Conserve", phone: "+39 081 555222", productIds: ["zucchine-grigliate-casa-marrazzo", "carciofi-grigliati-casa-marrazzo", "melanzane-a-filetti-casa-marrazzo"], lastOrderDate: isoDay(-14) },
  { id: "sup3", name: "Forno D'Alise", category: "Pane", phone: "+39 0771 555333", contactName: "Mario", productIds: ["pane-casareccio-d-alise", "panini-d-alise"], lastOrderDate: isoDay(-1), notes: "Consegna giornaliera 06:30" },
  { id: "sup4", name: "Latte Sano", category: "Latte", phone: "+39 06 555444", productIds: ["latte-intero-latte-sano", "latte-alta-digeribilita-latte-sano"], lastOrderDate: isoDay(-3) },
  { id: "sup5", name: "Renzini Norcineria", category: "Salumi", phone: "+39 075 555888", productIds: ["guanciale-del-norcino-renzini", "crudo-lui-renzini", "lonza-di-norcia-renzini"], lastOrderDate: isoDay(-10) },
];

export const SEED_CASH_ENTRIES: CashEntry[] = [];

export const SEED_B2B_CLIENTS: B2BClient[] = [];

export const SEED_SUPPLIER_PAYMENTS: SupplierPayment[] = [];

// ============= GOODS RECEIPTS / ENTRATE MERCI =============

export type GoodsReceiptStatus = "attesa" | "ricevuta" | "verificata" | "archiviata" | "annullata";
export type InvoicePaymentStatus = "da_pagare" | "pagato" | "scaduto" | "non_applicabile";
export type DocumentKind = "fattura" | "ddt" | "ricevuta" | "preventivo" | "altro";

export interface GoodsReceiptItem {
  productId: string;
  qty: number;
  unitCost?: number;
  notes?: string;
  lotCode?: string; // Lotto specificato manualmente; se assente viene generato automaticamente
}

export interface GoodsReceiptAttachment {
  id: string;       // IndexedDB key
  name: string;
  type: string;     // mime
  size: number;
  kind?: DocumentKind;
  addedAt: string;
}

export interface GoodsReceipt {
  id: string;
  date: string;            // ISO datetime ricezione
  supplierId: string;
  status: GoodsReceiptStatus;
  items: GoodsReceiptItem[];
  totalCost?: number;      // se vuoto, calcolato da items
  carrier?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  // Documento
  invoiceNumber?: string;
  invoiceDate?: string;
  ddtNumber?: string;
  taxableAmount?: number;  // imponibile
  vatAmount?: number;      // IVA
  documentTotal?: number;  // totale documento
  paymentDueDate?: string;
  paymentStatus?: InvoicePaymentStatus;
  attachments?: GoodsReceiptAttachment[];
  createdAt: string;
}

export const GOODS_RECEIPT_STATUS_LABEL: Record<GoodsReceiptStatus, string> = {
  attesa: "In attesa",
  ricevuta: "Ricevuta",
  verificata: "Verificata",
  archiviata: "Archiviata",
  annullata: "Annullata",
};


export const INVOICE_STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  da_pagare: "Da pagare",
  pagato: "Pagato",
  scaduto: "Scaduto",
  non_applicabile: "N/A",
};

export const SEED_GOODS_RECEIPTS: GoodsReceipt[] = [];

export function calcReceiptTotal(r: GoodsReceipt): number {
  if (typeof r.totalCost === "number") return r.totalCost;
  return r.items.reduce((s, it) => s + (it.unitCost ?? 0) * it.qty, 0);
}

export function calcMargin(p: Product): number | null {
  if (p.cost == null || p.price === 0) return null;
  return ((p.price - p.cost) / p.price) * 100;
}

export function calcMarginEur(p: Product): number | null {
  if (p.cost == null) return null;
  return p.price - p.cost;
}

export function bundleMargin(b: Bundle): { pct: number | null; eur: number | null } {
  const price = b.offerPrice ?? b.fullPrice;
  if (b.estimatedCost == null || !price) return { pct: null, eur: null };
  const eur = price - b.estimatedCost;
  return { pct: (eur / price) * 100, eur };
}

// ============= E-COMMERCE =============

export type EcomPlatform = "shopify" | "woocommerce" | "altro";
export type EcomOrderStatus = "ricevuto" | "in_preparazione" | "spedito" | "consegnato" | "annullato";
export type EcomPaymentStatus = "pagato" | "da_pagare" | "rimborsato";

export interface OnlineOrderItem { productId: string; qty: number; unitPrice?: number; nameRaw?: string; }

export interface OnlineOrder {
  id: string;
  date: string;                 // ISO
  platform: EcomPlatform;
  externalNumber: string;       // numero ordine piattaforma
  customerName: string;
  email?: string;
  phone?: string;
  shippingAddress?: string;
  items: OnlineOrderItem[];
  total: number;
  estimatedCost?: number;       // costo prodotti stimato
  status: EcomOrderStatus;
  paymentStatus: EcomPaymentStatus;
  shippingCost?: number;
  notes?: string;
  createdAt: string;
}

export type ShipmentStatus = "da_preparare" | "affidata" | "in_transito" | "consegnata" | "problema";

export interface Shipment {
  id: string;
  orderId: string;              // OnlineOrder.id
  customerName: string;
  address: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingCost?: number;
  status: ShipmentStatus;
  shippedDate?: string;
  expectedDelivery?: string;
  deliveredDate?: string;
  notes?: string;
  createdAt: string;
}

export const ECOM_ORDER_STATUS_LABEL: Record<EcomOrderStatus, string> = {
  ricevuto: "Ricevuto",
  in_preparazione: "In preparazione",
  spedito: "Spedito",
  consegnato: "Consegnato",
  annullato: "Annullato",
};

export const ECOM_PAYMENT_STATUS_LABEL: Record<EcomPaymentStatus, string> = {
  pagato: "Pagato",
  da_pagare: "Da pagare",
  rimborsato: "Rimborsato",
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  da_preparare: "Da preparare",
  affidata: "Affidata corriere",
  in_transito: "In transito",
  consegnata: "Consegnata",
  problema: "Problema",
};

export const ECOM_PLATFORM_LABEL: Record<EcomPlatform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  altro: "Altro",
};

export const SEED_ONLINE_ORDERS: OnlineOrder[] = [];

export const SEED_SHIPMENTS: Shipment[] = [];

export function calcOnlineOrderCost(o: OnlineOrder, products: Product[]): number {
  if (typeof o.estimatedCost === "number") return o.estimatedCost;
  return o.items.reduce((s, it) => {
    const p = products.find((x) => x.id === it.productId);
    return s + (p?.cost ?? 0) * it.qty;
  }, 0);
}

// ============= LOTTI / TRACCIABILITÀ LEGGERA =============

export interface Lot {
  id: string;
  code: string;            // AAAAMMGG-NN
  productId: string;
  productionDate: string;  // ISO date
  expiryDate: string;      // ISO date (scadenza / TMC)
  qtyInitial: number;      // quantità ricevuta/prodotta
  qtyRemaining: number;    // quantità residua
  supplierId?: string;
  receiptId?: string;      // GoodsReceipt collegata
  productionId?: string;   // se prodotto internamente
  notes?: string;
  createdAt: string;
}

export function generateLotCode(productionDate: string, existing: Lot[]): string {
  const d = new Date(productionDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const prefix = `${y}${m}${day}`;
  const sameDay = existing.filter(l => l.code.startsWith(prefix));
  const next = String(sameDay.length + 1).padStart(2, "0");
  return `${prefix}-${next}`;
}

export function daysUntil(iso: string): number {
  const ms = new Date(iso).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(ms / 86400000);
}

export function expiryStatus(iso: string): "scaduto" | "oggi" | "domani" | "presto" | "ok" {
  const d = daysUntil(iso);
  if (d < 0) return "scaduto";
  if (d === 0) return "oggi";
  if (d === 1) return "domani";
  if (d <= 2) return "presto";
  return "ok";
}

// FEFO: primo lotto attivo con scadenza più vicina
export function fefoLot(lots: Lot[], productId: string): Lot | null {
  const active = lots
    .filter(l => l.productId === productId && l.qtyRemaining > 0)
    .sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));
  return active[0] ?? null;
}

// ============= HACCP / TEMPERATURE =============

export type HaccpArea = "banco" | "frigo" | "trasporto" | "laboratorio";
export const HACCP_AREAS: HaccpArea[] = ["banco", "frigo", "trasporto", "laboratorio"];
export const HACCP_AREA_LABEL: Record<HaccpArea, string> = {
  banco: "Banco", frigo: "Frigo", trasporto: "Trasporto", laboratorio: "Laboratorio",
};
// Soglie indicative (°C): [min, max]
export const HACCP_THRESHOLDS: Record<HaccpArea, [number, number]> = {
  banco: [0, 6],
  frigo: [0, 4],
  trasporto: [0, 6],
  laboratorio: [0, 8],
};

export interface HaccpReading {
  id: string;
  date: string;           // ISO datetime
  area: HaccpArea;
  temperature: number;    // °C
  operator?: string;
  notes?: string;
  outOfRange?: boolean;   // calcolato al salvataggio
}

export function isOutOfRange(area: HaccpArea, temp: number): boolean {
  const [mn, mx] = HACCP_THRESHOLDS[area];
  return temp < mn || temp > mx;
}

// ============= PULIZIE / SANIFICAZIONI =============

export interface CleaningTask {
  id: string;
  date: string;           // ISO
  area: string;           // es. "Banco vendita", "Frigo bufala"
  operation: string;      // es. "Sanificazione superfici"
  operator?: string;
  completed: boolean;
  notes?: string;
}

// ============= SEED minimi =============

export const SEED_LOTS: Lot[] = [];

export const SEED_HACCP_READINGS: HaccpReading[] = [];

export const SEED_CLEANING_TASKS: CleaningTask[] = [];
