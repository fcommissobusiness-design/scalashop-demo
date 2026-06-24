import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cookie")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — ScalaShop" },
      { name: "description", content: "Informativa sui cookie utilizzati da ScalaShop." },
      { property: "og:title", content: "Cookie Policy — ScalaShop" },
      { property: "og:description", content: "Informativa sui cookie utilizzati da ScalaShop." },
      { property: "og:url", content: "https://scalashopdemo.lovable.app/cookie" },
    ],
    links: [{ rel: "canonical", href: "https://scalashopdemo.lovable.app/cookie" }],
  }),
  component: CookiePage,
});

function CookiePage() {
  return (
    <div className="min-h-screen bg-brand-cream text-brand-green px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-4 text-sm leading-relaxed">
        <h1 className="font-display text-3xl mb-2">Cookie Policy</h1>
        <p className="text-xs opacity-70">Ultimo aggiornamento: 24 giugno 2026</p>

        <h2 className="font-semibold mt-6">1. Cosa sono i cookie</h2>
        <p>I cookie sono piccoli file di testo che i siti visitati inviano al dispositivo dell'utente, dove vengono memorizzati per essere ritrasmessi agli stessi siti alla visita successiva.</p>

        <h2 className="font-semibold mt-6">2. Cookie utilizzati da ScalaShop</h2>
        <p>ScalaShop utilizza esclusivamente <strong>cookie tecnici e di sessione</strong> necessari per il funzionamento dell'app e per mantenere l'utente autenticato. Non utilizziamo cookie di profilazione o pubblicitari.</p>

        <h2 className="font-semibold mt-6">3. Local Storage</h2>
        <p>L'app salva localmente sul dispositivo (tramite localStorage) i dati operativi per garantire il funzionamento offline e la sincronizzazione cloud.</p>

        <h2 className="font-semibold mt-6">4. Cookie di terze parti</h2>
        <p>Non utilizziamo cookie di terze parti a fini di tracciamento. I servizi di autenticazione e hosting impiegati possono utilizzare cookie tecnici essenziali al funzionamento del servizio.</p>

        <h2 className="font-semibold mt-6">5. Gestione dei cookie</h2>
        <p>Puoi disabilitare i cookie tramite le impostazioni del tuo browser. La disabilitazione dei cookie tecnici può compromettere il corretto funzionamento dell'app.</p>

        <p className="pt-6">
          <Link to="/" className="underline">← Torna all'app</Link>
        </p>
      </div>
    </div>
  );
}
