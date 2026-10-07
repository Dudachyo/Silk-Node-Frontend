import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { accountRevision, isActiveAccount } from "../api/session";
import { discardPersonsLoad } from "../api/persons";

function usePersonMutation(mutationFn) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["persons", user?.id];
  const revision = accountRevision();
  return useMutation({
    mutationFn,
    onSuccess: async (person) => {
      // A response after logout must not recreate the previous account's cache.
      if (!isActiveAccount(user?.id, revision) || !queryClient.getQueryData(queryKey)) return;
      await queryClient.cancelQueries({ queryKey });
      if (!isActiveAccount(user?.id, revision)) return;
      discardPersonsLoad(user.id);
      queryClient.setQueryData(queryKey, (persons) => {
        const exists = persons.some((item) => item.id === person.id);
        return exists ? persons.map((item) => item.id === person.id ? person : item) : [...persons, person];
      });
    },
  });
}

export function useCreatePerson() {
  return usePersonMutation((payload) => api.createPerson(payload));
}

export function useUpdatePerson() {
  return usePersonMutation(({ personId, ...changes }) => api.updatePerson(personId, changes));
}
