import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ScalaShop" },
      { name: "description", content: "Informativa sulla privacy di ScalaShop ai sensi del GDPR." },
      { property: "og:title", content: "Privacy Policy — ScalaShop" },
      { property: "og:description", content: "Informativa sulla privacy di ScalaShop ai sensi del GDPR." },
      { property: "og:url", content: "https://scalashopdemo.lovable.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://scalashopdemo.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-brand-cream text-brand-green px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-4 text-sm leading-relaxed">
        <h1 className="font-display text-3xl mb-2">Privacy Policy</h1>
        <p className="text-xs opacity-70">Ultimo aggiornamento: 24 giugno 2026</p>

        <h2 className="font-semibold mt-6">1. Titolare del trattamento</h2>
        <p>Il titolare del trattamento dei dati è ScalaShop, contattabile via WhatsApp al numero +39 388 381 0008.</p>

        <h2 className="font-semibold mt-6">2. Dati raccolti</h2>
        <p>Raccogliamo i dati che fornisci in fase di registrazione (nome attività, recapito telefonico, email, password) e i dati operativi che inserisci nell'app (clienti, ordini, prodotti, scontrini, consegne, magazzino).</p>

        <h2 className="font-semibold mt-6">3. Finalità</h2>
        <p>I dati sono utilizzati esclusivamente per fornire il servizio gestionale, sincronizzare le informazioni tra i tuoi dispositivi e fornire assistenza.</p>

        <h2 className="font-semibold mt-6">4. Base giuridica</h2>
        <p>Il trattamento si basa sull'esecuzione del contratto di servizio (art. 6.1.b GDPR) e sul consenso per le comunicazioni facoltative.</p>

        <h2 className="font-semibold mt-6">5. Conservazione</h2>
        <p>I dati sono conservati per tutta la durata dell'account. In caso di cancellazione, i dati vengono rimossi entro 30 giorni, salvo obblighi di legge.</p>

        <h2 className="font-semibold mt-6">6. Condivisione</h2>
        <p>I dati non vengono venduti né condivisi con terzi a fini commerciali. Possono essere trattati da fornitori tecnici (hosting cloud, autenticazione) in qualità di responsabili del trattamento.</p>

        <h2 className="font-semibold mt-6">7. Diritti dell'utente</h2>
        <p>Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Per esercitare i tuoi diritti contattaci via WhatsApp.</p>

        <h2 className="font-semibold mt-6">8. Sicurezza</h2>
        <p>I dati sono trasmessi tramite connessioni cifrate (HTTPS) e archiviati su infrastrutture cloud con accesso protetto.</p>

        <p className="pt-6">
          <Link to="/" className="underline">← Torna all'app</Link>
        </p>
      </div>
    </div>
  );
}
