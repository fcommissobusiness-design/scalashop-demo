# ScalaShop Demo — Stress test fixes

Lavoro in un'unica passata, riusando i componenti esistenti. Per ogni punto indico file/azione.

## A. Sincronizzazione multi-device (PRIORITÀ 1) — punti 1, 2, 25

Oggi `store.ts` salva tutto in `localStorage` per dispositivo; `cloudSync.ts` esiste ma evidentemente non copre tutto.

- Verifico/riscrivo `src/lib/cloudSync.ts` perché lo store completo (prodotti, clienti, ordini, consegne, scontrini, config, trial) venga salvato su `public.user_state` (jsonb già presente) per `auth.uid()` e ricaricato al login su ogni device.
- Al boot, prima di renderizzare AppShell: fetch da `user_state`, hydrate dello store, poi listener realtime per push/pull (debounced).
- **Trial**: il `trialStartMs` viene letto dal record cloud; se mancante lo creo lato server al primo accesso. Mai più "reset 14 giorni" su nuovo device.

## B. UI mobile (punti 3, 4, 10, 21, 23)

- **3** Banner "Demo gratuita" in `AppShell.tsx`: ridurre `bottom` su mobile sopra l'area del titolo Dashboard.
- **4** Pulsante "Richiedi assistenza" (`QuickActions.tsx`/`WhatsAppDialog.tsx`): spostare in basso a sinistra su mobile (md: resta dove è).
- **10** Indicatore "Salvato": nasconderlo su mobile (`hidden md:flex`).
- **21** Sidebar mobile: voce "Magazzino" deve apparire grigia+lucchetto come le altre bloccate (in `AppShell.tsx`).
- **23** Pannello di controllo mobile: rimuovere "Cambia PIN" residuo.

## C. Messaggio assistenza (punto 5)

In `wa.ts`/`WhatsAppDialog.tsx`: per "Richiedi assistenza" usare numero `393883810008` e testo `"Ciao, ho bisogno di assistenza per la demo di ScalaShop"`. La CTA "prova gratuita" rimane separata.

## D. Dashboard (punti 6, 7, 16, 18, 19)

In `src/routes/index.tsx`:
- **6** Aggiungere link "Vai a Scontrini" come per Ordini/Consegne.
- **7** Menu "+" mobile: ogni voce dentro card con bordo blu coerente.
- **16** Card Scontrini in dashboard delimitata come Ordini/Consegne.
- **18** Limitare ordini/consegne/scontrini a 3–5 e CTA "Visualizza tutti" che porta alla scheda con timeframe corrente in query string.
- **19** Click su scontrino in dashboard: apre la sheet completa, non focus sul pagamento (rimuovere `autoFocus`/`initialField`).

## E. Prodotti (punti 8, 22)

In `src/routes/prodotti.tsx`:
- **8** In creazione prodotto aggiungere selezione unità di vendita (pezzo/kg) come in modifica.
- **22** Spostare in sezione premium/sbiadita i campi Certificazione, Categoria, Fornitore.

## F. Carrello ordini/scontrini/consegne (punti 9, 11, 12, 13, 14, 15)

In `CartEditor.tsx` e nelle 3 sheet:
- **9** Aggiungere campo "Totale riga" editabile accanto a qty/prezzo. Editando il totale riga, calcolo `unitPriceOverride = total/qty` e lo salvo. Prezzo base resta invariato.
- **11** Voce "Aggiungi nuovo prodotto" sempre visibile nel selector (anche con campo vuoto / con risultati).
- **12** Mostrare max 5 prodotti suggeriti (più usati/recenti) finché non si digita; ricerca attiva all'input.
- **13** Rimuovere metodo "Carta" da tutte le selezioni pagamento, lasciare "POS".
- **14** Riga "Personalizzato": campi qty/prezzo come testo libero, cancellabili (no `0` bloccato).
- **15** Già parzialmente fatto: rivedere e confermare anche per riga personalizzata.

## G. Nuova Consegna (punto 17)

In `DeliveryFullSheet.tsx`: se status pagamento ∈ {"pagato_anticipo","pagato_consegna"} mostrare campo Metodo Pagamento.

## H. Cassa/Incassi (punto 20)

In `incassi.tsx`: aggiungere card "Margine" usando metriche esistenti (sum prezzo vendita − costo prodotto) sul timeframe.

## I. Verifica finale e report (punti 24, 26)

Smoke test build, screenshot mobile, e report per ogni voce.

## Stima impatto file
- `cloudSync.ts`, `store.ts` (sync), `AppShell.tsx`, `QuickActions.tsx`, `WhatsAppDialog.tsx`, `wa.ts`, `CartEditor.tsx`, `DeliveryFullSheet.tsx`, `routes/index.tsx`, `routes/ordini.tsx`, `routes/scontrini.tsx`, `routes/consegne.tsx`, `routes/prodotti.tsx`, `routes/incassi.tsx`, `routes/admin.tsx`, `routes/magazzino.tsx`, `demo-flags.ts`.

Confermi così procedo in un'unica passata?
