import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import Logo from "../components/Logo";
import { ACCENT } from "../theme";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

function Field({ icon: Icon, ...props }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#1c1c1f",
        border: "1px solid #29292d",
        borderRadius: 6,
        padding: "10px 12px",
      }}
    >
      <Icon size={15} color="#6f6f77" />
      <input
        {...props}
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#c8c9ce",
          fontSize: 13.5,
          width: "100%",
        }}
      />
    </div>
  );
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setIsSubmitting(true);
    try {
      await register(email, password);
      navigate("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать аккаунт. Попробуй ещё раз");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#161618",
        color: "#dcdde1",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 340 }}>
        <Link
          to="/"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginBottom: 28,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Logo size={26} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Silk Node</span>
        </Link>

        <div style={{ fontSize: 18, fontWeight: 600, textAlign: "center" }}>Создать граф</div>
        <div style={{ fontSize: 12.5, color: "#84848c", textAlign: "center", marginTop: 4 }}>
          Займёт минуту — дальше добавляй знакомых сам
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <Field
            icon={Mail}
            type="email"
            placeholder="Почта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            icon={Lock}
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#e0685f", marginTop: 12, lineHeight: 1.4 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: 20,
            width: "100%",
            background: ACCENT,
            border: "none",
            borderRadius: 6,
            padding: "11px 0",
            color: "#161618",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: isSubmitting ? "default" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? "Создаём…" : "Создать аккаунт"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#5c5c63", lineHeight: 1.5 }}>
          Регистрируясь, ты соглашаешься, что заметки о людях видны только тебе
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: "#84848c" }}>
          Уже есть аккаунт?{" "}
          <Link to="/login" style={{ color: ACCENT, textDecoration: "none" }}>
            Войти
          </Link>
        </div>
      </form>
    </div>
  );
}
