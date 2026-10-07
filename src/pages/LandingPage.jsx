import { Link } from "react-router-dom";
import { Tag, Bell, Link2, ArrowRight } from "lucide-react";
import Logo from "../components/Logo";
import { ACCENT } from "../theme";

const HERO_NODES = [
  { x: 420, y: 90, r: 14, fill: ACCENT, label: "Ты" },
  { x: 250, y: 60, r: 6, fill: "#8a8a92" },
  { x: 160, y: 130, r: 5, fill: "#8a8a92" },
  { x: 300, y: 170, r: 7, fill: "#a89bf5" },
  { x: 520, y: 40, r: 5, fill: "#8a8a92" },
  { x: 610, y: 110, r: 6, fill: "#8a8a92" },
  { x: 560, y: 190, r: 8, fill: "#a89bf5" },
  { x: 690, y: 60, r: 5, fill: "#8a8a92" },
  { x: 700, y: 170, r: 5, fill: "#8a8a92" },
  { x: 380, y: 220, r: 5, fill: "#8a8a92" },
  { x: 220, y: 220, r: 6, fill: "#8a8a92" },
];

const HERO_EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10],
  [1, 2], [4, 5], [5, 7], [6, 8], [9, 10],
];

function HeroGraph() {
  return (
    <svg viewBox="0 0 760 260" style={{ width: "100%", height: "auto", display: "block" }}>
      {HERO_EDGES.map(([a, b], i) => {
        const n1 = HERO_NODES[a];
        const n2 = HERO_NODES[b];
        return (
          <line
            key={i}
            x1={n1.x}
            y1={n1.y}
            x2={n2.x}
            y2={n2.y}
            stroke={a === 0 || b === 0 ? ACCENT : "#3a3a42"}
            strokeWidth={a === 0 || b === 0 ? 1 : 0.7}
            opacity={a === 0 || b === 0 ? 0.5 : 0.35}
          />
        );
      })}
      {HERO_NODES.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.fill} opacity={i === 0 ? 1 : 0.9} />
          {n.label && (
            <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontSize="11" fill="#9a9aa2">
              {n.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const FEATURES = [
  {
    icon: Link2,
    title: "Каждая нить помнит контекст",
    text: "Не просто список контактов — у каждой связи есть история: где вы познакомились и что вас связывает.",
  },
  {
    icon: Tag,
    title: "Категории вместо забытых имён",
    text: "Работа, школа, спорт по выходным — знакомые группируются сами, и граф не превращается в кашу из сотни точек.",
  },
  {
    icon: Bell,
    title: "Не теряй тёплые связи",
    text: "Планируем напоминания о людях, с которыми давно не общались. Эта возможность пока недоступна.",
  },
];

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#161618",
        color: "#dcdde1",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          borderBottom: "1px solid #212124",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Logo size={22} />
          <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "0.01em" }}>Silk Node</span>
        </div>
        <Link to="/login" style={{ fontSize: 13, color: "#9a9aa2", cursor: "pointer", textDecoration: "none" }}>
          Войти
        </Link>
      </div>

      <div style={{ padding: "56px 32px 24px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.25, margin: 0, letterSpacing: "-0.01em" }}>
          Кто все эти люди и откуда я их знаю?
        </h1>
        <p style={{ fontSize: 15, color: "#9a9aa2", lineHeight: 1.6, marginTop: 16 }}>
          Silk Node — визуальная карта твоих знакомств. Каждая нить хранит историю:
          как вы познакомились и что вас связывает, — чтобы ты никого не забывал.
        </p>
        <Link
          to="/register"
          style={{
            marginTop: 24,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: ACCENT,
            border: "none",
            borderRadius: 6,
            padding: "12px 22px",
            color: "#161618",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          Создать свой граф
          <ArrowRight size={15} />
        </Link>
      </div>

      <div style={{ padding: "8px 24px 8px", maxWidth: 900, margin: "0 auto", opacity: 0.9 }}>
        <HeroGraph />
      </div>

      <div style={{ display: "flex", gap: 1, background: "#212124", borderTop: "1px solid #212124" }}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              style={{
                flex: 1,
                background: "#161618",
                padding: "26px clamp(24px, 6vw, 64px)",
              }}
            >
              <Icon size={17} color={ACCENT} />
              <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 12, color: "#dcdde1" }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: "#84848c", marginTop: 6, lineHeight: 1.55, maxWidth: 280 }}>
                {f.text}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "16px 32px",
          borderTop: "1px solid #212124",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "#5c5c63",
        }}
      >
        <span>Silk Node</span>
        <span>Твои данные видны только тебе</span>
      </div>
    </div>
  );
}
