import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { accountRevision, isActiveAccount } from "../api/session";

function useConnectionMutation(mutationFn) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["connections", user?.id];
  const revision = accountRevision();
  return useMutation({
    mutationFn,
    onSuccess: async (connection) => {
      if (!isActiveAccount(user?.id, revision) || !queryClient.getQueryData(queryKey)) return;
      await queryClient.cancelQueries({ queryKey });
      if (!isActiveAccount(user?.id, revision)) return;
      queryClient.setQueryData(queryKey, (connections) => {
        const exists = connections.some((item) => item.id === connection.id);
        return exists ? connections.map((item) => item.id === connection.id ? connection : item) : [...connections, connection];
      });
    },
  });
}

export function useCreateConnection() {
  return useConnectionMutation((payload) => api.createConnection(payload));
}

export function useUpdateConnection() {
  return useConnectionMutation(({ connectionId, ...changes }) => api.updateConnection(connectionId, changes));
}
