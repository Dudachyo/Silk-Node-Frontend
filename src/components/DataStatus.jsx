import Button from "./Button";

export default function DataStatus({ isLoading, error, onRetry }) {
  if (!isLoading && !error) return null;
  return (
    <div role={error ? "alert" : "status"} style={{ padding: 14, fontSize: 13, color: error ? "#e0685f" : "#84848c" }}>
      {error ? error.message : "Загружаем данные…"}
      {error && <Button onClick={onRetry} style={{ marginLeft: 10 }}>Повторить</Button>}
    </div>
  );
}
