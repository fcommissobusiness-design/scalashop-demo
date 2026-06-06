// Suggerimenti euristici locali (no backend). Possono essere upgradati in futuro
// collegando Lovable AI. Tutto in italiano, basato su categoria/segmento.

import type { Product, Bundle, Client, Segment } from "./data";

const SEGMENT_TARGETS: Record<Segment, string> = {
  top: "Top fidelizzati (messaggio personale)",
  abituali: "Clienti abituali (WhatsApp diretto)",
  occasionali: "Occasionali (broadcast con sconto)",
  nuovi: "Nuovi clienti (omaggio benvenuto)",
  inattivi: "Inattivi da riattivare (offerta forte)",
};

export interface ProductSuggestion {
  quando: string;
  target: string[];
  bundle: string[];
  offerta: string;
}

export function suggestForProduct(product: Product, allBundles: Bundle[], allClients: Client[]): ProductSuggestion {
  const cat = product.category;
  let quando = "Tutta la settimana";
  let segments: Segment[] = ["abituali", "top"];
  let offerta = `Bundle abbinato con sconto 15%`;

  if (cat === "Freschi di Bufala") {
    quando = "Mattina presto, weekend e festivi";
    segments = ["top", "abituali", "occasionali"];
    offerta = "Promo 'Bufala fresca del giorno' — bundle Monti Bianchi a 9,50€";
  } else if (cat === "Salumi") {
    quando = "Aperitivo (giovedì-sabato pomeriggio)";
    segments = ["abituali", "occasionali"];
    offerta = "Tagliere -10% su 200g+";
  } else if (cat === "Formaggi Stagionati") {
    quando = "Weekend, eventi familiari";
    segments = ["top", "abituali"];
    offerta = "Bundle Tagliere di Sciorio";
  } else if (cat === "Vini") {
    quando = "Venerdì e sabato sera";
    segments = ["top", "abituali"];
    offerta = "Vino + tagliere = -2€";
  } else if (cat === "Pane") {
    quando = "Mattina, ogni giorno";
    segments = ["abituali", "top", "nuovi"];
    offerta = "Pane + mozzarella = combo colazione";
  } else if (cat === "Dispensa") {
    quando = "Tutto il giorno, idee regalo";
    segments = ["occasionali", "nuovi"];
    offerta = "3x2 sui taralli";
  }

  const target = segments.map((s) => SEGMENT_TARGETS[s]);
  const recBundles = allBundles
    .filter((b) => b.active)
    .filter((b) => b.ingredients.some((ing) => ing.toLowerCase().includes(product.name.toLowerCase().split(" ")[0])))
    .slice(0, 3)
    .map((b) => b.name);

  // touch unused param to avoid TS warning
  void allClients;

  return {
    quando,
    target,
    bundle: recBundles.length ? recBundles : ["Crea un nuovo bundle dedicato a questo prodotto"],
    offerta,
  };
}

export interface BundleSuggestion {
  target: string;
  momento: string;
  modalita: string;
  addon: string[];
}

export function suggestForBundle(bundle: Bundle): BundleSuggestion {
  const name = bundle.name.toLowerCase();
  let target = "Famiglie e clienti abituali";
  let momento = "Weekend (venerdì-sabato)";
  let modalita = "Esposizione in vetrina + WhatsApp broadcast giovedì sera";
  let addon = ["Bottiglia Falanghina DOC", "Pane casareccio fresco"];

  if (name.includes("merenda") || name.includes("panino")) {
    target = "Lavoratori e studenti zona pranzo";
    momento = "Martedì-giovedì 11:30-13:30";
    modalita = "Cartello al banco + storia Instagram";
    addon = ["Acqua piccola", "Birra Peroni 33cl"];
  } else if (name.includes("grigliata") || name.includes("famiglia") || name.includes("box")) {
    target = "Famiglie 4+ persone";
    momento = "Sabato pomeriggio per cena/grigliata";
    modalita = "WhatsApp ai top fidelizzati venerdì mattina";
    addon = ["Vino Aglianico DOC", "Tarallini premium"];
  } else if (name.includes("tagliere")) {
    target = "Top fidelizzati e occasionali con buon scontrino";
    momento = "Aperitivo venerdì-domenica";
    modalita = "Vetrina + suggerimento attivo al banco";
    addon = ["Chianti DOCG", "Olive di Gaeta DOP"];
  } else if (name.includes("senza lattosio")) {
    target = "Clienti con intolleranze (segmento dedicato)";
    momento = "Tutta la settimana";
    modalita = "Messaggio personale ai clienti noti come intolleranti";
    addon = ["Latte alta digeribilità"];
  }

  return { target, momento, modalita, addon };
}
