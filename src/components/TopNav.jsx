import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Logo from "./Logo";
import { PANEL, BORDER, TEXT, TEXT_FAINT } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

// "Избранное" doesn't have its own page yet — favorites live inside the
// graph's sidebar — so it routes into /graph for now. Give it a real page
// once favorites need to be browsable outside the graph.
const NAV_ITEMS = [
  { label: "Главная", to: "/home" },
  { label: "Граф", to: "/graph" },
  { label: "Избранное", to: "/graph" },
  { label: "Настройки", to: "/settings" },
];

export default function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isLoggingOut } = useAuth();
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await logout();
      navigate("/login");
    } catch (error) { setLogoutError(error.message || "Не удалось выйти"); }
  };

  return (
    <div
      style={{
        height: 44,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <Link to="/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <Logo />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: TEXT, letterSpacing: "0.01em" }}>
          Silk Node
        </span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            style={{
              fontSize: 12,
              color: pathname === item.to ? TEXT : TEXT_FAINT,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {item.label}
          </Link>
        ))}
        {user?.email && (
          <span style={{ fontSize: 11.5, color: TEXT_FAINT }}>{user.email}</span>
        )}
        {logoutError && <span role="alert" style={{ fontSize: 12, color: "#e0685f" }}>{logoutError}</span>}
        <button type="button" aria-label="Выйти из аккаунта" disabled={isLoggingOut} onClick={handleLogout} style={{ border: 0, background: "transparent", display: "flex", padding: 0 }}><LogOut
          size={15}
          color={TEXT_FAINT}
          style={{ cursor: "pointer" }}
        /></button>
      </div>
    </div>
  );
}
