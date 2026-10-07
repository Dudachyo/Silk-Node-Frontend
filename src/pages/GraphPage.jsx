import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { Search, X, Star, ChevronRight, ChevronDown, Plus, Pencil } from "lucide-react";
import TopNav from "../components/TopNav";
import AddPersonModal from "../components/AddPersonModal";
import AddConnectionModal from "../components/AddConnectionModal";
import EditPersonModal from "../components/EditPersonModal";
import { useGraphData } from "../hooks/useGraphData";
import { useUpdatePerson } from "../hooks/usePersons";
import { ACCENT, GOLD, NODE_FILL } from "../theme";
import DataStatus from "../components/DataStatus";

function PersonRow({ person, isFavorite, isSelected, peerCount, onSelect, onToggleFavorite, isSaving }) {
  return (
    <div
      onClick={() => onSelect(person.id)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px 6px 26px",
        cursor: "pointer",
        background: isSelected ? "#26262b" : "transparent",
        borderRadius: 4,
      }}
    >
      <span style={{ fontSize: 12.5, color: "#c8c9ce" }}>{person.name}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {peerCount > 0 && (
          <span style={{ fontSize: 10.5, color: peerCount >= 3 ? ACCENT : "#5c5c63" }}>{peerCount}</span>
        )}
        <button type="button" aria-label={`${isFavorite ? "Убрать из избранного" : "В избранное"}: ${person.name}`} disabled={isSaving}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(person.id); }}
          style={{ border: 0, background: "transparent", padding: 0, display: "flex" }}>
        <Star
          size={13}
          color={isFavorite ? GOLD : "#4d4d54"}
          fill={isFavorite ? GOLD : "none"}
          style={{ cursor: "pointer", flexShrink: 0 }}
        />
        </button>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const simRef = useRef(null);
  const draggingRef = useRef(null);
  const positionsRef = useRef({});
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [selected, setSelected] = useState("you");
  const [hovered, setHovered] = useState(null);
  const [query, setQuery] = useState("");
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [manualExpanded, setManualExpanded] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);
  const activeFocus = focusId;

  const { people: PEOPLE, relationships: RELATIONSHIPS, selfId, isLoading, isError, error, refetch } = useGraphData();
  const updatePerson = useUpdatePerson();
  const favoriteBusy = useRef(false);

  // Derived straight from the backend's is_favourite, not local-only state —
  // otherwise a person favourited elsewhere (e.g. the edit modal, or a
  // previous session) wouldn't show as favourited here, and vice versa.
  const favorites = useMemo(
    () => new Set(PEOPLE.filter((p) => p.isFavourite).map((p) => p.id)),
    [PEOPLE]
  );
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addConnectionOpen, setAddConnectionOpen] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editConnection, setEditConnection] = useState(null);

  // Category of a person = the via of their direct connection to you. People
  // with no direct connection to you get no category at all — they aren't
  // put in any cluster, they just show up as a plain node linked to whoever
  // they're actually connected to (see the "uncategorized peers" block in
  // the graph-building effect below).
  const categoryOf = useMemo(() => {
    const map = {};
    RELATIONSHIPS.forEach((r) => {
      if (r.source === "you") map[r.target] = r.via;
      if (r.target === "you") map[r.source] = r.via;
    });
    return map;
  }, [RELATIONSHIPS]);

  const categories = useMemo(() => {
    const groups = {};
    PEOPLE.forEach((p) => {
      if (p.id === "you") return;
      const cat = categoryOf[p.id];
      if (!cat) return;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [PEOPLE, categoryOf]);

  const peerCounts = useMemo(() => {
    const counts = {};
    RELATIONSHIPS.forEach((r) => {
      if (r.source === "you" || r.target === "you") return;
      counts[r.source] = (counts[r.source] || 0) + 1;
      counts[r.target] = (counts[r.target] || 0) + 1;
    });
    return counts;
  }, [RELATIONSHIPS]);

  const graphKey =
    Array.from(manualExpanded).sort().join(",") + "|" + Array.from(favorites).sort().join(",") + "|" + query;

  const toggleCluster = useCallback((cat) => {
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    async (id) => {
      if (favoriteBusy.current) return;
      const person = PEOPLE.find((p) => p.id === id);
      if (!person) return;
      favoriteBusy.current = true;
      try {
        await updatePerson.mutateAsync({ personId: person.apiId, is_favourite: !person.isFavourite });
      } catch {
        // The mutation error is shown next to the graph controls.
      } finally { favoriteBusy.current = false; }
    },
    [PEOPLE, selfId, updatePerson]
  );

  const selectPerson = useCallback(
    (id) => {
      setSelected(id);
      setFocusId(null);
      const cat = categoryOf[id];
      if (cat) {
        setManualExpanded((prev) => {
          if (prev.has(cat)) return prev;
          const next = new Set(prev);
          next.add(cat);
          return next;
        });
      }
    },
    [categoryOf]
  );

  const getPeerConnections = useCallback(
    (id) =>
      RELATIONSHIPS.filter(
        (r) => (r.source === id || r.target === id) && r.source !== "you" && r.target !== "you"
      ).map((r) => {
        const otherId = r.source === id ? r.target : r.source;
        const other = PEOPLE.find((p) => p.id === otherId);
        return { id: otherId, name: other?.name || otherId, via: r.via, strength: r.strength };
      }),
    [RELATIONSHIPS, PEOPLE]
  );

  const enterFocus = useCallback((id) => {
    setFocusId(id);
    setSelected(id);
  }, []);

  const exitFocus = useCallback(() => {
    setFocusId(null);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (isLoading || isError || selfId == null) {
      setNodes([]);
      setLinks([]);
      return;
    }
    let nodeData;
    let linkData;

    if (activeFocus && activeFocus !== "you") {
      const focusPerson = PEOPLE.find((p) => p.id === activeFocus);
      const peers = getPeerConnections(activeFocus);
      const peerIds = new Set(peers.map((p) => p.id));
      const youRel = RELATIONSHIPS.find(
        (r) =>
          (r.source === "you" && r.target === activeFocus) ||
          (r.target === "you" && r.source === activeFocus)
      );

      const ring = [{ id: "you", name: "Ты" }, ...peers];

      if (!focusPerson) { setFocusId(null); return; }
      nodeData = [{ id: activeFocus, name: focusPerson.name, isFocus: true }];
      ring.forEach((p, i) => {
        const angle = (i / Math.max(ring.length, 1)) * Math.PI * 2;
        const seedR = Math.max(140, Math.min(size.w, size.h) / 2 - 80);
        nodeData.push({
          id: p.id,
          name: p.name,
          x: size.w / 2 + Math.cos(angle) * seedR,
          y: size.h / 2 + Math.sin(angle) * seedR,
        });
      });

      nodeData[0].fx = size.w / 2;
      nodeData[0].fy = size.h / 2;

      linkData = [];
      if (youRel) {
        linkData.push({
          source: "you",
          target: activeFocus,
          via: youRel.via,
          strength: youRel.strength,
          isYouLink: true,
        });
      }
      peers.forEach((p) => {
        linkData.push({
          source: activeFocus,
          target: p.id,
          via: p.via,
          strength: p.strength,
          isMemberLink: true,
        });
      });
      RELATIONSHIPS.forEach((r) => {
        if (r.source === activeFocus || r.target === activeFocus) return;
        if (peerIds.has(r.source) && peerIds.has(r.target)) linkData.push({ ...r });
      });
    } else {
      const idsIncluded = new Set(["you"]);
      nodeData = [{ id: "you", name: "Ты" }];

      Object.entries(categories).forEach(([cat, members]) => {
        const clusterId = `cluster:${cat}`;
        const isExpanded = manualExpanded.has(cat) || !!query.trim();
        idsIncluded.add(clusterId);
        const hiddenCount = isExpanded ? 0 : members.filter((m) => !favorites.has(m.id)).length;
        nodeData.push({ id: clusterId, name: cat, isCluster: true, count: hiddenCount });

        const visibleMembers = isExpanded ? members : members.filter((m) => favorites.has(m.id));
        visibleMembers.forEach((m) => {
          idsIncluded.add(m.id);
          nodeData.push({ ...m });
        });
      });

      // Unlinked people must remain visible and editable too.
      PEOPLE.forEach((p) => {
        if (p.id === "you" || idsIncluded.has(p.id) || categoryOf[p.id]) return;
        idsIncluded.add(p.id);
        nodeData.push({ ...p });
      });

      nodeData.forEach((n) => {
        const prevPos = positionsRef.current[n.id];
        if (prevPos) {
          n.x = prevPos.x;
          n.y = prevPos.y;
        }
      });

      linkData = [];
      Object.entries(categories).forEach(([cat, members]) => {
        const clusterId = `cluster:${cat}`;
        const isExpanded = manualExpanded.has(cat) || !!query.trim();

        let maxStrength = 1;
        members.forEach((m) => {
          const rel = RELATIONSHIPS.find(
            (r) =>
              (r.source === "you" && r.target === m.id) ||
              (r.target === "you" && r.source === m.id)
          );
          if (rel && rel.strength > maxStrength) maxStrength = rel.strength;
        });
        linkData.push({ source: "you", target: clusterId, via: cat, strength: maxStrength, isClusterLink: true });

        const visibleMembers = isExpanded ? members : members.filter((m) => favorites.has(m.id));
        visibleMembers.forEach((m) => {
          const rel = RELATIONSHIPS.find(
            (r) =>
              (r.source === "you" && r.target === m.id) ||
              (r.target === "you" && r.source === m.id)
          );
          linkData.push({
            source: clusterId,
            target: m.id,
            via: rel ? rel.via : cat,
            strength: rel ? rel.strength : 1,
            isMemberLink: true,
          });
        });
      });
      RELATIONSHIPS.forEach((r) => {
        if (r.source === "you" || r.target === "you") return;
        if (idsIncluded.has(r.source) && idsIncluded.has(r.target)) {
          linkData.push({ ...r });
        }
      });
    }

    const sim = d3
      .forceSimulation(nodeData)
      .force(
        "link",
        d3
          .forceLink(linkData)
          .id((d) => d.id)
          .distance((l) => {
            if (l.isClusterLink) return 220 - Math.min(l.strength, 3) * 40;
            if (l.isMemberLink)
              return activeFocus ? 190 - Math.min(l.strength, 3) * 25 : 85 - Math.min(l.strength, 3) * 15;
            return activeFocus ? 100 : 60;
          })
          .strength((l) => 0.3 + Math.min(l.strength, 3) * 0.15)
      )
      .force("charge", d3.forceManyBody().strength(activeFocus ? -320 : -160))
      .force("center", activeFocus ? null : d3.forceCenter(size.w / 2, size.h / 2))
      .force(
        "collide",
        d3.forceCollide((n) =>
          n.isCluster ? 22 + Math.sqrt(n.count || 1) * 4 : n.id === "you" || n.isFocus ? 20 : activeFocus ? 22 : 12
        )
      )
      .alphaDecay(0.03)
      .on("tick", () => {
        const list = sim.nodes();
        list.forEach((n) => {
          positionsRef.current[n.id] = { x: n.x, y: n.y };
        });
        setNodes([...list]);
      });

    simRef.current = sim;
    setLinks(linkData);

    return () => sim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PEOPLE, RELATIONSHIPS, graphKey, activeFocus, isLoading, isError, selfId]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (!activeFocus) sim.force("center", d3.forceCenter(size.w / 2, size.h / 2));
    sim.alpha(0.3).restart();
  }, [size, activeFocus]);

  useEffect(() => {
    if (!svgRef.current) return;
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });
    d3.select(svgRef.current).call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;
    return () => d3.select(svgRef.current).on(".zoom", null);
  }, []);

  const resetView = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }, []);

  const onPointerDown = useCallback((e, node) => {
    if (node.isFocus) return;
    e.stopPropagation();
    draggingRef.current = node;
    node.fx = node.x;
    node.fy = node.y;
    simRef.current?.alphaTarget(0.3).restart();
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      const node = draggingRef.current;
      if (!node) return;
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      node.fx = (screenX - transform.x) / transform.k;
      node.fy = (screenY - transform.y) / transform.k;
    },
    [transform]
  );

  const onPointerUp = useCallback(() => {
    if (draggingRef.current) simRef.current?.alphaTarget(0);
    draggingRef.current = null;
  }, []);

  const matchesQuery = (p) =>
    query.trim().length === 0 || p.name.toLowerCase().includes(query.trim().toLowerCase());

  const highlightId = hovered || selected;

  const connectedIds = new Set();
  if (highlightId) {
    connectedIds.add(highlightId);
    links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === highlightId) connectedIds.add(t);
      if (t === highlightId) connectedIds.add(s);
    });
    if (highlightId === "you" || highlightId.startsWith("cluster:")) {
      const hubIds = Array.from(connectedIds).filter((id) => id.startsWith("cluster:"));
      hubIds.forEach((hubId) => {
        links.forEach((l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          if (s === hubId) connectedIds.add(t);
          if (t === hubId) connectedIds.add(s);
        });
      });
    }
  }

  const isClusterSelected = selected && selected.startsWith("cluster:");
  const selectedCategory = isClusterSelected ? selected.slice(8) : null;
  const selectedPerson = !isClusterSelected ? PEOPLE.find((p) => p.id === selected) : null;

  const degree = {};
  const importantIds = new Set();
  links.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    degree[s] = (degree[s] || 0) + 1;
    degree[t] = (degree[t] || 0) + 1;
    if (l.strength >= 3) {
      importantIds.add(s);
      importantIds.add(t);
    }
  });

  const querying = query.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#161618",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <TopNav />
      <DataStatus isLoading={isLoading} error={error} onRetry={refetch} />
      {updatePerson.error && <div role="alert" style={{ padding: 10, color: "#e0685f", fontSize: 12 }}>Не удалось изменить избранное: {updatePerson.error.message}</div>}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: 240,
            flexShrink: 0,
            background: "#1c1c1f",
            borderRight: "1px solid #29292d",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid #26262a" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#161618",
                border: "1px solid #29292d",
                borderRadius: 5,
                padding: "6px 10px",
              }}
            >
              <Search size={13} color="#6f6f77" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти человека"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#c8c9ce",
                  fontSize: 12.5,
                  width: "100%",
                }}
              />
              {query && (
                <X size={13} color="#6f6f77" style={{ cursor: "pointer" }} onClick={() => setQuery("")} />
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={() => setAddPersonOpen(true)}
                disabled={isLoading || isError}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  background: "#26262b",
                  border: "1px solid #33333a",
                  borderRadius: 5,
                  padding: "6px 0",
                  fontSize: 11.5,
                  color: "#c8c9ce",
                  cursor: "pointer",
                }}
              >
                <Plus size={12} />
                Человек
              </button>
              <button
                onClick={() => setAddConnectionOpen(true)}
                disabled={isLoading || isError || selfId == null || PEOPLE.length < 2}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  background: "#26262b",
                  border: "1px solid #33333a",
                  borderRadius: 5,
                  padding: "6px 0",
                  fontSize: 11.5,
                  color: "#c8c9ce",
                  cursor: "pointer",
                }}
              >
                <Plus size={12} />
                Связь
              </button>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
            {favorites.size > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ padding: "4px 10px", fontSize: 10.5, color: "#5c5c63", letterSpacing: "0.04em" }}>
                  ИЗБРАННОЕ
                </div>
                {PEOPLE.filter((p) => favorites.has(p.id)).map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    isFavorite
                    isSelected={selected === p.id}
                    peerCount={peerCounts[p.id] || 0}
                    onSelect={selectPerson}
                    onToggleFavorite={toggleFavorite}
                    isSaving={updatePerson.isPending}
                  />
                ))}
              </div>
            )}

            {Object.entries(categories).map(([cat, members]) => {
              const isOpen = manualExpanded.has(cat) || querying;
              const filtered = members.filter(matchesQuery);
              if (querying && filtered.length === 0) return null;
              return (
                <div key={cat}>
                  <div
                    onClick={() => toggleCluster(cat)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 10px",
                      cursor: "pointer",
                      color: "#9a9aa2",
                      fontSize: 12,
                    }}
                  >
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span>{cat}</span>
                    <span style={{ color: "#5c5c63", marginLeft: "auto" }}>{members.length}</span>
                  </div>
                  {isOpen &&
                    filtered.map((p) => (
                      <PersonRow
                        key={p.id}
                        person={p}
                        isFavorite={favorites.has(p.id)}
                        isSelected={selected === p.id}
                        peerCount={peerCounts[p.id] || 0}
                        onSelect={selectPerson}
                        onToggleFavorite={toggleFavorite}
                        isSaving={updatePerson.isPending}
                      />
                    ))}
                </div>
              );
            })}
            {PEOPLE.some((p) => p.id !== "you" && !categoryOf[p.id]) && <div>
              <div style={{ padding: "6px 10px", fontSize: 12, color: "#9a9aa2" }}>Без категории</div>
              {PEOPLE.filter((p) => p.id !== "you" && !categoryOf[p.id] && matchesQuery(p)).map((p) => <PersonRow key={p.id} person={p} isFavorite={favorites.has(p.id)} isSelected={selected === p.id} peerCount={peerCounts[p.id] || 0} onSelect={selectPerson} onToggleFavorite={toggleFavorite} isSaving={updatePerson.isPending} />)}
            </div>}
            {!isLoading && !isError && PEOPLE.length <= 1 && <div style={{ padding: 12, fontSize: 12, color: "#84848c" }}>Пока нет знакомых. Добавь первого человека.</div>}
            {querying && !PEOPLE.some((p) => p.id !== "you" && matchesQuery(p)) && <div style={{ padding: 12, fontSize: 12, color: "#84848c" }}>Никого не найдено</div>}
          </div>
        </div>

        <div
          ref={containerRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position: "relative",
            flex: 1,
            background: "#161618",
            overflow: "hidden",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            userSelect: draggingRef.current ? "none" : "auto",
          }}
        >
          <div style={{ position: "absolute", top: 14, left: 14, zIndex: 5, fontSize: 11, color: "#5c5c63" }}>
            {isLoading
              ? "Загружаем граф…"
              : activeFocus
              ? `Фокус: ${PEOPLE.find((p) => p.id === activeFocus)?.name}`
              : `${Math.max(PEOPLE.length - 1, 0)} знакомых`}
          </div>

          <button
            onClick={resetView}
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              zIndex: 5,
              background: "#1c1c1f",
              border: "1px solid #29292d",
              borderRadius: 5,
              padding: "5px 10px",
              fontSize: 11,
              color: "#8a8a92",
              cursor: "pointer",
            }}
          >
            Сбросить вид · {Math.round(transform.k * 100)}%
          </button>

          <svg ref={svgRef} width={size.w} height={size.h} style={{ display: "block", cursor: "grab" }}>
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {links.map((l, i) => {
                const s = typeof l.source === "object" ? l.source : null;
                const t = typeof l.target === "object" ? l.target : null;
                if (!s || !t) return null;
                const isCoreLink = s.id === "you" || t.id === "you";
                const isYouThread = activeFocus && l.isYouLink;
                const isFocusLink = activeFocus && !isYouThread && (s.id === activeFocus || t.id === activeFocus);
                const dim = highlightId && !(connectedIds.has(s.id) && connectedIds.has(t.id));
                const important = l.strength >= 3;
                return (
                  <line
                    key={i}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={isYouThread ? ACCENT : isFocusLink ? "#4a4a52" : important ? ACCENT : "#4a4a52"}
                    strokeWidth={isYouThread ? 1.4 : isFocusLink ? 0.5 : important ? 1.1 : 0.6}
                    opacity={
                      isYouThread
                        ? 0.85
                        : isFocusLink
                        ? 0.18
                        : dim
                        ? 0.05
                        : important
                        ? 0.75
                        : isCoreLink
                        ? 0.4
                        : 0.25
                    }
                    style={{ transition: "opacity 0.2s, stroke 0.2s" }}
                  />
                );
              })}

              {selected &&
                selected !== "you" &&
                !selected.startsWith("cluster:") &&
                links.map((l, i) => {
                  const s = typeof l.source === "object" ? l.source : null;
                  const t = typeof l.target === "object" ? l.target : null;
                  if (!s || !t) return null;
                  if (s.id !== selected && t.id !== selected) return null;
                  const important = l.strength >= 3;
                  const mx = (s.x + t.x) / 2;
                  const my = (s.y + t.y) / 2;
                  return (
                    <text
                      key={`label-${i}`}
                      x={mx}
                      y={my - 4}
                      textAnchor="middle"
                      fontSize={9 / Math.max(transform.k, 1)}
                      fill={important ? ACCENT : "#8a8a92"}
                      style={{ pointerEvents: "none" }}
                    >
                      {l.via}
                    </text>
                  );
                })}

              {nodes.map((n) => {
                const isSelected = n.id === selected;
                const isHovered = n.id === hovered;
                const isCore = n.id === "you" || n.isFocus;
                const isFav = favorites.has(n.id);
                const dim = highlightId && !connectedIds.has(n.id) && n.id !== highlightId;
                const searchMatch = matchesQuery(n);
                const searchDim = querying && !searchMatch;
                const r = n.isCluster
                  ? 14 + Math.min(Math.sqrt(n.count) * 4, 26)
                  : isCore
                  ? 15
                  : 4 + Math.min(degree[n.id] || 1, 6) * 1.1;
                const important = importantIds.has(n.id);
                const fill = isCore
                  ? ACCENT
                  : n.isCluster
                  ? "#3a3a42"
                  : isFav
                  ? GOLD
                  : isSelected || isHovered
                  ? ACCENT
                  : important
                  ? "#a89bf5"
                  : NODE_FILL;
                const showLabel = true;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x || 0},${n.y || 0})`}
                    onPointerDown={(e) => onPointerDown(e, n)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (n.isCluster) toggleCluster(n.name);
                      else setSelected(n.id);
                    }}
                    style={{
                      cursor: n.isFocus ? "default" : "grab",
                      opacity: dim || searchDim ? 0.15 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <circle
                      r={r}
                      fill={fill}
                      stroke={n.isCluster ? "#5a5a66" : "none"}
                      strokeWidth={n.isCluster ? 1.2 : 0}
                      strokeDasharray={n.isCluster ? "3 2" : "none"}
                    />
                    {showLabel && (
                      <text
                        y={r + 12}
                        textAnchor="middle"
                        fill={n.isCluster ? "#c8c9ce" : "#9a9aa2"}
                        fontSize={(n.isCluster ? 11 : 10) / Math.max(transform.k, 1)}
                        style={{ pointerEvents: "none" }}
                      >
                        {n.isCluster ? (n.count > 0 ? `${n.name} · ${n.count}` : n.name) : n.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {(selectedPerson || isClusterSelected) && (
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 220,
                background: "#1c1c1f",
                border: "1px solid #29292d",
                borderRadius: 5,
                padding: 14,
                color: "#c8c9ce",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              {isClusterSelected ? (
                <>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{selectedCategory}</span>
                  <div style={{ fontSize: 12, color: "#84848c", marginTop: 8 }}>
                    {categories[selectedCategory]?.length} человек в этой группе
                  </div>
                  <button
                    onClick={() => toggleCluster(selectedCategory)}
                    style={{
                      marginTop: 10,
                      background: "#26262b",
                      border: "1px solid #33333a",
                      borderRadius: 4,
                      padding: "5px 10px",
                      fontSize: 11.5,
                      color: "#c8c9ce",
                      cursor: "pointer",
                    }}
                  >
                    Показать всех
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{selectedPerson.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {selectedPerson.id !== "you" && (
                        <button type="button" aria-label={`${favorites.has(selectedPerson.id) ? "Убрать из избранного" : "В избранное"}: ${selectedPerson.name}`} disabled={updatePerson.isPending} onClick={() => toggleFavorite(selectedPerson.id)} style={{ border: 0, padding: 0, background: "transparent", display: "flex" }}><Star
                          size={15}
                          color={favorites.has(selectedPerson.id) ? GOLD : "#5c5c63"}
                          fill={favorites.has(selectedPerson.id) ? GOLD : "none"}
                          style={{ cursor: "pointer" }}
                        /></button>
                      )}
                      <button type="button" aria-label={`Изменить человека: ${selectedPerson.name}`} onClick={() => setEditPersonOpen(true)} style={{ border: 0, padding: 0, background: "transparent", display: "flex" }}><Pencil
                        size={13}
                        color="#5c5c63"
                        style={{ cursor: "pointer" }}
                      /></button>
                      <X
                        size={15}
                        color="#5c5c63"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          exitFocus();
                          setSelected(null);
                        }}
                      />
                    </div>
                  </div>
                  {selectedPerson.note && (
                    <div style={{ fontSize: 12, color: "#84848c", marginTop: 8, lineHeight: 1.4 }}>
                      {selectedPerson.note}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#5c5c63",
                      marginTop: 12,
                      borderTop: "1px solid #232326",
                      paddingTop: 8,
                    }}
                  >
                    Связей: {RELATIONSHIPS.filter((r) => r.source === selectedPerson.id || r.target === selectedPerson.id).length}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {RELATIONSHIPS.filter((r) => r.source === selectedPerson.id || r.target === selectedPerson.id).map((connection) => {
                      const otherId = connection.source === selectedPerson.id ? connection.target : connection.source;
                      const other = PEOPLE.find((p) => p.id === otherId);
                      return <div key={connection.id} style={{ fontSize: 12, padding: "5px 0", display: "flex", gap: 8, justifyContent: "space-between" }}>
                        <span>{other?.name || "Человек"} · {connection.via}</span>
                        <button type="button" aria-label={`Изменить связь с ${other?.name || "человеком"}`} onClick={() => setEditConnection(connection)} style={{ border: 0, background: "transparent", color: "#9a9aa2" }}><Pencil size={13} /></button>
                      </div>;
                    })}
                  </div>

                  {(() => {
                    const focusActive = focusId === selectedPerson.id;
                    return !focusActive ? (
                      <button
                        onClick={() => enterFocus(selectedPerson.id)}
                        style={{
                          marginTop: 10,
                          background: "#26262b",
                          border: "1px solid #33333a",
                          borderRadius: 4,
                          padding: "5px 10px",
                          fontSize: 11.5,
                          color: "#c8c9ce",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        Подробнее
                      </button>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={exitFocus}
                          style={{
                            background: "#26262b",
                            border: "1px solid #33333a",
                            borderRadius: 4,
                            padding: "5px 10px",
                            fontSize: 11.5,
                            color: "#c8c9ce",
                            cursor: "pointer",
                            width: "100%",
                            marginBottom: 10,
                          }}
                        >
                          ← Назад ко всем
                        </button>
                        <div style={{ fontSize: 10.5, color: "#5c5c63", letterSpacing: "0.04em", marginBottom: 4 }}>
                          СВЯЗИ ЭТОГО ЧЕЛОВЕКА
                        </div>
                        {getPeerConnections(selectedPerson.id).length === 0 ? (
                          <div style={{ fontSize: 11.5, color: "#5c5c63" }}>
                            Пока не отмечено связей с другими людьми
                          </div>
                        ) : (
                          getPeerConnections(selectedPerson.id).map((p) => (
                            <div
                              key={p.id}
                              onClick={() => setSelected(p.id)}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                padding: "4px 0",
                                cursor: "pointer",
                              }}
                            >
                              <span style={{ fontSize: 12, color: "#c8c9ce" }}>{p.name}</span>
                              <span style={{ fontSize: 10.5, color: "#6a6a72" }}>{p.via}</span>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {addPersonOpen && (
        <AddPersonModal people={PEOPLE} selfId={selfId} onClose={() => setAddPersonOpen(false)} />
      )}
      {addConnectionOpen && (
        <AddConnectionModal people={PEOPLE} selfId={selfId} onClose={() => setAddConnectionOpen(false)} />
      )}
      {editPersonOpen && selectedPerson && (
        <EditPersonModal
          key={selectedPerson.id}
          person={selectedPerson}
          selfId={selfId}
          onClose={() => setEditPersonOpen(false)}
        />
      )}
      {editConnection && <AddConnectionModal key={editConnection.id} people={PEOPLE} selfId={selfId} connection={editConnection} onClose={() => setEditConnection(null)} />}
    </div>
  );
}
