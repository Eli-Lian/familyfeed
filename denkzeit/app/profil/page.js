"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mitgliedSeit, setMitgliedSeit] = useState("");
  const [abo, setAbo] = useState(null);
  const [profile, setProfile] = useState([]);
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [neuesPasswort2, setNeuesPasswort2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const laden = async () => {
      // User laden
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      // Mitglied seit
      const datum = new Date(user.created_at);
      setMitgliedSeit(
        datum.toLocaleDateString("de-CH", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      );

      // Abo laden
      const { data: abo, error } = await supabase
        .from("abonnements")
        .select("*")
        .eq("user_id", user.id)
        .single();

      console.log("Abo Daten:", abo);
      console.log("Abo Fehler:", error);

      if (abo) setAbo(abo);

      // Profile laden
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("parent_id", user.id);

      if (profile) setProfile(profile);

      console.log("User:", user);
      console.log("Abo:", abo);
      console.log("Profile:", profile);
    };
    laden();
  }, [router]);

  const passwortAendern = async () => {
    setMsg("");
    const p1 = neuesPasswort.trim();
    const p2 = neuesPasswort2.trim();
    if (!p1 || p1.length < 8) {
      setMsg("Bitte ein neues Passwort mit mindestens 8 Zeichen eingeben.");
      return;
    }
    if (p1 !== p2) {
      setMsg("Die Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) {
        console.error("Passwort ändern:", error);
        setMsg("Passwort ändern fehlgeschlagen: " + error.message);
        return;
      }
      setNeuesPasswort("");
      setNeuesPasswort2("");
      setMsg("Passwort wurde geändert.");
    } finally {
      setBusy(false);
    }
  };

  const kontoLoeschen = async () => {
    setMsg("");
    const ok = window.confirm(
      "Möchtest du dein Konto wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!ok) return;

    // Hinweis: User-Deletion braucht serverseitige Service-Role in Supabase.
    // Wir bieten hier bewusst eine klare Meldung statt stillem Fail.
    setMsg(
      "Konto löschen ist noch nicht serverseitig eingerichtet (Service Role). Bitte melde dich bei der Admin-Person."
    );
  };

  const ausloggen = async () => {
    setMsg("");
    setBusy(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: "#1a1a2e",
        minHeight: "100vh",
        padding: "20px",
        color: "white",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            color: "#FFC832",
            textDecoration: "none",
            marginBottom: "18px",
          }}
        >
          ← Zurück zum Dashboard
        </Link>

        <h1
          style={{
            color: "#FFC832",
            fontSize: "28px",
            fontWeight: "bold",
            margin: "0 0 18px",
          }}
        >
          Mein Profil
        </h1>

        {/* Konto Karte */}
        <div
          style={{
            background: "#1a1a2e",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "12px",
            }}
          >
            Konto
          </div>
          <div
            style={{
              color: "white",
              fontSize: "14px",
              marginBottom: "8px",
            }}
          >
            {user?.email}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
            Mitglied seit {mitgliedSeit}
          </div>
        </div>

        {/* Abo Karte */}
        <div
          style={{
            background: "#1a1a2e",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "12px",
            }}
          >
            Abo-Modell
          </div>

          {abo ? (
            <>
              <span
                style={{
                  background:
                    abo.plan === "gross"
                      ? "rgba(255,200,50,0.15)"
                      : "rgba(255,255,255,0.1)",
                  color:
                    abo.plan === "gross"
                      ? "#FFC832"
                      : "rgba(255,255,255,0.7)",
                  border:
                    abo.plan === "gross" ? "0.5px solid #FFC832" : "none",
                  padding: "4px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
              >
                {abo.plan === "gross" ? "Grosses Abo" : "Normal Abo"}
              </span>

              <div
                style={{
                  marginTop: "16px",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "13px",
                }}
              >
                {profile.length} von {abo.max_profile} Profilen genutzt
              </div>

              <div
                style={{
                  marginTop: "8px",
                  height: "4px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(
                      100,
                      (profile.length / Math.max(1, abo.max_profile)) * 100,
                    )}%`,
                    background: "#FFC832",
                    borderRadius: "2px",
                  }}
                />
              </div>

              {abo.plan === "normal" && (
                <button
                  type="button"
                  onClick={() => alert("Upgrade kommt bald!")}
                  style={{
                    marginTop: "16px",
                    background: "none",
                    border: "0.5px solid #FFC832",
                    color: "#FFC832",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Auf Grosses Abo upgraden →
                </button>
              )}
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
              Abo wird geladen...
            </div>
          )}
        </div>

        <div
          style={{
            background: "#16213e",
            border: "1px solid rgba(255,200,50,0.6)",
            borderRadius: "16px",
            padding: "18px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              color: "#FFC832",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            Passwort ändern
          </div>
          <input
            type="password"
            value={neuesPasswort}
            onChange={(e) => setNeuesPasswort(e.target.value)}
            placeholder="Neues Passwort"
            disabled={busy}
            style={{
              width: "100%",
              marginBottom: "10px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,200,50,0.6)",
              borderRadius: "10px",
              padding: "10px 12px",
              color: "white",
              outline: "none",
            }}
          />
          <input
            type="password"
            value={neuesPasswort2}
            onChange={(e) => setNeuesPasswort2(e.target.value)}
            placeholder="Neues Passwort wiederholen"
            disabled={busy}
            style={{
              width: "100%",
              marginBottom: "12px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,200,50,0.6)",
              borderRadius: "10px",
              padding: "10px 12px",
              color: "white",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={passwortAendern}
            disabled={busy}
            style={{
              width: "100%",
              background: "#FFC832",
              color: "#1a1a2e",
              border: "none",
              borderRadius: "10px",
              padding: "10px 12px",
              fontWeight: "bold",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Passwort ändern
          </button>
        </div>

        <button
          type="button"
          onClick={kontoLoeschen}
          disabled={busy}
          style={{
            width: "100%",
            background: "rgba(255,0,0,0.15)",
            color: "#ff6b6b",
            border: "1px solid #ff6b6b",
            borderRadius: "12px",
            padding: "12px",
            fontWeight: "bold",
            cursor: busy ? "not-allowed" : "pointer",
            marginBottom: "10px",
          }}
        >
          Konto löschen
        </button>

        <button
          type="button"
          onClick={ausloggen}
          disabled={busy}
          style={{
            width: "100%",
            background: "none",
            color: "white",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "12px",
            padding: "12px",
            fontWeight: "bold",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Ausloggen
        </button>

        {msg ? (
          <div
            style={{
              marginTop: "14px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,200,50,0.35)",
              borderRadius: "12px",
              padding: "12px",
              color: "#FFC832",
              fontSize: "14px",
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}

