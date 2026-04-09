"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import LEHRPLAN from "@/lib/lehrplan";

const FAECHER = [
  "Mathematik",
  "Deutsch",
  "NMG",
  "Englisch",
  "Französisch",
  "Geometrie",
];

function getThemenFuerAnzeige(fach, klasse) {
  const arr = LEHRPLAN[fach]?.[klasse];
  if (!arr?.length) return [];
  const max = 6;
  const slice = arr.length > max ? arr.slice(0, max) : arr;
  const suffixe = [
    " üben",
    " verstehen",
    " vertiefen",
    " erkunden",
    " anwenden",
    " kennenlernen",
  ];
  return slice.map((roh, i) => ({
    key: roh,
    label: `${roh}${suffixe[i % suffixe.length]}`,
  }));
}

export default function ChatSeite() {
  const params = useParams();
  const router = useRouter();
  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const [profile, setProfile] = useState(null);
  const [profilLaedt, setProfilLaedt] = useState(true);
  const [profilFehler, setProfilFehler] = useState("");

  const [fach, setFach] = useState("Mathematik");
  const [nachrichten, setNachrichten] = useState([]);
  const [optionen, setOptionen] = useState([]);
  const [eingabe, setEingabe] = useState("");
  const [startEingabe, setStartEingabe] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [tonAn, setTonAn] = useState(true);
  const [blinktNachricht, setBlinktNachricht] = useState(false);
  const [blinktOptionIndex, setBlinktOptionIndex] = useState(null);
  const [antwortAuswahlAnzeige, setAntwortAuswahlAnzeige] = useState(null);
  const [aktivesStartThema, setAktivesStartThema] = useState(null);
  const [gespraechId, setGespraechId] = useState(null);
  const [richtig, setRichtig] = useState(0);
  const [falsch, setFalsch] = useState(0);
  const [vorliesNachrichtIndex, setVorliesNachrichtIndex] = useState(null);
  const [vorliesOptionIndexManuell, setVorliesOptionIndexManuell] =
    useState(null);
  const [tonHinweis, setTonHinweis] = useState("");

  const endRef = useRef(null);
  const tonAnInitialisiert = useRef(false);
  const pauseTimeoutRef = useRef(null);
  const ttsLaufIdRef = useRef(0);
  const tonAnRef = useRef(true);
  const tonHinweisTimeoutRef = useRef(null);
  const gespraechIdRef = useRef(null);
  const richtigRef = useRef(0);
  const falschRef = useRef(0);
  const stufeRef = useRef(1);
  const nachrichtenCountRef = useRef(0);

  const klasse =
    profile?.klasse != null && !Number.isNaN(Number(profile.klasse))
      ? Number(profile.klasse)
      : 5;
  tonAnRef.current = tonAn;
  const avatar = profile?.avatar === "eli" ? "eli" : "lian";
  const emoji = avatar === "eli" ? "🦋" : "🦁";
  const name = avatar === "eli" ? "Eli" : "Lian";

  const themenListe = getThemenFuerAnzeige(fach, klasse);
  const zeigeStartAnsicht = nachrichten.length === 0;

  useEffect(() => {
    gespraechIdRef.current = gespraechId;
  }, [gespraechId]);
  useEffect(() => {
    richtigRef.current = richtig;
  }, [richtig]);
  useEffect(() => {
    falschRef.current = falsch;
  }, [falsch]);
  useEffect(() => {
    nachrichtenCountRef.current = nachrichten.length;
  }, [nachrichten.length]);

  const clearPauseTimeout = () => {
    if (pauseTimeoutRef.current != null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  };

  const zeigeTonAusHinweis = () => {
    if (tonHinweisTimeoutRef.current) {
      clearTimeout(tonHinweisTimeoutRef.current);
    }
    setTonHinweis("Ton ist ausgeschaltet");
    tonHinweisTimeoutRef.current = setTimeout(() => {
      setTonHinweis("");
      tonHinweisTimeoutRef.current = null;
    }, 2000);
  };

  const stopManuellesVorlesen = () => {
    setVorliesNachrichtIndex(null);
    setVorliesOptionIndexManuell(null);
  };

  const gespraechStarten = async (fachParam, themaParam) => {
    const { data, error } = await supabase
      .from("gespraeche")
      .insert({
        kind_id: id,
        fach: fachParam,
        thema: themaParam || "Allgemein",
        gestartet_am: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Fehler beim Starten des Gesprächs:", error);
      return null;
    }

    setGespraechId(data.id);
    gespraechIdRef.current = data.id;
    return data.id;
  };

  const nachrichtSpeichern = async (gespraechIdParam, rolle, inhalt, warRichtig) => {
    if (!gespraechIdParam) return;
    const { error } = await supabase.from("nachrichten").insert({
      gespraech_id: gespraechIdParam,
      rolle,
      inhalt,
      war_richtig: typeof warRichtig === "boolean" ? warRichtig : null,
    });
    if (error) {
      console.error("Fehler beim Speichern der Nachricht:", error);
    }
  };

  const gespraechBeenden = async () => {
    const gid = gespraechIdRef.current;
    if (!gid) return;
    const payload = {
      anzahl_nachrichten: nachrichtenCountRef.current,
      richtige_antworten: richtigRef.current,
      falsche_antworten: falschRef.current,
      stufe_erreicht: stufeRef.current,
      beendet_am: new Date().toISOString(),
    };
    const { error } = await supabase.from("gespraeche").update(payload).eq("id", gid);
    if (error) {
      console.error("Fehler beim Beenden des Gesprächs:", error);
    }
  };

  const nochmalVorlesen = (text, index) => {
    if (!tonAn) {
      zeigeTonAusHinweis();
      return;
    }
    const t = String(text ?? "");
    if (!t.trim()) return;
    if (vorliesNachrichtIndex === index) {
      window.speechSynthesis.cancel();
      stopManuellesVorlesen();
      return;
    }
    window.speechSynthesis.cancel();
    clearPauseTimeout();
    ttsLaufIdRef.current += 1;
    setBlinktNachricht(false);
    setBlinktOptionIndex(null);
    setVorliesOptionIndexManuell(null);
    const utterance = new SpeechSynthesisUtterance(t);
    utterance.lang = "de-DE";
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    setVorliesNachrichtIndex(index);
    utterance.onend = () =>
      setVorliesNachrichtIndex((cur) => (cur === index ? null : cur));
    utterance.onerror = () =>
      setVorliesNachrichtIndex((cur) => (cur === index ? null : cur));
    window.speechSynthesis.speak(utterance);
  };

  const optionTextVorlesen = (optionText, optionIndex) => {
    if (!tonAn) {
      zeigeTonAusHinweis();
      return;
    }
    const t = String(optionText ?? "");
    if (!t.trim()) return;
    if (vorliesOptionIndexManuell === optionIndex) {
      window.speechSynthesis.cancel();
      stopManuellesVorlesen();
      return;
    }
    window.speechSynthesis.cancel();
    clearPauseTimeout();
    ttsLaufIdRef.current += 1;
    setBlinktNachricht(false);
    setBlinktOptionIndex(null);
    setVorliesNachrichtIndex(null);
    const utterance = new SpeechSynthesisUtterance(t);
    utterance.lang = "de-DE";
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    setVorliesOptionIndexManuell(optionIndex);
    utterance.onend = () =>
      setVorliesOptionIndexManuell((cur) =>
        cur === optionIndex ? null : cur
      );
    utterance.onerror = () =>
      setVorliesOptionIndexManuell((cur) =>
        cur === optionIndex ? null : cur
      );
    window.speechSynthesis.speak(utterance);
  };

  const alleVorlesen = (antwort, optionen) => {
    if (!tonAnRef.current) return;
    const opts = Array.isArray(optionen) ? optionen : [];
    window.speechSynthesis.cancel();
    clearPauseTimeout();
    const runId = ++ttsLaufIdRef.current;
    setBlinktOptionIndex(null);
    setBlinktNachricht(true);

    const u1 = new SpeechSynthesisUtterance(String(antwort));
    u1.lang = "de-DE";
    u1.rate = 0.85;
    u1.pitch = 1.1;
    u1.onend = () => {
      if (ttsLaufIdRef.current !== runId) return;
      setBlinktNachricht(false);
      const optionenVorlesen = opts.length > 0 && tonAnRef.current;
      if (!optionenVorlesen) return;
      pauseTimeoutRef.current = setTimeout(() => {
        if (ttsLaufIdRef.current !== runId) return;
        const intro = new SpeechSynthesisUtterance("Du kannst wählen.");
        intro.lang = "de-DE";
        intro.rate = 0.85;
        intro.pitch = 1.1;
        intro.onerror = () => {
          if (ttsLaufIdRef.current !== runId) return;
          setBlinktOptionIndex(null);
        };
        intro.onend = () => {
          if (ttsLaufIdRef.current !== runId) return;
          const naechsteOption = (idx) => {
            if (idx >= opts.length) {
              setBlinktOptionIndex(null);
              return;
            }
            let prefix;
            if (idx === 3) prefix = "Oder: ";
            else if (idx < 3) {
              const nummern = ["Erste", "Zweite", "Dritte"];
              prefix = `${nummern[idx]} Möglichkeit: `;
            } else {
              prefix = `Möglichkeit ${idx + 1}: `;
            }
            const u = new SpeechSynthesisUtterance(prefix + opts[idx]);
            u.lang = "de-DE";
            u.rate = 0.85;
            u.pitch = 1.1;
            setBlinktOptionIndex(idx);
            u.onerror = () => {
              if (ttsLaufIdRef.current !== runId) return;
              setBlinktOptionIndex(null);
            };
            u.onend = () => {
              if (ttsLaufIdRef.current !== runId) return;
              setBlinktOptionIndex(null);
              naechsteOption(idx + 1);
            };
            window.speechSynthesis.speak(u);
          };
          naechsteOption(0);
        };
        window.speechSynthesis.speak(intro);
      }, 1000);
    };
    u1.onerror = () => {
      if (ttsLaufIdRef.current !== runId) return;
      setBlinktNachricht(false);
    };
    window.speechSynthesis.speak(u1);
  };

  useEffect(() => {
    if (!profile || tonAnInitialisiert.current) return;
    tonAnInitialisiert.current = true;
    const k =
      profile.klasse != null && !Number.isNaN(Number(profile.klasse))
        ? Number(profile.klasse)
        : 5;
    const on = k <= 4;
    tonAnRef.current = on;
    setTonAn(on);
  }, [profile]);

  const toggleTon = () => {
    if (tonAn) {
      window.speechSynthesis.cancel();
      clearPauseTimeout();
      ttsLaufIdRef.current += 1;
      setBlinktNachricht(false);
      setBlinktOptionIndex(null);
      stopManuellesVorlesen();
      setTonAn(false);
      tonAnRef.current = false;
    } else {
      setTonAn(true);
      tonAnRef.current = true;
    }
  };

  const wechsleFach = (neu) => {
    if (neu === fach) return;
    window.speechSynthesis.cancel();
    clearPauseTimeout();
    ttsLaufIdRef.current += 1;
    setBlinktNachricht(false);
    setBlinktOptionIndex(null);
    stopManuellesVorlesen();
    setFach(neu);
    setNachrichten([]);
    setOptionen([]);
    setEingabe("");
    setStartEingabe("");
    setAntwortAuswahlAnzeige(null);
    setAktivesStartThema(null);
    setGespraechId(null);
    gespraechIdRef.current = null;
    setRichtig(0);
    setFalsch(0);
    richtigRef.current = 0;
    falschRef.current = 0;
    stufeRef.current = 1;
  };

  // Gespräch beenden, wenn zurück zum Dashboard navigiert wird (oder Tab geschlossen)
  useEffect(() => {
    const onBeforeUnload = () => {
      void gespraechBeenden();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearPauseTimeout();
      setBlinktNachricht(false);
      setBlinktOptionIndex(null);
      if (tonHinweisTimeoutRef.current) {
        clearTimeout(tonHinweisTimeoutRef.current);
      }
      void gespraechBeenden();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setProfilLaedt(true);
      setProfilFehler("");
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) {
          router.replace("/einloggen");
          return;
        }
        if (!id) {
          setProfilFehler("Kein Profil.");
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("id, fantasy_name, klasse, avatar, parent_id")
          .eq("id", id)
          .single();
        if (ignore) return;
        if (error) {
          setProfilFehler("Profil nicht gefunden.");
          return;
        }
        if (data.parent_id && data.parent_id !== auth.user.id) {
          setProfilFehler("Kein Zugriff auf dieses Profil.");
          return;
        }
        setProfile(data);
      } catch {
        if (!ignore) setProfilFehler("Etwas ist schiefgelaufen.");
      } finally {
        if (!ignore) setProfilLaedt(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [id, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nachrichten]);

  const fortschrittSpeichern = async (kindId, fachParam, thema, stufe) => {
    if (!kindId?.trim()) {
      console.warn("fortschrittSpeichern: kindId fehlt");
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      console.warn("fortschrittSpeichern: keine Session — nicht eingeloggt?");
      return;
    }

    const { error } = await supabase.from("fortschritt").insert({
      kind_id: kindId,
      fach: fachParam,
      thema: thema || "Allgemein",
      stufe: stufe && stufe >= 1 && stufe <= 5 ? stufe : 1,
    });

    if (error) {
      console.error("Fehler beim Speichern in ‚fortschritt‘:", error);
    }
  };

  const sendeAnAPI = async (text, opts = {}) => {
    const t = String(text || "").trim();
    if (!t || laedt) return;

    window.speechSynthesis.cancel();
    clearPauseTimeout();
    ttsLaufIdRef.current += 1;
    setBlinktNachricht(false);
    setBlinktOptionIndex(null);
    stopManuellesVorlesen();

    if (opts.vonOption) {
      setAntwortAuswahlAnzeige({ text: t });
    } else {
      setAntwortAuswahlAnzeige(null);
    }

    let gid = gespraechIdRef.current;
    if (!gid) {
      gid = await gespraechStarten(
        fach,
        opts.thema || aktivesStartThema || "Allgemein",
      );
    }

    const neueNachrichten = [...nachrichten, { role: "user", content: t }];
    setNachrichten(neueNachrichten);
    setEingabe("");
    setOptionen([]);
    setLaedt(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: neueNachrichten,
          subject: fach,
          klasse,
          avatar,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNachrichten((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data?.error || "Das hat nicht geklappt.",
          },
        ]);
        return;
      }

      const apiOpts = Array.isArray(data.options) ? data.options : [];
      setNachrichten((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "…" },
      ]);
      setOptionen(apiOpts);

      const assistantRunden =
        neueNachrichten.filter((m) => m.role === "assistant").length + 1;
      const stufe = Math.min(
        5,
        Math.max(1, Math.round(assistantRunden)),
      );
      stufeRef.current = stufe;

      const warRichtig =
        typeof data?.warRichtig === "boolean" ? data.warRichtig : null;
      if (warRichtig === true) setRichtig((v) => v + 1);
      if (warRichtig === false) setFalsch((v) => v + 1);
      const themaKurz =
        t.length > 200 ? `${t.slice(0, 197)}…` : t;
      await fortschrittSpeichern(id, fach, themaKurz, stufe);

      if (gid) {
        await nachrichtSpeichern(gid, "user", t, warRichtig);
        await nachrichtSpeichern(
          gid,
          "assistant",
          String(data.reply ?? "…"),
          null,
        );
      }

      if (tonAnRef.current && data.reply) {
        alleVorlesen(String(data.reply), apiOpts);
      }
    } catch (e) {
      console.error(e);
      setNachrichten((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Verbindungsfehler. Bitte nochmal versuchen.",
        },
      ]);
    } finally {
      setLaedt(false);
      setAntwortAuswahlAnzeige(null);
      setAktivesStartThema(null);
    }
  };

  const startMitEigenerFrage = () => {
    const t = startEingabe.trim();
    if (!t || laedt) return;
    sendeAnAPI(t);
  };

  const startMitThema = (themaKey) => {
    if (laedt) return;
    setAktivesStartThema(themaKey);
    const msg = `Ich möchte zu diesem Thema arbeiten: ${themaKey}. Bitte stelle mir eine sokratische Einstiegsfrage, die mich ins Thema führt. (${fach}, Klasse ${klasse})`;
    sendeAnAPI(msg, { thema: themaKey });
  };

  if (profilLaedt) {
    return (
      <div
        style={{
          background: "#1a1a2e",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        Laden…
      </div>
    );
  }

  if (profilFehler || !profile) {
    return (
      <div
        style={{
          background: "#1a1a2e",
          minHeight: "100vh",
          padding: 24,
          color: "#fff",
        }}
      >
        <p>{profilFehler || "Profil fehlt."}</p>
        <Link
          href="/dashboard"
          style={{ color: "#FFC832", marginTop: 16, display: "inline-block" }}
        >
          ← Zum Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#1a1a2e",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Link
          href="/dashboard"
          style={{ color: "#FFC832", fontSize: 14, marginRight: 4 }}
        >
          ←
        </Link>
        <span style={{ fontSize: "40px" }}>{emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ color: "#FFC832", fontSize: "20px", fontWeight: "bold" }}
          >
            {name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
            {fach} · {klasse}. Klasse · {profile.fantasy_name}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTon}
          style={{
            marginLeft: "auto",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid #FFC832",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label={tonAn ? "Ton aus" : "Ton an"}
        >
          {tonAn ? "🔊" : "🔇"}
        </button>
      </div>

      {tonHinweis ? (
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,200,50,0.4)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: "12px",
            color: "#FFC832",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          {tonHinweis}
        </div>
      ) : null}

      {/* REELS BEREICH */}
      <div
        style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Titel */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
            paddingLeft: "4px",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "11px",
              fontWeight: "500",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Lian & Eli erklären
          </span>
          <span
            style={{
              color: "rgba(255,200,50,0.4)",
              fontSize: "10px",
            }}
          >
            Bald verfügbar
          </span>
        </div>

        {/* Scrollbarer Reels Container */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            paddingBottom: "4px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {[
            { emoji: "🔢", titel: "Bruchrechnen", avatar: "🦁" },
            { emoji: "📖", titel: "Aufsatz schreiben", avatar: "🦋" },
            { emoji: "🔬", titel: "Photosynthese", avatar: "🦁" },
            { emoji: "🌍", titel: "Simple Past", avatar: "🦋" },
            { emoji: "📐", titel: "Fläche berechnen", avatar: "🦁" },
          ].map((reel, i) => (
            <div
              key={i}
              onClick={() => alert("Reels kommen bald!")}
              style={{
                flexShrink: 0,
                width: "90px",
                height: "130px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px",
                position: "relative",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
            >
              {/* Play Icon */}
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  left: "8px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "8px",
                  color: "white",
                }}
              >
                ▶
              </div>

              {/* Avatar oben rechts */}
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  fontSize: "14px",
                }}
              >
                {reel.avatar}
              </div>

              {/* Fach Emoji */}
              <div style={{ fontSize: "28px", marginTop: "16px" }}>
                {reel.emoji}
              </div>

              {/* Titel */}
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  lineHeight: "1.3",
                  fontWeight: "500",
                }}
              >
                {reel.titel}
              </div>

              {/* Gesperrt Overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  right: "8px",
                  fontSize: "10px",
                  color: "rgba(255,200,50,0.5)",
                }}
              >
                🔒
              </div>
            </div>
          ))}

          {/* Mehr anzeigen Karte */}
          <div
            onClick={() => alert("Reels kommen bald!")}
            style={{
              flexShrink: 0,
              width: "90px",
              height: "130px",
              borderRadius: "12px",
              background: "rgba(255,200,50,0.05)",
              border: "0.5px dashed rgba(255,200,50,0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "20px", color: "rgba(255,200,50,0.3)" }}>
              +
            </div>
            <div
              style={{
                fontSize: "9px",
                color: "rgba(255,200,50,0.3)",
                textAlign: "center",
                lineHeight: "1.3",
              }}
            >
              Mehr Reels bald
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: zeigeStartAnsicht ? "20px" : "16px",
        }}
      >
        {FAECHER.map((f) => {
          const aktiv = f === fach;
          return (
            <button
              key={f}
              type="button"
              onClick={() => wechsleFach(f)}
              style={{
                padding: "8px 12px",
                borderRadius: "20px",
                border: "1px solid #FFC832",
                fontSize: "12px",
                cursor: "pointer",
                background: aktiv ? "#FFC832" : "rgba(255,255,255,0.08)",
                color: aktiv ? "#1a1a2e" : "#fff",
                fontWeight: aktiv ? 700 : 500,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {zeigeStartAnsicht ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "20px",
            paddingBottom: "24px",
          }}
        >
          <div>
            <input
              value={startEingabe}
              onChange={(e) => setStartEingabe(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && startEingabe.trim() && !laedt && startMitEigenerFrage()
              }
              placeholder="Was möchtest du heute lernen?"
              disabled={laedt}
              style={{
                width: "100%",
                minHeight: "120px",
                boxSizing: "border-box",
                background: "#ffffff",
                color: "#1a1a2e",
                border: "2px solid #FFC832",
                borderRadius: "16px",
                padding: "16px 18px",
                fontSize: "16px",
                outline: "none",
              }}
            />
            <button
              type="button"
              disabled={laedt || !startEingabe.trim()}
              onClick={startMitEigenerFrage}
              style={{
                marginTop: "12px",
                width: "100%",
                padding: "14px",
                background: "#FFC832",
                color: "#1a1a2e",
                border: "none",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 700,
                cursor:
                  laedt || !startEingabe.trim() ? "not-allowed" : "pointer",
                opacity: laedt || !startEingabe.trim() ? 0.55 : 1,
              }}
            >
              Senden
            </button>
          </div>

          <div
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: "14px",
              letterSpacing: "0.05em",
            }}
          >
            — oder —
          </div>

          <div>
            <div
              style={{
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              Oder wähle ein Thema:
            </div>
            {themenListe.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px" }}>
                Für {fach} in der {klasse}. Klasse gibt es hier keine
                Themenliste. Stell oben eine eigene Frage.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {themenListe.map(({ key, label }) => {
                  const gold = aktivesStartThema === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={laedt}
                      onClick={() => startMitThema(key)}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderRadius: "12px",
                        border: "1px solid #FFC832",
                        fontSize: "14px",
                        cursor: laedt ? "not-allowed" : "pointer",
                        background: gold ? "#FFC832" : "rgba(0,0,0,0.25)",
                        color: gold ? "#1a1a2e" : "#fff",
                        fontWeight: gold ? 600 : 500,
                        opacity: laedt ? 0.65 : 1,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {laedt && (
            <div style={{ color: "#FFC832", textAlign: "center" }}>
              {name} denkt nach…
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: "20px" }}>
            {nachrichten.map((msg, i) => {
              const letzteAssistent =
                msg.role === "assistant" && i === nachrichten.length - 1;
              const blinkMsg = blinktNachricht && letzteAssistent;
              if (msg.role === "user") {
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        background: "#FFC832",
                        color: "#1a1a2e",
                        padding: "12px 16px",
                        borderRadius: "16px",
                        maxWidth: "80%",
                        fontSize: "14px",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    className={`chat-assistant-row${!tonAn ? " chat-assistant-ton-aus" : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      maxWidth: "min(92%, 520px)",
                    }}
                  >
                    <div
                      className={blinkMsg ? "blinkt" : undefined}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        padding: "12px 16px",
                        borderRadius: "16px",
                        flex: "1 1 auto",
                        minWidth: 0,
                        fontSize: "14px",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>
                    <button
                      type="button"
                      onClick={() => nochmalVorlesen(msg.content, i)}
                      disabled={!msg.content?.trim()}
                      className={`vorles-btn-nachricht${vorliesNachrichtIndex === i ? " vorles-btn-aktiv" : ""}`}
                      title="Nochmals vorlesen"
                      aria-label="Nochmals vorlesen"
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "16px",
                        cursor: !msg.content?.trim() ? "not-allowed" : "pointer",
                        padding: "4px",
                        flexShrink: 0,
                        marginTop: "8px",
                        filter: !tonAn ? "grayscale(0.4)" : undefined,
                      }}
                    >
                      {vorliesNachrichtIndex === i ? "⏸️" : "🔊"}
                    </button>
                  </div>
                </div>
              );
            })}

            {laedt && (
              <div style={{ color: "#FFC832", padding: "12px" }}>
                {name} denkt nach…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {antwortAuswahlAnzeige && laedt ? (
            <div style={{ marginBottom: "12px" }}>
              <button
                type="button"
                disabled
                style={{
                  width: "100%",
                  background: "#FFC832",
                  color: "#1a1a2e",
                  border: "1px solid #FFC832",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  cursor: "default",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              >
                {antwortAuswahlAnzeige.text}
              </button>
            </div>
          ) : (
            optionen.length > 0 && (
              <div
                style={{
                  marginBottom: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {optionen.map((option, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      disabled={laedt}
                      onClick={() => sendeAnAPI(option, { vonOption: true })}
                      className={blinktOptionIndex === i ? "blinkt" : undefined}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        border: "1px solid #FFC832",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        fontSize: "14px",
                        cursor: laedt ? "not-allowed" : "pointer",
                        textAlign: "left",
                        opacity: laedt ? 0.6 : 1,
                      }}
                    >
                      {option}
                    </button>
                    <button
                      type="button"
                      disabled={laedt}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        optionTextVorlesen(option, i);
                      }}
                      title={
                        vorliesOptionIndexManuell === i
                          ? "Anhalten"
                          : "Option vorlesen"
                      }
                      aria-label={
                        vorliesOptionIndexManuell === i
                          ? "Vorlesen anhalten"
                          : "Option vorlesen"
                      }
                      style={{
                        flexShrink: 0,
                        background:
                          !tonAn
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(255,255,255,0.1)",
                        border: "1px solid #FFC832",
                        borderRadius: "12px",
                        width: "44px",
                        height: "44px",
                        fontSize: "16px",
                        cursor: laedt ? "not-allowed" : "pointer",
                        opacity: laedt ? 0.5 : !tonAn ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        filter: !tonAn ? "grayscale(0.35)" : undefined,
                      }}
                    >
                      {vorliesOptionIndexManuell === i ? "⏸️" : "🔊"}
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                eingabe.trim() &&
                !laedt &&
                sendeAnAPI(eingabe)
              }
              placeholder="Oder schreib deine eigene Antwort..."
              disabled={laedt}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid #FFC832",
                borderRadius: "24px",
                padding: "12px 16px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <button
              type="button"
              disabled={laedt}
              onClick={() => eingabe.trim() && !laedt && sendeAnAPI(eingabe)}
              style={{
                background: "#FFC832",
                color: "#1a1a2e",
                border: "none",
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                fontSize: "20px",
                cursor: laedt ? "not-allowed" : "pointer",
                opacity: laedt ? 0.6 : 1,
              }}
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
