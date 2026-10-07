import { useState } from "react";
import TopNav from "../components/TopNav";
import EditPersonModal from "../components/EditPersonModal";
import DataStatus from "../components/DataStatus";
import { useAuth } from "../context/AuthContext";
import { useGraphData } from "../hooks/useGraphData";
import Button from "../components/Button";

function Row({ title, description, children }) {
  return <div style={{ padding: "14px 0", borderTop: "1px solid #26262a" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: 13 }}>{title}{children}</div>
    {description && <div style={{ fontSize: 12, color: "#84848c", marginTop: 5 }}>{description}</div>}
  </div>;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { people, isLoading, error, refetch } = useGraphData();
  const [editing, setEditing] = useState(false);
  const selfPerson = people.find((person) => person.id === "you");
  const unavailable = <Button disabled>Пока недоступно</Button>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#161618" }}>
      <TopNav />
      <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: 20 }}>Настройки</h1>
          <DataStatus isLoading={isLoading} error={error} onRetry={refetch} />
          <h2 style={{ fontSize: 15, marginTop: 28 }}>Аккаунт и карточка</h2>
          <Row title="Почта" description="Используется для входа. Изменение почты пока недоступно."><span>{user?.email}</span></Row>
          <Row title={`Имя карточки «Ты»: ${selfPerson?.rawName || "—"}`} description="Имя и заметка сохраняются в твоей карточке человека.">
            <Button disabled={!selfPerson || !!error} onClick={() => setEditing(true)}>Изменить карточку</Button>
          </Row>
          <h2 style={{ fontSize: 15, marginTop: 28 }}>Запланированные возможности</h2>
          <Row title="Акцентный цвет" description="Выбор и сохранение темы пока недоступны.">{unavailable}</Row>
          <Row title="Напоминания" description="Уведомления о людях, с которыми давно не общались, пока недоступны.">{unavailable}</Row>
          <Row title="Настройки приватности" description="Данные графа относятся к твоему аккаунту. Управление доступом и публикация пока недоступны.">{unavailable}</Row>
          <Row title="Экспорт данных" description="Скачивание графа в JSON пока недоступно.">{unavailable}</Row>
          <Row title="Удаление данных" description="Удаление людей, связей и всего графа пока недоступно.">{unavailable}</Row>
        </div>
      </main>
      {editing && selfPerson && <EditPersonModal person={selfPerson} onClose={() => setEditing(false)} />}
    </div>
  );
}
