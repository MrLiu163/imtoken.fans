"use client";

import { useTranslations } from "next-intl";

// 首屏角落的小角色：眼睛跟着指针走，整体轻微漂浮。
// 刻意做成简单几何形状，不抢标题，也不做成会说话的吉祥物。
export function HeroCompanion() {
  const t = useTranslations("home");

  return (
    <div className="hero-companion hidden lg:block" aria-label={t("companionLabel")}>
      <svg viewBox="0 0 180 180" className="h-full w-full" role="img" aria-hidden>
        <defs>
          <linearGradient id="companion-body" x1="20%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="45%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <radialGradient id="companion-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,.7)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <ellipse cx="90" cy="150" rx="38" ry="8" fill="rgba(15,23,42,.08)" className="companion-shadow" />
        <g className="companion-body">
          <path
            d="M90 38c-28 0-52 26-52 62 0 28 20 50 52 50s52-22 52-50c0-36-24-62-52-62z"
            fill="url(#companion-body)"
          />
          <path d="M90 46c-18 0-34 14-38 36 8-16 22-26 38-26 16 0 30 10 38 26-4-22-20-36-38-36z" fill="url(#companion-glow)" />
          <circle cx="58" cy="108" r="9" fill="#fda4af" opacity=".38" />
          <circle cx="122" cy="108" r="9" fill="#fda4af" opacity=".38" />
          <g className="companion-eyes">
            <ellipse cx="70" cy="96" rx="9" ry="11" fill="#0f172a" />
            <ellipse cx="110" cy="96" rx="9" ry="11" fill="#0f172a" />
            <circle cx="73" cy="92" r="3" fill="white" />
            <circle cx="113" cy="92" r="3" fill="white" />
          </g>
          <path d="M78 122q12 12 24 0" fill="none" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round" />
          <g className="companion-spark">
            <path d="M90 18 94 32 108 36 94 40 90 54 86 40 72 36 86 32z" fill="#fde68a" />
          </g>
        </g>
      </svg>
    </div>
  );
}
