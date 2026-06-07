# Piano ScalaShop Demo — 27 punti

Lavoro principalmente per **sottrazione e standardizzazione**, riusando store/componenti esistenti. Stimo ~15 file toccati, nessuna migration backend.

## Fase 1 — Infrastruttura demo (file nuovi/condivisi)

1. **`src/lib/demo-flags.ts`** (nuovo): elenco rotte bloccate, helper `isLocked(path)`, helper `getTrialDaysLeft(userId)` (legge `completedAt` da onboarding, 14gg), helper `getBusinessName(userId)`.
2. **`src/components/LockedSection.tsx`** (nuovo): pagina-blocco con sfondo blur + banner centrale "Per sbloccare anche questa funzionalità, attiva il piano Starter di ScalaShop." + CTA `button` (no link).
3. **`src/components/PromoMarquee.tsx`** (nuovo): barra gialla scorrevole con le 5 frasi richieste. CSS keyframes (no libreria).
4. **`src/components/DemoGate.tsx`** (nuovo): wrapper usato in `__root.tsx` che, per le rotte in lockedRoutes, sostituisce il contenuto con `LockedSection`.

## Fase 2 — Onboarding & import (punti 1, 2)

5. **`src/lib/demo-parsers.ts`**: estendere per XLSX (`xlsx` se già in deps, altrimenti `sheetjs`) e immagini (OCR via `tesseract.js`? — **troppo pesante**, fallback: per JPG/PNG mostriamo solo upload + invito a incollare testo; per PDF già ok). **Decisione pragmatica:** XLSX sì (libreria leggera), immagini accettate ma con messaggio "Riconoscimento immagini in arrivo — incolla il testo qui sotto". Questo evita 5MB di tesseract.
6. **Bug import testuale prodotti**: il parser attuale richiede regex `\d+[.,]\d{1,2}` (es. "15,00"). Il formato "15€/kg" senza decimali fallisce. Correggere regex per accettare `\d+(?:[.,]\d{1,2})?` ed estrarre unit anche con `/kg`.
7. **`OnboardingScreen.tsx`**: aggiungere drag&drop su entrambi i textarea (handler `onDragOver`/`onDrop`), aggiornare `accept` con xlsx/jpg/png, parser routing per estensione.
8. **Persistenza import**: verificare che `addClient`/`addProduct` dello store persistano (cloudSync). Già ok.

## Fase 3 — Sidebar & rotte bloccate (punti 3, 4, 5, 19, 24)

9. **`AppShell.tsx`**: riscrivere la sidebar con la struttura a 4 gruppi richiesta (OPERATIVO / MAGAZZINO E PRODOTTI / VENDITE ONLINE / FINANZA E AMMINISTRAZIONE), incluse voci bloccate con icona lucchetto. Aggiungere voce **Pagamenti** (route nuova). Voce "Amministrazione" → "Pannello di Controllo" (già fatto, verificare).
10. **Rotte bloccate**: in ogni route file della lista bloccati, sostituire il body con `<LockedSection />`. Più semplice: gate nel route component invece di toccare 13 file uno per uno → fare in `__root.tsx` via `DemoGate`.
11. **Mobile bottom-nav**: aggiornare le 6 voci principali se serve (Dashboard, Ordini, Scontrini, Consegne, Cassa, Più).

## Fase 4 — Dashboard (punti 6, 7, 8, 22)

12. **`routes/index.tsx`**:
    - Riscrivere banner trial: testo dinamico "Stai provando ScalaShop. Ti restano X giorni…" con sfondo `bg-brand-gold` o `bg-brand-green` per visibilità.
    - Aggiungere bordo `border-brand-green/30` ai box Ritiri/Scontrini/Consegne (anche stato vuoto).
    - Rimuovere "Nuovo Pagamento" dai quick-action.
13. **Promo marquee**: inserire `<PromoMarquee />` in `__root.tsx` (compare ovunque automaticamente).

## Fase 5 — Branding nome attività (punto 23)

14. **`AppShell.tsx`**: sotto "ScalaShop" nella sidebar mostrare `businessName` da onboarding. In header pagina (top-right) mostrare lo stesso in modo discreto.

## Fase 6 — Sezioni accessibili (punti 9-18, 20, 21)

15. **`routes/magazzino.tsx`**: rimuovere "Nuovo Prodotto" separato, lasciare solo "Imposta Magazzino". Campo fornitore: combobox con datalist (fornitori già usati, salvataggio implicito tramite store).
16. **`routes/prodotti.tsx`**: rimuovere filtri e panoramiche (più venduti / profittevoli / mai venduti). Pulsante "+" → naviga a `/magazzino` invece di entrate-merci.
17. **`routes/ordini.tsx`** (nuovo ordine, no prodotti): redirect/CTA verso `/magazzino` invece di entrate-merci. Aggiungere bordo ai 4 KPI box.
18. **`routes/clienti.tsx`**: rimuovere filtri segment.
19. **`routes/consegne.tsx`**: filtri come pill con bordo gold quando attivi, rimuovere label "Status". Bordo ai 4 KPI box.
20. **`routes/incassi.tsx` (Scontrini/Cassa)**: la voce sidebar "Scontrini" punta qui ma mostra "Uscite" — rinominare titolo a "Scontrini", rimuovere KPI "Da pagare/Scaduti/Saldati", sostituire con "Completati / Fatturato generato / Scontrino medio", bordo box.

## Fase 7 — Nuova route Pagamenti (punto 19)

21. **`routes/pagamenti.tsx`**: già esiste, sovrascrivere body con `<LockedSection />` (gestito via DemoGate).

## Fase 8 — Mobile & QA (punti 26, 27)

22. Test visivo della sidebar mobile, bottom-nav, dashboard, ordini.
23. Verifica che cloudSync/login/onboarding non siano toccati.

## Decisioni pragmatiche per limitare consumo crediti

- **OCR immagini**: NON implemento (tesseract = 5MB+). Accetto upload JPG/PNG ma mostro messaggio "incolla il testo per ora". Riporto nel report finale.
- **XLSX**: aggiungo `xlsx` (~400KB, ok).
- **Gate rotte bloccate**: via `DemoGate` in `__root.tsx`, NON tocco 13 file route uno per uno.
- **NO migration backend**.
- **NO refactor architetturale**.

## File toccati (stima)

Nuovi: `demo-flags.ts`, `LockedSection.tsx`, `PromoMarquee.tsx`, `DemoGate.tsx` (4).
Modificati: `AppShell.tsx`, `OnboardingScreen.tsx`, `demo-parsers.ts`, `__root.tsx`, `index.tsx`, `prodotti.tsx`, `clienti.tsx`, `consegne.tsx`, `ordini.tsx`, `incassi.tsx`, `magazzino.tsx`, `package.json` (per xlsx) (12).

Procedo?
