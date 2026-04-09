"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function zeitBegruessung() {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function istHeute(d) {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function vorZeit(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const s = Math.max(0, Math.round(diffMs / 1000));
    const m = Math.round(s / 60);
    const h = Math.round(m / 60);
    const days = Math.round(h / 24);
    if (s < 45) return "gerade eben";
    if (m < 60) return `vor ${m} Minute${m === 1 ? "" : "n"}`;
    if (h < 24) return `vor ${h} Stunde${h === 1 ? "" : "n"}`;
    if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
    return new Intl.DateTimeFormat("de-CH", { dateStyle: "short" }).format(d);
  } catch {
    return "—";
  }
}

async function gespraecheLadenAlle(kindIds) {
  if (!kindIds.length) return [];
  const { data, error } = await supabase
    .from("gespraeche")
    .select(
      "id, kind_id, fach, thema, gestartet_am, beendet_am, anzahl_nachrichten, richtige_antworten, falsche_antworten, stufe_erreicht",
    )
    .in("kind_id", kindIds)
    .order("gestartet_am", { ascending: false })
    .limit(300);

  if (error) {
    console.error("gespraecheLaden:", error);
    return [];
  }
  return data || [];
}

function statsProKind(gespraeche, kindId) {
  const mine = gespraeche.filter((g) => g.kind_id === kindId);
  const total = mine.length;
  const neueste = mine[0];
  return {
    gespraecheTotal: total,
    letztesFach: neueste?.fach ?? "—",
    letzteAktivitaet: neueste?.gestartet_am ?? null,
    letzte5: mine.slice(0, 5),
  };
}

export default function Dashboard() {
  const [kinder, setKinder] = useState([]);
  const [gespraeche, setGespraeche] = useState([]);
  const router = useRouter();
  const [hoverKindId, setHoverKindId] = useState(null);
  const [addHover, setAddHover] = useState(false);
  const [maxProfile, setMaxProfile] = useState(2);
  const [aboPlan, setAboPlan] = useState("normal");
  const limitErreicht = kinder.length >= maxProfile;

  const statsMap = useMemo(() => {
    const m = {};
    for (const k of kinder) {
      m[k.id] = statsProKind(gespraeche, k.id);
    }
    return m;
  }, [kinder, gespraeche]);

  const kindLoeschen = async (kindId) => {
    const bestätigung = window.confirm(
      "Möchtest du dieses Profil wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!bestätigung) return;

    const {
      data: { session: aktiveSession },
    } = await supabase.auth.getSession();

    if (!aktiveSession?.user?.id) {
      console.error("Fehler beim Löschen: keine Session");
      router.push("/einloggen");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", kindId)
      .eq("parent_id", aktiveSession.user.id);

    if (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Löschen fehlgeschlagen: " + error.message);
    } else {
      setKinder((prev) => prev.filter((k) => k.id !== kindId));
      setGespraeche((prev) => prev.filter((g) => g.kind_id !== kindId));
    }
  };

  useEffect(() => {
    const laden = async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!s) {
        router.push("/einloggen");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("parent_id", s.user.id);

      if (error) {
        console.error("Fehler beim Laden der Kinderprofile:", error);
        alert(
          "Profile konnten nicht geladen werden: " +
            (error.message || "Unbekannter Fehler")
        );
        return;
      }

      const liste = data || [];
      setKinder(liste);

      // Abo laden für Limit (fallback: normal mit max 2)
      const { data: abo, error: aboError } = await supabase
        .from("abonnements")
        .select("*")
        .eq("user_id", s.user.id)
        .single();
      if (aboError) {
        console.log("Abo Fehler (Dashboard):", aboError);
      }
      if (abo) {
        setMaxProfile(Number(abo.max_profile) || 2);
        setAboPlan(abo.plan || "normal");
      } else {
        setMaxProfile(2);
        setAboPlan("normal");
      }

      const ids = liste.map((k) => k.id);
      const g = await gespraecheLadenAlle(ids);
      setGespraeche(g);
    };
    laden();
  }, [router]);

  const kindHinzufuegen = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      router.push("/einloggen");
      return;
    }

    const { data: abo } = await supabase
      .from("abonnements")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("parent_id", user.id);

    const maxProfileLocal = abo?.max_profile || 2;
    const aktuelleAnzahl = profile?.length || 0;

    console.log("Max Profile:", maxProfileLocal);
    console.log("Aktuelle Profile:", aktuelleAnzahl);

    if (aktuelleAnzahl >= maxProfileLocal) {
      if (abo?.plan === "normal") {
        alert(
          "Du hast das Maximum von " +
            maxProfileLocal +
            " Profilen für das Normal-Abo erreicht.\n\n" +
            "Upgrade auf das Grosse Abo für " +
            "bis zu 4 Profile."
        );
        router.push("/profil");
      } else {
        alert(
          "Du hast das Maximum von " + maxProfileLocal + " Profilen erreicht."
        );
        router.push("/profil");
      }
      return;
    }

    router.push("/dashboard/kind-erstellen");
  };

  const letzteAktivitaet = useMemo(() => {
    if (!gespraeche.length || !kinder.length) return null;
    // `gespraeche` ist bereits desc sortiert nach gestartet_am
    const g0 = gespraeche[0];
    if (!g0?.kind_id) return null;
    const kind = kinder.find((k) => k.id === g0.kind_id);
    const d = g0.gestartet_am ? new Date(g0.gestartet_am) : null;
    if (!kind || !d) return null;
    const heuteText = istHeute(d) ? "heute" : "kürzlich";
    return {
      fantasy_name: kind.fantasy_name,
      fach: g0.fach || "—",
      wann: `${heuteText} · ${vorZeit(g0.gestartet_am)}`,
    };
  }, [gespraeche, kinder]);

  return (
    <div
      style={{
        background: "#0f0f1a",
        minHeight: "100vh",
        padding: "24px 18px",
        color: "white",
      }}
    >
      <div
        style={{
          maxWidth: "980px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "12px",
        }}
      >
          <div
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            Denkzeit
          </div>

          <button
            type="button"
            onClick={() => router.push("/profil")}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)",
              fontSize: "16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Mein Profil"
            aria-label="Mein Profil"
          >
            👤
          </button>
        </div>

        {/* Trennlinie */}
        <div
          style={{
            height: "1px",
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            marginBottom: "16px",
          }}
        />

        {/* Begrüssung */}
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "13px",
            marginBottom: "18px",
          }}
        >
          {zeitBegruessung()}
        </div>

        {/* Kinder Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
            gap: "14px",
            justifyItems: "start",
            marginBottom: "18px",
          }}
        >
          <style>{`
            @media (min-width: 700px) { .k-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (min-width: 980px) { .k-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
          `}</style>
          <div className="k-grid" style={{ display: "contents" }}>
            {kinder.map((kind) => {
              const hover = hoverKindId === kind.id;
              const emoji = kind.avatar === "lian" ? "🦁" : "🦋";
              const avatarName = kind.avatar === "lian" ? "Lian" : "Eli";
              return (
                <div
                  key={kind.id}
                  onMouseEnter={() => setHoverKindId(kind.id)}
                  onMouseLeave={() => setHoverKindId(null)}
                  style={{
                    width: "100%",
                    maxWidth: "220px",
                    background: hover ? "#20203a" : "#1a1a2e",
                    border: "0.5px solid rgba(255,200,50,0.45)",
                    borderRadius: "16px",
                    padding: "14px",
                    position: "relative",
                    transition: "background 0.15s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => kindLoeschen(kind.id)}
                    title="Löschen"
                    aria-label="Kind löschen"
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.45)",
                      fontSize: "12px",
                      lineHeight: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ fontSize: "36px", lineHeight: 1 }}>{emoji}</div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.92)",
                          fontSize: "16px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "150px",
                        }}
                      >
                        {kind.fantasy_name}
                      </div>
                      <div
                        style={{
                          marginTop: "2px",
                          color: "rgba(255,255,255,0.45)",
                          fontSize: "12px",
                        }}
                      >
                        {kind.klasse}. Klasse · {avatarName}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "14px",
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => router.push("/chat/" + kind.id)}
                      style={{
                        flex: 1,
                        background: "#FFC832",
                        color: "#1a1a2e",
                        border: "none",
                        borderRadius: "10px",
                        padding: "8px 10px",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    >
                      Lernen
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        router.push("/dashboard/fortschritt/" + kind.id)
                      }
                      title="Fortschritt"
                      aria-label="Fortschritt"
                      style={{
                        width: "40px",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "10px",
                        padding: "8px 0",
                        cursor: "pointer",
                        color: "rgba(255,255,255,0.72)",
                        fontSize: "14px",
                      }}
                    >
                      📊
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Letzte Aktivität */}
        {letzteAktivitaet ? (
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "13px",
              marginBottom: "10px",
              lineHeight: 1.5,
            }}
          >
            Letzte Aktivität:{" "}
            <span style={{ color: "rgba(255,255,255,0.7)" }}>
              {letzteAktivitaet.fantasy_name}
            </span>{" "}
            hat {letzteAktivitaet.fach} gelernt · {letzteAktivitaet.wann}
          </div>
        ) : null}

        {/* Kind hinzufügen */}
        <button
          type="button"
          onClick={kindHinzufuegen}
          onMouseEnter={() => !limitErreicht && setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          style={{
            display: "block",
            textAlign: "center",
            color: limitErreicht
              ? "rgba(255,255,255,0.2)"
              : addHover
                ? "#FFC832"
                : "rgba(255,255,255,0.3)",
            fontSize: "13px",
            padding: "16px",
            cursor: limitErreicht ? "not-allowed" : "pointer",
            border: "none",
            background: "none",
            width: "100%",
            transition: "color 0.2s",
          }}
        >
          {limitErreicht
            ? aboPlan === "normal"
              ? "Limit erreicht · Abo upgraden"
              : "Limit erreicht · Profil ansehen"
            : "+ Kind hinzufügen"}
        </button>
      </div>
    </div>
  );
}
