"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

function toGermanAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-Mail oder Passwort stimmt nicht. Bitte versuch es nochmal.";
  }
  if (m.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail (schau in deinem Posteingang nach).";
  }
  if (m.includes("invalid email")) {
    return "Bitte gib eine gültige E-Mail-Adresse ein.";
  }
  if (m.includes("too many")) {
    return "Zu viele Versuche. Bitte warte kurz und probiere es dann nochmal.";
  }
  return "Ups – das hat nicht geklappt. Bitte versuch es nochmal.";
}

export default function EinloggenPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(toGermanAuthError(signInError.message));
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(toGermanAuthError(err?.message));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex items-center justify-center px-6 sm:px-10">
      <div className="w-full max-w-lg">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-white/90 text-white font-semibold px-5 py-2 bg-transparent hover:bg-white/10 transition-colors"
        >
          ← Zurück
        </Link>

        <h1 className="mt-8 text-center text-[#FFC832] text-4xl sm:text-6xl font-extrabold tracking-tight">
          Einloggen
        </h1>
        <p className="mt-3 text-center text-white/85">
          Schön, dass du wieder da bist.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/90">
              E-Mail
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.ch"
              required
              className="mt-2 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/50 outline-none focus:border-[#FFC832]/70 focus:ring-2 focus:ring-[#FFC832]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90">
              Passwort
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dein Passwort"
              required
              className="mt-2 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/50 outline-none focus:border-[#FFC832]/70 focus:ring-2 focus:ring-[#FFC832]/20"
            />
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
            {isLoading ? "Logge ein…" : "Einloggen"}
          </button>

          <p className="text-center text-white/80 text-sm">
            Noch kein Konto?{" "}
            <Link href="/registrieren" className="underline underline-offset-4">
              Hier registrieren
            </Link>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
