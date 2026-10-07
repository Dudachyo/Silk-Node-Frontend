import { ACCENT } from "../theme";

// The mark: a center node with three silk-like threads reaching out to
// smaller nodes. Same shape used in /public/favicon and the marketing site.
export default function Logo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      <path d="M60,60 C75,48 48,30 60,18" fill="none" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      <path d="M60,60 C85,55 100,68 96.4,81" fill="none" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      <path d="M60,60 C35,55 20,68 23.6,81" fill="none" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      <circle cx="60" cy="18" r="9" fill="#a89bf5" />
      <circle cx="96.4" cy="81" r="9" fill="#a89bf5" />
      <circle cx="23.6" cy="81" r="9" fill="#a89bf5" />
      <circle cx="60" cy="60" r="18" fill="#a89bf5" />
    </svg>
  );
}
