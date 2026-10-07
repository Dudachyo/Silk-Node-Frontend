import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { loadPersonsWithSelf } from "../api/persons";
import { useAuth } from "../context/AuthContext";

// HomePage and GraphPage were built against mockData's { people, relationships }
// shape, with the owner hardcoded as id "you". The real backend represents the
// owner as a normal Person row with is_self: true, so we remap that one row's
// real id to "you" here — the rest of both pages needs no changes.
const SELF_ID = "you";

export function useGraphData() {
  const { user } = useAuth();
  const personsQuery = useQuery({
    queryKey: ["persons", user?.id],
    queryFn: () => loadPersonsWithSelf(user.id),
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
  });
  const connectionsQuery = useQuery({
    queryKey: ["connections", user?.id],
    // Share the in-flight read across development StrictMode remounts.
    // Account keys and explicit cancellation on logout isolate its result.
    queryFn: () => api.getConnections(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { people, relationships, selfId } = useMemo(() => {
    if (!personsQuery.data || !connectionsQuery.data) {
      return { people: [], relationships: [], selfId: null };
    }

    const selfPerson = personsQuery.data.find((p) => p.is_self);
    const realSelfId = selfPerson?.id;
    // IMPORTANT: backend ids are numbers, but GraphPage's clustering code
    // does string ops on node ids (id.startsWith("cluster:"), id === "you").
    // Mixing numbers and strings there throws at runtime (numbers don't have
    // .startsWith) and crashes the render on hover/click. Always normalize
    // to a string here so every id in the graph is the same type.
    const normalize = (id) => (id === realSelfId ? SELF_ID : String(id));

    return {
      people: personsQuery.data.map((p) => ({
        id: normalize(p.id),
        apiId: p.id,
        name: p.is_self ? "Ты" : p.name,
        // the graph always labels self "Ты", but forms that edit this
        // person need the actual stored name, not that display override
        rawName: p.name,
        note: p.note || "",
        isFavourite: !!p.is_favourite,
      })),
      // NOTE: the backend doesn't model connection "strength" yet (it was a
      // mock-only concept for edge thickness/distance). Every edge gets a
      // flat weight of 1 until a real field for this exists.
      relationships: connectionsQuery.data.map((c) => ({
        id: c.id,
        personAId: c.person_a_id,
        personBId: c.person_b_id,
        source: normalize(c.person_a_id),
        target: normalize(c.person_b_id),
        via: c.via || "другое",
        strength: 1,
      })),
      // real, un-normalized self id — needed when calling the API (it only
      // knows the numeric id, not our "you" placeholder)
      selfId: realSelfId ?? null,
    };
  }, [personsQuery.data, connectionsQuery.data]);

  return {
    people,
    relationships,
    selfId,
    isLoading: personsQuery.isLoading || connectionsQuery.isLoading,
    isError: personsQuery.isError || connectionsQuery.isError,
    error: personsQuery.error || connectionsQuery.error,
    refetch: () => {
      personsQuery.refetch();
      connectionsQuery.refetch();
    },
  };
}
