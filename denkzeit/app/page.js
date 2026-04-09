import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col px-6 sm:px-10">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div className="text-center flex flex-col items-center">
            <div
              className="text-[84px] sm:text-[96px] leading-none mb-4"
              aria-hidden="true"
            >
              🦁
            </div>

            <h1 className="text-[#FFC832] text-5xl sm:text-7xl font-extrabold tracking-tight">
              Denkzeit
            </h1>

            <p className="mt-4 text-white text-lg sm:text-2xl font-medium">
              Dein sokratischer Lernbegleiter
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                href="/registrieren"
                className="w-full sm:w-auto rounded-full bg-[#FFC832] text-[#1a1a2e] font-semibold px-7 py-3 text-base sm:text-lg hover:bg-[#e6b92e] transition-colors"
              >
                Als Elternteil registrieren
              </Link>

              <Link
                href="/einloggen"
                className="w-full sm:w-auto rounded-full border border-white/90 text-white font-semibold px-7 py-3 text-base sm:text-lg bg-transparent hover:bg-white/10 transition-colors"
              >
                Bereits registriert? Einloggen
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="pb-8 text-center text-white/80 text-sm sm:text-base">
        Für Schweizer Schüler 1.–9. Klasse &middot; Lehrplan 21
      </footer>
    </div>
  );
}
