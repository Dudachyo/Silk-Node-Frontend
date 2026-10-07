import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/api/client.js";
import { loadPersonsWithSelf } from "../src/api/persons.js";
import { setActiveAccount } from "../src/api/session.js";

const originalFetch = globalThis.fetch;
const originalLocks = Object.getOwnPropertyDescriptor(globalThis.navigator, "locks");
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  setActiveAccount(null);
  if (originalLocks) Object.defineProperty(globalThis.navigator, "locks", originalLocks);
  else delete globalThis.navigator.locks;
});

test("HTTP success does not depend on an exact auth message; cookies are included", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return Response.json({ message: "changed successful response" });
  };
  await api.login("test@example.invalid", "test-password");
  await api.register("test@example.invalid", "test-password");
  await api.me();
  await api.logout();
  assert.ok(requests.every((request) => request.credentials === "include"));
  assert.deepEqual(requests.map((request) => new URL(request.url).pathname), ["/auth/login", "/auth/register", "/users/me", "/auth/logout"]);
});

test("auth and connection failures retain HTTP status and show readable detail", async () => {
  for (const [status, detail, expected] of [
    [400, "Incorrect password", "Неверный пароль"],
    [404, "Person not found", "Человек не найден"],
  ]) {
    globalThis.fetch = async () => Response.json({ detail }, { status });
    await assert.rejects(api.login("test", "test"), (error) => error instanceof ApiError && error.status === status && error.message.includes(expected));
  }
});

test("connection POST and PATCH both reject duplicate HTTP 409 with readable detail", async () => {
  globalThis.fetch = async () => Response.json({ detail: "You already have this connection" }, { status: 409 });
  const isConflict = (error) => error instanceof ApiError && error.status === 409 && error.message.includes("уже существует");
  await assert.rejects(api.createConnection({ person_id_a: 1, person_id_b: 2, via: "Работа" }), isConflict);
  await assert.rejects(api.updateConnection(9, { person_b_id: 2 }), isConflict);
});

test("bootstrap recovers an existing self after a concurrent creation returns 409", async () => {
  setActiveAccount(1);
  const self = { id: 12, name: "Я", note: "", is_self: true, is_favourite: false };
  let reads = 0;
  let creates = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      creates++;
      return Response.json({ detail: "You already have a self person" }, { status: 409 });
    }
    return Response.json(++reads === 1 ? [] : [self]);
  };
  assert.deepEqual(await loadPersonsWithSelf(1), [self]);
  assert.equal(reads, 2);
  assert.equal(creates, 1);
});

test("validation detail arrays are readable and do not expose the submitted input", async () => {
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ["body", "password"], msg: "Field required", input: "private-value" }] }, { status: 422 });
  await assert.rejects(api.login("test", "test"), (error) => error.message === "password: Field required");
});

test("connection create and update use their different request field names", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return Response.json({ id: 9, person_a_id: 1, person_b_id: 2, via: "Работа" });
  };
  const created = await api.createConnection({ person_id_a: 2, person_id_b: 1, via: "Работа" });
  await api.updateConnection(created.id, { via: "Учёба" });
  assert.deepEqual(JSON.parse(requests[0].body), { person_id_a: 2, person_id_b: 1, via: "Работа" });
  assert.equal(new URL(requests[1].url).search, "?connection_id=9");
  assert.deepEqual(JSON.parse(requests[1].body), { via: "Учёба" });
});

test("parallel bootstrap creates one real self person and reload reuses its ID", async () => {
  let persons = [];
  let creates = 0;
  setActiveAccount(1);
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      creates++;
      assert.deepEqual(JSON.parse(options.body), { name: "Я", note: "", is_self: true, is_favourite: false });
      persons = [{ id: 7, ...JSON.parse(options.body) }];
      return Response.json(persons[0]);
    }
    return Response.json(persons);
  };
  const result = await Promise.all([loadPersonsWithSelf(1), loadPersonsWithSelf(1), loadPersonsWithSelf(1)]);
  assert.equal(creates, 1);
  assert.ok(result.every((list) => list[0].id === 7));
  assert.equal((await loadPersonsWithSelf(1))[0].id, 7);
  assert.equal(creates, 1);
});

test("account change during bootstrap cannot create self for a different account", async () => {
  let resolveList;
  let creates = 0;
  setActiveAccount(1);
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") { creates++; return Response.json({ id: 7 }); }
    return new Promise((resolve) => { resolveList = resolve; });
  };
  const loading = loadPersonsWithSelf(1);
  setActiveAccount(2);
  resolveList(Response.json([]));
  await assert.rejects(loading, { name: "AbortError" });
  assert.equal(creates, 0);
});

test("independent tab loaders serialize bootstrap and reuse the saved self", async () => {
  let queue = Promise.resolve();
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: { request: (name, load) => { const result = queue.then(load); queue = result.catch(() => {}); return result; } },
  });
  const tabA = await import("../src/api/persons.js?tab=A");
  const tabB = await import("../src/api/persons.js?tab=B");
  setActiveAccount(1);
  let persons = [];
  let creates = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      creates++;
      persons = [{ id: 11, ...JSON.parse(options.body) }];
      return Response.json(persons[0]);
    }
    return Response.json(persons);
  };
  const lists = await Promise.all([tabA.loadPersonsWithSelf(1), tabB.loadPersonsWithSelf(1)]);
  assert.equal(creates, 1);
  assert.ok(lists.every((list) => list.find((person) => person.is_self).id === 11));
});

test("retry after bootstrap failure reads the list before trying to create again", async () => {
  setActiveAccount(1);
  let persons = [];
  let creates = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      creates++;
      persons = [{ id: 8, name: "Я", note: "", is_self: true, is_favourite: false }];
      throw new TypeError("Lost response after server saved the person");
    }
    return Response.json(persons);
  };
  await assert.rejects(loadPersonsWithSelf(1), ApiError);
  assert.equal((await loadPersonsWithSelf(1))[0].id, 8);
  assert.equal(creates, 1);
});
