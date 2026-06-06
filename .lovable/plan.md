## Stato attuale (verifica P0)

Analizzato il codice — la maggior parte dei fix P0 è già in piedi:

- `consegne.tsx` riga 146–150: `DeliverySheet` ha già la firma `Omit<Delivery,"id"|"createdAt"> | Partial<Delivery>`. Nessun errore TS residuo riconducibile a riga 137 (riga 137 è ora il componente `Kpi`).
- `AppShell.tsx`: `/consegne` è già in `NAV` (sidebar desktop) e in `MOBILE_NAV` (bottom nav mobile, escluso solo `/admin` e `/report`).
- `store.ts`: `deliveries`, `addDelivery`, `updateDelivery`, `deleteDelivery` esposti correttamente, con migrazione e seed.
- `data.ts`: `Delivery`, `DeliveryStatus`, `DeliveryPayment`, `SEED_DELIVERIES` definiti.

Resta da fare:
1. Verifica build TS (un giro tipi a fine intervento).
2. Aggiungere `/report` al `MOBILE_NAV` (è solo desktop ora) — lo chiede esplicitamente più sotto come parte del gestionale completo.

## Approccio generale P1 + P2

Tutto resta locale, basato su `localStorage` (`sciorio-hq-v4` con migrazione da v3), nessun backend, nessuna nuova dipendenza pesante. Pattern coerente con l'esistente: tipi in `data.ts`, CRUD in `store.ts`, una route per sezione, `Sheet`/`Field`/`Fab`/`TopBar` riutilizzati, `WhatsAppDialog` riusato dove serve.

Per non gonfiare la bottom nav mobile (già 6 voci), aggiungo una voce **"Più"** che apre un menu con le sezioni secondarie. Sidebar desktop le elenca tutte.

## Phase 1 — Foundation: data + store + utility

**`src/lib/data.ts`** — nuovi tipi e seed:

- `Production { id, date, productId, qtyPlanned, qtyActual?, orderIds[], status: "da_preparare"|"preparato"|"completato", notes? }`
- Estensione `Product`: `stock?, stockMin?, unitStock?, supplierId?, lastRestock?`
- `Supplier { id, name, category, phone, contactName?, productIds[], notes?, lastOrderDate? }`
- `CashEntry { id, date, type:"entrata"|"uscita", category, amount, method:"contanti"|"pos"|"bonifico"|"carta"|"altro", notes?, refType?:"order"|"delivery"|"casual"|"payment", refId? }`
- `B2BClient { id, name, contactName?, phone, zone?, priceListId?, deliveryDays:string[], status:"prospect"|"attivo"|"sospeso", notes?, history:{date,total,note?}[] }`
- `SupplierPayment { id, date, beneficiary, beneficiaryType:"fornitore"|"consulente"|"servizio"|"altro", category, amount, method, status:"da_pagare"|"pagato"|"scaduto", dueDate?, recurrence:"una_tantum"|"settimanale"|"mensile"|"annuale", notes?, document?:"fattura"|"ricevuta"|"preventivo"|"nessuno", supplierId? }`
- `OrderSource` esteso con `"sito"|"b2b"`.
- Seed minimi realistici per ciascuno (3–5 record) + alcuni `cost` mancanti su prodotti esistenti per consentire calcolo margine giornaliero.

**`src/lib/store.ts`** — estensione `Store`, migrazione `sciorio-hq-v3 → v4` (fallback con default vuoti per i nuovi campi), CRUD per ognuno (`addProduction/updateProduction/deleteProduction`, `addSupplier/...`, `addCashEntry/...`, `addB2BClient/...`, `addSupplierPayment/...`). Quando un `Order` o `CasualSale` viene chiuso, helper opzionale `recordIncome()` che crea `CashEntry` collegata (chiamata esplicita dalle UI di chiusura, non automatica per non rompere il flusso esistente).

**`src/lib/metrics.ts`** — selettori derivati nuovi:

- `productionToday(date)`, `mozzarellaKgToday()`
- `lowStockProducts()`, `outOfStockProducts()`
- `cashFlowDay(date)`, `cashFlowMonth(date)`, `monthlyBalance()`
- `supplierPaymentsDue()`, `supplierPaymentsOverdue()`, `recurringMonthly()`
- `topSuppliersByCost()`, `topB2BByRevenue()`
- `grossMarginEstimated(period)`, `netBalanceEstimated(period)` (lordo – uscite registrate)
- `pendingDeliveryRevenue()`, `averageReceipt()`

## Phase 2 — Nuove sezioni (8 route)

Una route per voce (nuovo file in `src/routes/`), tutte con `TopBar`, lista filtrabile, `Sheet` con `Field` per CRUD, `Fab` per nuovo. Stile e densità identici alle sezioni esistenti.

1. `produzione.tsx` — lista per giorno, badge stato, KPI in alto (kg mozzarella oggi, da preparare, completati, delta previsto/effettivo). "Genera da ordini di oggi" come quick action.
2. `magazzino.tsx` — lista prodotti con `stock`, `stockMin`, alert sotto soglia/esauriti, link a fornitore, modifica rapida giacenza.
3. `fornitori.tsx` — anagrafica fornitori, azioni WhatsApp/Chiama, "Nuovo ordine fornitore" che apre Sheet con nota libera + data + (futuro link a `SupplierPayment`).
4. `incassi.tsx` — prima nota entrata/uscita con KPI giorno/mese e saldo, filtro categoria/metodo.
5. `fiscale.tsx` — sola lettura riassuntiva (fatturato stimato, incassi registrati, scontrini, ordini ritirati, consegne incassate, promemoria libero) con disclaimer fisso "Dati gestionali interni, non sostituiscono commercialista o registratore fiscale".
6. `b2b.tsx` — lista clienti business con stato/zona, azioni WhatsApp/Chiama, "Nuovo ordine B2B" (riusa `Order` con `source:"b2b"` e `clientId` punta al `B2BClient` via prefisso).
7. `finanza.tsx` — dashboard finanziaria read-only: fatturato generato, fatturato stimato, margine lordo stimato, uscite (merce/consulenti/altro), saldo netto stimato, scontrino medio, top prodotti per margine, top clienti, top B2B, consegne da incassare.
8. `pagamenti.tsx` — pagamenti fornitori/consulenti con stato (da pagare / pagato / scaduto, calcolato da `dueDate` vs oggi), ricorrenze, alert in cima, KPI mese, beneficiari più costosi.

**Navigazione**: sidebar desktop elenca tutte le voci raggruppate (Operativo / Anagrafiche / Finanza / Sistema). Bottom nav mobile mantiene 6 slot: `Home`, `Ordini`, `Consegne`, `Clienti`, `Prodotti`, `Più`. `Più` è un Sheet con tutte le altre sezioni.

## Phase 3 — Miglioramenti sezioni esistenti

Modifiche puntuali, senza riscritture:

- `ordini.tsx`: stato `pronto` già presente in tipi → assicurare presenza nei filtri/transizioni; selettore `source` con tutte le origini incl. `b2b`/`sito`; bottone "Duplica" già nello store, esporre nell'azione rapida; al passaggio a `ritirato` chiamare `recordIncome()` opzionale (toggle "registra incasso").
- `clienti.tsx`: badge "caldo / inattivo / top spender / premio pronto" calcolati da `metrics`, riga "Prodotti preferiti" derivata dagli ordini, LTV già calcolato → esporre in card.
- `prodotti.tsx`: nuovi campi `stock`, `stockMin`, `supplierId` (select da `suppliers`), toggle `magnet`/`seasonal` già nei tipi → esporre nel form.
- `offerte.tsx`: campi `targetSegment`, `channel`, `startDate`, `endDate` già in `Bundle` → esporre nel form; bottone "Genera messaggio WhatsApp promo" che apre `WhatsAppDialog` con template `promo_bundle`.
- `admin.tsx`: cambio PIN reale (usa `setPin`), export/import JSON, reset doppia conferma, riepilogo `storageInfo()`, versione hardcoded `v0.4.0`.

## Out of scope

Nessun backend, Supabase, autenticazione multi-utente, push, AI, ecommerce, grafici complessi, PDF, esportazioni avanzate, calcoli IVA reali, integrazione registratore fiscale.

## Note di esecuzione

- Migrazione store: leggere v4, fallback v3 (con riempimento campi nuovi a `[]`/`undefined`), poi v2 legacy. Mai distruggere dati esistenti.
- I nuovi `CashEntry` collegati a ordini sono opzionali e non duplicano il `total` dell'ordine: la finanza somma incassi registrati, non totali ordini, per evitare doppio conteggio. `fiscale.tsx` mostra entrambi separatamente.
- Tutto in italiano, branding/typografia invariati.
- Verifica TS finale con un giro di lettura sui file toccati; nessun `any` introdotto se non nei punti già esistenti.

## Diagramma navigazione

```text
Sidebar desktop                    Bottom nav mobile
─ OPERATIVO                        [Home][Ordini][Consegne]
  Dashboard                        [Clienti][Prodotti][Più]
  Ordini                                            │
  Consegne                                          ▼
  Produzione                       Sheet "Più":
─ ANAGRAFICHE                       Offerte · Produzione
  Clienti                           Magazzino · Fornitori
  B2B / Lidi                        B2B · Incassi · Pagamenti
  Prodotti                          Fiscale · Finanza · Report
  Magazzino                         Admin
  Fornitori
  Offerte
─ FINANZA
  Incassi
  Pagamenti
  Finanza
  Fiscale
  Report
─ SISTEMA
  Amministrazione
```
