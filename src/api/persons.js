import { api } from "./client.js";
import { accountRevision, isActiveAccount } from "./session.js";

const pending = new Map();

// This promise covers remounts; Web Locks covers tabs of the same frontend.
export function loadPersonsWithSelf(userId) {
  const revision = accountRevision();
  const key = `${userId}:${revision}`;
  if (pending.has(key)) return pending.get(key);
  const checkAccount = () => {
    if (!isActiveAccount(userId, revision)) throw new DOMException("Сессия изменилась", "AbortError");
  };
  const load = async () => {
    checkAccount();
    const persons = await api.getPersons();
    checkAccount();
    if (persons.some((person) => person.is_self)) return persons;
    try {
      const self = await api.createPerson({ name: "Я", note: "", is_self: true, is_favourite: false });
      checkAccount();
      return [...persons, self];
    } catch (error) {
      if (error.status !== 409) throw error;
      // A different browser may have created self after our initial GET.
      checkAccount();
      const savedPersons = await api.getPersons();
      checkAccount();
      if (savedPersons.some((person) => person.is_self)) return savedPersons;
      throw error;
    }
  };
  const promise = (globalThis.navigator?.locks
    ? navigator.locks.request(`silk-node:self:${userId}`, load)
    : load()).finally(() => { if (pending.get(key) === promise) pending.delete(key); });
  pending.set(key, promise);
  return promise;
}

export function discardPersonsLoad(userId) {
  pending.delete(`${userId}:${accountRevision()}`);
}
