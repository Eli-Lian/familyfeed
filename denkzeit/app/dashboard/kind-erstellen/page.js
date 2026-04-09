"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const KLASSEN = [
  { value: "1", label: "1. Klasse" },
  { value: "2", label: "2. Klasse" },
  { value: "3", label: "3. Klasse" },
  { value: "4", label: "4. Klasse" },
  { value: "5", label: "5. Klasse" },
  { value: "6", label: "6. Klasse" },
  { value: "7", label: "7. Klasse" },
  { value: "8", label: "8. Klasse" },
  { value: "9", label: "9. Klasse" },
];

const AVATARE = [
  { id: "lian", label: "Lian", emoji: "🦁", vibe: "Warm & ermutigend", gender: "Junge" },
  { id: "eli", label: "Eli", emoji: "🦋", vibe: "Ruhig & präzise", gender: "Mädchen" },
];

function germanSaveError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("permission") || m.includes("row level security") || m.includes("rls")) {
    return "Ich darf das Profil gerade nicht speichern. Bitte prüfe die Supabase-Regeln (RLS) für die Tabelle „profiles“.";
  }
  if (m.includes("duplicate") || m.includes("unique")) {
    return "Dieses Profil gibt es so schon. Bitte wähle einen anderen Fantasienamen.";
  }
  return "Ups – das Profil konnte nicht gespeichert werden. Bitte versuch es nochmal.";
}

export default function KindErstellenPage() {
  const router = useRouter();
  const [fantasyName, setFantasyName] = useState("");
  const [avatar, setAvatar] = useState("lian");
  const [klasse, setKlasse] = useState(KLASSEN[3].value); // 4. Klasse als netter Default
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const cleanedFantasyName = useMemo(
    () => fantasyName.trim().replace(/\s+/g, " "),
    [fantasyName]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!cleanedFantasyName) {
      setError("Bitte gib einen Fantasienamen ein.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError("Ich konnte deinen Login gerade nicht prüfen. Bitte logge dich nochmal ein.");
        router.replace("/einloggen");
        return;
      }

      const parentId = userData?.user?.id;
      if (!parentId) {
        router.replace("/einloggen");
        return;
      }

      // Profil-Limit prüfen (Sicherheit)
      const { data: abo } = await supabase
        .from("abonnements")
        .select("*")
        .eq("user_id", parentId)
        .single();

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("parent_id", parentId);

      if ((profile?.length || 0) >= (abo?.max_profile || 2)) {
        alert("Profil-Limit erreicht.");
        router.push("/dashboard");
        return;
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        parent_id: parentId,
        fantasy_name: cleanedFantasyName,
        avatar,
        klasse: parseInt(klasse, 10),
      });

      if (insertError) {
        setError(germanSaveError(insertError.message));
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(germanSaveError(err?.message));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col px-6 sm:px-10">
      <div className="max-w-3xl w-full mx-auto pt-10 pb-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-full border border-white/90 text-white font-semibold px-5 py-2 bg-transparent hover:bg-white/10 transition-colors"
        >
          ← Zurück zum Dashboard
        </Link>

        <h1 className="mt-8 text-[#FFC832] text-3xl sm:text-5xl font-extrabold tracking-tight text-center">
          Profil für dein Kind erstellen
        </h1>

        <form onSubmit={onSubmit} className="mt-10 max-w-xl mx-auto space-y-6">
          <p className="text-center text-white/85">
            Name eingeben → Avatar wählen → Klasse wählen → Starten
          </p>

          <div>
            <label className="block text-sm font-medium text-white/90">
              Fantasiename (kein echter Name!)
            </label>
            <input
              type="text"
              value={fantasyName}
              onChange={(e) => setFantasyName(e.target.value)}
              placeholder="z.B. Löwenkopf, Sternenfuchs…"
              required
              className="mt-2 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/50 outline-none focus:border-[#FFC832]/70 focus:ring-2 focus:ring-[#FFC832]/20"
            />
            <p className="mt-2 text-sm text-white/75">
              Wähle einen Fantasienamen – wir speichern keinen echten Namen.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90">
              Avatar
            </label>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {AVATARE.map((a) => {
                const selected = avatar === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvatar(a.id)}
                    className={[
                      "w-full rounded-3xl border px-6 py-6 text-left transition-colors",
                      selected
                        ? "border-[#FFC832] bg-[#FFC832]/10"
                        : "border-white/15 bg-white/5 hover:bg-white/10",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-5xl leading-none" aria-hidden="true">
                        {a.emoji}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <div className="font-extrabold text-white text-xl">
                            {a.label}
                          </div>
                          <div className="text-white/70 text-sm">({a.gender})</div>
                        </div>
                        <div className="mt-1 text-white/85 font-semibold">
                          {a.vibe}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90">
              Klasse
            </label>
            <select
              value={klasse}
              onChange={(e) => setKlasse(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white outline-none focus:border-[#FFC832]/70 focus:ring-2 focus:ring-[#FFC832]/20"
            >
              {KLASSEN.map((k) => (
                <option key={k.value} value={k.value} className="text-black">
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-red-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[#FFC832] text-[#1a1a2e] font-semibold px-7 py-3 text-base sm:text-lg hover:bg-[#e6b92e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Starte…" : "Starten"}
          </button>
        </form>
      </div>
    </div>
  );
}

