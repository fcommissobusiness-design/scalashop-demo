import { createServerFn } from "@tanstack/react-start";

type Payload = {
  businessName: string;
  phone: string;
  email: string;
};

export const notifyAdminRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: Payload) => {
    if (!data || typeof data !== "object") throw new Error("invalid payload");
    const { businessName, phone, email } = data;
    if (typeof businessName !== "string" || businessName.length > 200) throw new Error("invalid businessName");
    if (typeof phone !== "string" || phone.length > 50) throw new Error("invalid phone");
    if (typeof email !== "string" || email.length > 200) throw new Error("invalid email");
    return { businessName, phone, email };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.error("[notifyAdminRegistration] missing API keys");
      return { ok: false, error: "missing_keys" };
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
    const timeStr = now.toLocaleTimeString("it-IT", { timeZone: "Europe/Rome" });

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.55">
        <h2 style="margin:0 0 12px">Nuova registrazione ScalaShop Demo</h2>
        <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
          <tr><td><b>Data</b></td><td>${esc(dateStr)}</td></tr>
          <tr><td><b>Ora</b></td><td>${esc(timeStr)}</td></tr>
          <tr><td><b>Nome attività</b></td><td>${esc(data.businessName)}</td></tr>
          <tr><td><b>Telefono</b></td><td>${esc(data.phone)}</td></tr>
          <tr><td><b>Email</b></td><td>${esc(data.email)}</td></tr>
        </table>
      </div>
    `;

    const text =
      `Nuova registrazione ScalaShop Demo\n\n` +
      `Data: ${dateStr}\nOra: ${timeStr}\n` +
      `Nome attività: ${data.businessName}\nTelefono: ${data.phone}\n` +
      `Email: ${data.email}\n`;

    try {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "ScalaShop Demo <onboarding@resend.dev>",
          to: ["fcommisso.business@gmail.com"],
          subject: "Nuova registrazione ScalaShop Demo",
          html,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[notifyAdminRegistration] resend error", res.status, body);
        return { ok: false, error: `resend_${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      console.error("[notifyAdminRegistration] fetch error", err);
      return { ok: false, error: "fetch_failed" };
    }
  });