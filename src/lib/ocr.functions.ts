import { createServerFn } from "@tanstack/react-start";

type Payload = {
  base64: string;
  mime: string;
  kind: "clients" | "products";
};

/**
 * OCR via Lovable AI Gateway (Gemini 2.5 Flash, OpenAI-compatible).
 * Estrae testo da immagini caricate in fase di onboarding (JPG/PNG).
 */
export const ocrExtract = createServerFn({ method: "POST" })
  .inputValidator((data: Payload) => {
    if (!data || typeof data !== "object") throw new Error("invalid payload");
    const { base64, mime, kind } = data;
    if (typeof base64 !== "string" || base64.length < 100) throw new Error("invalid base64");
    if (base64.length > 8_000_000) throw new Error("file too large");
    if (typeof mime !== "string" || !/^image\/(png|jpe?g|webp)$/i.test(mime)) {
      throw new Error("unsupported mime");
    }
    if (kind !== "clients" && kind !== "products") throw new Error("invalid kind");
    return { base64, mime, kind };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) return { ok: false, text: "", error: "missing_key" };

    const prompt =
      data.kind === "products"
        ? "Estrai dall'immagine un elenco di prodotti, una riga per prodotto nel formato: 'Nome prodotto  prezzo €  (unità opzionale)'. Restituisci SOLO le righe, senza intestazioni, commenti o markdown."
        : "Estrai dall'immagine un elenco di clienti, una riga per cliente nel formato: 'Nome Cognome  telefono'. Restituisci SOLO le righe, senza intestazioni, commenti o markdown.";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${data.mime};base64,${data.base64}` },
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[ocrExtract] gateway error", res.status, body);
        return { ok: false, text: "", error: `gateway_${res.status}` };
      }
      const json: any = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      return { ok: true, text };
    } catch (err) {
      console.error("[ocrExtract] fetch error", err);
      return { ok: false, text: "", error: "fetch_failed" };
    }
  });