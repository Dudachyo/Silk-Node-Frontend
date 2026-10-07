// Shared design tokens. Keeping these in one place means every page —
// landing, home, graph, settings — stays visually consistent, and a future
// theme picker (see Settings > Внешний вид) only has to update this file.

export const ACCENT = "#7c6ff0";
export const GOLD = "#d9a94e";
export const NODE_FILL = "#b0b3ba";

export const BG = "#161618";
export const PANEL = "#1c1c1f";
export const BORDER = "#26262a";
export const BORDER_SOFT = "#29292d";
export const TEXT = "#dcdde1";
export const TEXT_MUTED = "#9a9aa2";
export const TEXT_FAINT = "#6a6a72";

export const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const BUTTON_STYLES = {
  secondary: {
    background: "#26262b", border: "1px solid #33333a", borderRadius: 5,
    padding: "6px 10px", color: "#c8c9ce", fontSize: 12,
    fontFamily: FONT_FAMILY, cursor: "pointer", flexShrink: 0,
  },
  primary: {
    background: ACCENT, border: "none", borderRadius: 6,
    padding: "10px 0", color: BG, fontSize: 13, fontWeight: 600,
    fontFamily: FONT_FAMILY, cursor: "pointer",
  },
  icon: {
    background: "transparent", border: "none", borderRadius: 4,
    padding: 4, color: TEXT_FAINT, display: "inline-flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
    flexShrink: 0,
  },
};
