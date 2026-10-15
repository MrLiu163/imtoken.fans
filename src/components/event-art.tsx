const ART = {
  ember: (
    <svg className="event-art" viewBox="0 0 280 220" aria-hidden>
      <path d="M186 28c28 18 48 62 18 108-22 34-78 62-118 38-36-22-18-78 14-108 28-26 62-52 86-38z" fill="#fde68a" opacity=".9" />
      <path d="M168 46c22 14 32 48 8 84-18 26-62 46-92 26-24-16-8-58 16-82 22-22 50-42 68-28z" fill="#fb923c" opacity=".55" />
      <circle cx="214" cy="54" r="10" fill="#fff7ed" />
      <circle cx="96" cy="168" r="7" fill="#fdba74" />
      <path d="M210 92c18-8 42 10 28 32-12 18-40 14-48-4-6-14 6-22 20-28z" fill="#ea580c" opacity=".45" />
    </svg>
  ),
  indigo: (
    <svg className="event-art" viewBox="0 0 280 220" aria-hidden>
      <circle cx="188" cy="72" r="64" fill="#c4b5fd" opacity=".55" />
      <circle cx="148" cy="118" r="72" fill="#818cf8" opacity=".35" />
      <circle cx="216" cy="128" r="48" fill="#e0e7ff" opacity=".8" />
      <circle cx="168" cy="64" r="22" fill="#a5b4fc" />
    </svg>
  ),
  paper: (
    <svg className="event-art" viewBox="0 0 280 220" aria-hidden>
      <path d="M40 170c28-22 48-18 70 4 24 24 52 18 78-8 22-22 50-20 74 6" fill="none" stroke="#99f6e4" strokeWidth="10" />
      <path d="M52 132c26-24 56-16 78 8 24 26 58 16 86-12 20-20 46-14 64 8" fill="none" stroke="#5eead4" strokeWidth="8" />
      <path d="M70 96c22-20 50-12 70 10 22 24 54 14 78-10" fill="none" stroke="#2dd4bf" strokeWidth="6" />
      <circle cx="214" cy="58" r="16" fill="#ccfbf1" />
    </svg>
  ),
  rose: (
    <svg className="event-art" viewBox="0 0 280 220" aria-hidden>
      <path d="M20 168c30-28 62-48 108-44 40 4 62 28 92 18 22-8 40-6 60 8v50H20z" fill="#fecdd3" />
      <path d="M8 188c36-40 78-70 138-52 46 14 70 8 106-10v62H8z" fill="#fda4af" opacity=".85" />
      <circle cx="196" cy="58" r="28" fill="#fed7aa" />
      <path d="M168 128c18-36 52-36 70 0 8 16-6 28-22 28h-26c-16 0-30-12-22-28z" fill="#fb7185" />
    </svg>
  ),
} as const;

export function EventArt({ tone }: { tone: keyof typeof ART }) {
  return ART[tone];
}
