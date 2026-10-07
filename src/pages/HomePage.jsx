import { useMemo, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import { useGraphData } from "../hooks/useGraphData";
import { ACCENT } from "../theme";
import DataStatus from "../components/DataStatus";

export default function HomePage() {
  const [query, setQuery] = useState("");

  const { people, relationships, isLoading, isError, error, refetch } = useGraphData();

  // categories are derived from the distinct "via" values on connections,
  // same clustering logic the graph page uses
  const categoryCount = useMemo(
    () => new Set(relationships.filter((r) => r.source === "you" || r.target === "you").map((r) => r.via)).size,
    [relationships]
  );

  // The API has no person timestamps; this is a people list, not a timeline.
  const recentPeople = useMemo(() => {
    const relBySelf = {};
    relationships.forEach((r) => {
      if (r.source === "you") relBySelf[r.target] = r.via;
      if (r.target === "you") relBySelf[r.source] = r.via;
    });
    return people
      .filter((p) => p.id !== "you")
      .map((p) => ({ id: p.id, name: p.name, via: relBySelf[p.id] || "без категории" }))
      .filter((p) => `${p.name} ${p.via}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [people, relationships, query]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#161618",
      }}
    >
      <TopNav />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#dcdde1" }}>С возвращением</div>
          <div style={{ fontSize: 13, color: "#6a6a72", marginTop: 4 }}>
            {isLoading
              ? "Загружаем твой граф…"
              : `${Math.max(people.length - 1, 0)} знакомых · ${categoryCount} категорий`}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1c1c1f",
              border: "1px solid #29292d",
              borderRadius: 6,
              padding: "10px 14px",
              marginTop: 20,
            }}
          >
            <Search size={15} color="#6f6f77" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти человека или категорию"
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

          <DataStatus error={error} onRetry={refetch} />
          <div style={{ marginTop: 32 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "#dcdde1" }}>Люди в твоём графе</span>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {isLoading ? (
                <div style={{ fontSize: 12.5, color: "#5c5c63", padding: "9px 14px" }}>Загрузка…</div>
              ) : isError ? null : recentPeople.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#5c5c63", padding: "9px 14px" }}>
                  {query.trim() ? "Никого не найдено" : "Пока никого не добавлено"}
                </div>
              ) : (
                recentPeople.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 14px",
                      background: "#1c1c1f",
                      border: "1px solid #26262a",
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13, color: "#dcdde1" }}>{p.name}</span>
                      <span style={{ fontSize: 11.5, color: "#6a6a72", marginLeft: 8 }}>{p.via}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            to="/graph"
            style={{
              marginTop: 28,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: ACCENT,
              border: "none",
              borderRadius: 6,
              padding: "12px 0",
              color: "#161618",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Открыть граф связей
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
