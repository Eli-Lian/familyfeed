import Anthropic from "@anthropic-ai/sdk";
import LEHRPLAN from "@/lib/lehrplan";

export const runtime = "nodejs";

function systemPrompt(avatar, klasse, fach) {
  const themen = LEHRPLAN[fach]?.[klasse] || [];
  const themenText =
    themen.length > 0
      ? "Aktuelle Themen dieser Klasse: " + themen.join(", ") + "."
      : "";

  const name = avatar === "lian" ? "Lian 🦁" : "Eli 🦋";
  const ton =
    avatar === "lian"
      ? "warm, ermutigend, geduldig, gelegentlich Emojis"
      : "ruhig, präzise, analytisch, selten Emojis";

  const zusatzKlasse14 =
    typeof klasse === "number" && klasse <= 4
      ? `

ZUSATZ FÜR ANTWORTOPTIONEN (nur Klasse 1–4):
- Generiere GENAU 4 passende Antwortoptionen zum Niveau der Klasse.
- Keine Lösungen verraten; Optionen sollen Denkwege anbieten (inkl. «Weiss ich nicht» als Option D, wenn passend).`
      : "";

  return `Du bist ${name}, ein KI-Lernbegleiter 
für Schweizer Schüler.
Klasse: ${klasse}. Fach: ${fach}. Lehrplan 21 Schweiz.
${themenText}

TON: ${ton}
Sprache: Schweizer Hochdeutsch, du-Form, max. 3 Sätze.

SOKRATISCHE METHODE - ABSOLUT PFLICHT:
- Gib NIE direkt die Lösung
- Jede Antwort endet mit einer offenen Frage
- Falsche Antwort: frage nach dem Denkweg
- Richtige Antwort: bestätige kurz, führe tiefer
- Lob ist sparsam und echt

ANTWORT-FORMAT:
Antworte immer als JSON:
{
  "reply": "Deine sokratische Antwort...",
  "options": ["Option 1", "Option 2", 
               "Option 3", "Option 4"],
  "warRichtig": true
}

VERBOTEN:
- Lösung direkt nennen
- Mehr als eine Frage gleichzeitig
- Lange Erklärungen über 3 Sätze
- Übertriebenes Lob
- Gib NUR gültiges JSON zurück, keine Markdown-Codeblöcke, keine zusätzlichen Zeichen außerhalb des JSON.

WICHTIG:
- Setze \"warRichtig\" immer auf true oder false.
- true = Schüler denkt in die richtige Richtung.
- false = Schüler braucht mehr Hilfe.
${zusatzKlasse14}`;
}

export async function POST(req) {
  try {
    console.log("API Key vorhanden:", !!process.env.ANTHROPIC_API_KEY);

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { messages, subject, klasse, avatar } = body || {};
    console.log("Empfangene Messages:", messages);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Keine Nachricht enthalten" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "Anthropic API Key fehlt (ANTHROPIC_API_KEY)." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const klasseNumber =
      typeof klasse === "number" ? klasse : parseInt(String(klasse ?? ""), 10);
    const klasseSafe = Number.isFinite(klasseNumber) ? klasseNumber : 5;
    const fach = String(subject ?? "Mathematik").trim() || "Mathematik";
    const avatarSafe = avatar === "eli" ? "eli" : "lian";

    const system = systemPrompt(avatarSafe, klasseSafe, fach);

    const cleanMessages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? ""),
      }))
      .filter((m) => m.content.trim().length > 0);

    if (cleanMessages.length === 0) {
      return Response.json({ error: "Keine Nachricht enthalten" }, { status: 400 });
    }

    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system,
      messages: cleanMessages,
    });

    const text =
      Array.isArray(resp?.content) && resp.content[0]?.type === "text"
        ? resp.content[0].text
        : "";

    const wantsOptions = Number.isFinite(klasseNumber) && klasseNumber <= 4;

    const tryParseJson = (raw) => {
      const trimmed = String(raw ?? "").trim();
      if (!trimmed) return null;
      try {
        const parsed = JSON.parse(trimmed);
        const reply = String(parsed?.reply ?? "").trim();
        const options = Array.isArray(parsed?.options)
          ? parsed.options.map((o) => String(o))
          : [];
        const warRichtigRaw = parsed?.warRichtig;
        const warRichtig =
          typeof warRichtigRaw === "boolean"
            ? warRichtigRaw
            : typeof warRichtigRaw === "string"
              ? warRichtigRaw.trim().toLowerCase() === "true"
              : null;
        if (reply) return { reply, options, warRichtig };
      } catch {
        // JSON evtl. in Markdown eingepackt
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            const reply = String(parsed?.reply ?? "").trim();
            const options = Array.isArray(parsed?.options)
              ? parsed.options.map((o) => String(o))
              : [];
            const warRichtigRaw = parsed?.warRichtig;
            const warRichtig =
              typeof warRichtigRaw === "boolean"
                ? warRichtigRaw
                : typeof warRichtigRaw === "string"
                  ? warRichtigRaw.trim().toLowerCase() === "true"
                  : null;
            if (reply) return { reply, options, warRichtig };
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    const parsed = tryParseJson(text);
    if (parsed) {
      return Response.json({
        reply: parsed.reply,
        options: wantsOptions ? parsed.options : [],
        warRichtig:
          typeof parsed.warRichtig === "boolean" ? parsed.warRichtig : null,
      });
    }

    if (wantsOptions) {
      return Response.json({ reply: text || "…", options: [], warRichtig: null });
    }

    return Response.json({ reply: text || "…", options: [], warRichtig: null });
  } catch (error) {
    console.error("Genauer Fehler:", error?.message || error);
    return Response.json(
      { error: error?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
