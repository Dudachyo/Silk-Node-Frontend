import { X } from "lucide-react";
import Button from "./Button";

export const inputStyle = {
  background: "#161618", border: "1px solid #29292d", borderRadius: 5,
  padding: "8px 10px", fontSize: 13, color: "#c8c9ce", outline: "none",
  width: "100%", fontFamily: "inherit",
};

export function Field({ label, children }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#84848c" }}>{label}{children}</label>;
}

export default function Modal({ title, busy, error, submitLabel, onClose, onSubmit, children }) {
  const close = () => { if (!busy) onClose(); };
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <form role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}
        style={{ width: 380, maxWidth: "calc(100vw - 32px)", maxHeight: "90vh", overflowY: "auto", background: "#1c1c1f", border: "1px solid #29292d", borderRadius: 8, padding: 20, color: "#dcdde1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <Button variant="icon" aria-label="Закрыть" disabled={busy} onClick={close}><X size={16} /></Button>
        </div>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>{children}</fieldset>
        {error && <div role="alert" style={{ fontSize: 12, color: "#e0685f", marginTop: 12 }}>{error}</div>}
        <Button variant="primary" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
          {busy ? "Сохраняем…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}
