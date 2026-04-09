"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const FAECHER = [
  "Mathematik",
  "Deutsch",
  "NMG",
  "Englisch",
  "Französisch",
  "Geometrie",
];

async function gespraecheLaden(kindId) {
  if (!kindId) return [];
  const { data, error } = await supabase
    .from("gespraeche")
    .select(
      "id, fach, thema, gestartet_am, beendet_am, anzahl_nachrichten, richtige_antworten, falsche_antworten, stufe_erreicht",
    )
    .eq("kind_id", kindId)
    .order("gestartet_am", { ascending: false })
    .limit(500);

  if (error) {
    console.error("gespraecheLaden:", error);
    return [];
  }
  return data || [];
}

function avatarEmoji(avatar) {
  if (avatar === "eli") return "🦋";
  return "🦁";
}

function avatarName(avatar) {
  return avatar === "eli" ? "Eli" : "Lian";
}

function formatDatumZeit(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("de-CH", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function balkenFuerAnzahl(n) {
  const count = Math.max(0, n);
  const filled = Math.min(10, count);
  const leer = 10 - filled;
  return "█".repeat(filled) + "░".repeat(leer);
}

export default function FortschrittKindPage() {
  const params = useParams();
  /** Route: /dashboard/fortschritt/[kindId] */
  const kindId =
    typeof params?.kindId === "string"
      ? params.kindId
      : Array.isArray(params?.kindId)
        ? params.kindId[0]
        : "";

  const router = useRouter();
  const [profil, setProfil] = useState(null);
  const [gespraeche, setGespraeche] = useState([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!kindId) {
        setFehler("Kein Profil angegeben.");
        setLaedt(false);
        return;
      }

      setLaedt(true);
      setFehler("");

      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) {
          router.replace("/einloggen");
          return;
        }

        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("id, fantasy_name, klasse, avatar, parent_id")
          .eq("id", kindId)
          .single();

        if (ignore) return;
        if (pe || !p) {
          setFehler("Profil nicht gefunden.");
          setLaedt(false);
          return;
        }

        if (p.parent_id !== auth.user.id) {
          setFehler("Du darfst dieses Profil nicht einsehen.");
          setLaedt(false);
          return;
        }

        setProfil(p);

        const rows = await gespraecheLaden(kindId);
        if (ignore) return;
        setGespraeche(rows);
      } catch {
        if (!ignore) setFehler("Etwas ist schiefgelaufen.");
      } finally {
        if (!ignore) setLaedt(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [kindId, router]);

  const zaehlProFach = useMemo(() => {
    const m = {};
    for (const f of FAECHER) m[f] = 0;
    for (const g of gespraeche) {
      if (g.fach && m[g.fach] !== undefined) m[g.fach] += 1;
    }
    return m;
  }, [gespraeche]);

  const letzteZehn = useMemo(() => gespraeche.slice(0, 10), [gespraeche]);

  if (laedt) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] text-white flex items-center justify-center px-6">
        <p className="text-white/75">Laden…</p>
      </div>
    );
  }

  if (fehler || !profil) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] text-white px-6 py-10">
        <div className="max-w-xl mx-auto">
          <p className="text-red-200">{fehler || "Profil fehlt."}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full border border-[#FFC832] text-[#FFC832] px-5 py-2 font-semibold hover:bg-[#FFC832]/10"
          >
            ← Zurück zum Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const emoji = avatarEmoji(profil.avatar);
  const lernName = avatarName(profil.avatar);
  const klassenLabel = `${Number(profil.klasse)}. Klasse`;

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white px-4 sm:px-8 pb-16">
      <div className="max-w-3xl mx-auto pt-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-full border border-white/90 text-white font-semibold px-5 py-2 bg-transparent hover:bg-white/10 transition-colors"
        >
          ← Zurück zur Dashboard-Übersicht
        </Link>

        <div className="mt-8 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 rounded-2xl border-2 border-[#FFC832] bg-[#16213e] p-6">
          <div className="text-7xl leading-none" aria-hidden="true">
            {emoji}
          </div>
          <div>
            <h1 className="text-[#FFC832] text-2xl sm:text-3xl font-extrabold">
              {profil.fantasy_name}
            </h1>
            <p className="mt-1 text-white/90 text-lg">{klassenLabel}</p>
            <p className="mt-1 text-white/65 text-sm">
              Lernbegleiter: {lernName}
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-xl font-bold text-white">
          Gespräche pro Fach
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Pro Leiste bis zu 10 Markierungen (ein Gespräch = ein Eintrag in
          Fortschritt).
        </p>

        <ul className="mt-4 space-y-3 font-mono text-sm">
          {FAECHER.map((f) => {
            const n = zaehlProFach[f] || 0;
            return (
              <li
                key={f}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 rounded-xl border border-[#FFC832]/40 bg-[#16213e]/80 px-4 py-3 text-white"
              >
                <span className="font-sans font-semibold w-36 shrink-0 text-[#FFC832]">
                  {f}
                </span>
                <span className="text-[#FFC832] tracking-tight">
                  {balkenFuerAnzahl(n)}
                </span>
                <span className="font-sans font-semibold text-white/90 whitespace-nowrap">
                  {n} Gespräch{n === 1 ? "" : "e"}
                </span>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-12 text-xl font-bold text-white">
          Letzte Gespräche (max. 10)
        </h2>
        <p className="mt-1 text-sm text-white/60">
          📅 Datum · 📚 Fach · 📖 Thema · ⭐ Stufe
        </p>

        {letzteZehn.length === 0 ? (
          <p className="mt-4 text-white/65">
            Noch keine Gespräche – starte eine Lernrunde im Chat.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {letzteZehn.map((z) => (
              <li
                key={z.id}
                className="rounded-xl border border-[#FFC832]/30 bg-[#16213e]/90 px-4 py-3 text-sm leading-relaxed text-white/90"
              >
                <span className="text-white/95">
                  📅 {formatDatumZeit(z.gestartet_am)}
                </span>
                {" · "}
                <span className="text-[#FFC832] font-semibold">
                  📚 {z.fach || "—"}
                </span>
                {" · "}
                <span>📖 {z.thema || "Allgemein"}</span>
                {" · "}
                <span className="text-[#FFC832]">
                  ⭐ Stufe {z.stufe_erreicht ?? 1}/5
                </span>
                {" · "}
                <span>
                  ✅ {z.richtige_antworten ?? 0} / ❌ {z.falsche_antworten ?? 0} / 💬{" "}
                  {z.anzahl_nachrichten ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10">
          <Link
            href={`/chat/${kindId}`}
            className="inline-flex rounded-full bg-[#FFC832] text-[#1a1a2e] font-bold px-8 py-3 hover:bg-[#e6b92e] transition-colors"
          >
            Weiter lernen
          </Link>
        </div>
      </div>
    </div>
  );
}
