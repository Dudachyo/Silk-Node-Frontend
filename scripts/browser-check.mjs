// Chrome DevTools Protocol smoke test; no browser automation dependency.
// --real creates two dedicated test accounts in the running API.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { once } from "node:events";

if (!process.argv.includes("--real")) {
  console.log("Use npm run test:browser -- --real against a test API. This creates two test accounts, people and connections.");
  process.exit(0);
}

const origin = "http://localhost:5173";
const api = "http://localhost:8000";
const results = [];
const record = (name) => { results.push(name); console.log(`PASS ${name}`); };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chrome = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!chrome) throw new Error("Chrome/Edge not found; set CHROME_PATH");
const root = resolve(".browser-check");
await mkdir(root, { recursive: true });
const profile = await mkdtemp(join(root, "profile-"));
let browser;
let cdp;
let ownedServer = false;
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, origin).pathname;
    const file = pathname.startsWith("/assets/") ? resolve("dist", `.${pathname}`) : resolve("dist/index.html");
    if (!file.startsWith(resolve("dist") + sep)) { response.writeHead(403).end(); return; }
    const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[extname(file)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const task = this.pending.get(message.id);
        if (!task) return;
        clearTimeout(task.timer);
        this.pending.delete(message.id);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      } else {
        this.handlers.get(message.method)?.(message.params);
      }
    });
  }
  async ready() { if (this.ws.readyState !== WebSocket.OPEN) await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); }); }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "Browser evaluation failed");
    return result.result.value;
  }
}

try {
  await new Promise((resolve, reject) => {
    server.once("error", (error) => error.code === "EADDRINUSE" ? resolve() : reject(error));
    server.listen(5173, () => { ownedServer = true; resolve(); });
  });
  // The disposable browser runs inside Codex's OS sandbox; nested Chromium
  // renderer sandboxing is unavailable there. This never uses a real profile.
  const sandboxArgs = process.env.CODEX_BROWSER_NO_SANDBOX === "1" ? ["--no-sandbox"] : [];
  browser = spawn(chrome, ["--headless=new", ...sandboxArgs, "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  browser.on("error", (error) => console.error("Browser launch failed:", error.message));
  let port;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch { await pause(250); }
  }
  if (!port) throw new Error("Browser did not start remote debugging");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Runtime.enable");
  const runtimeErrors = [];
  const responses = [];
  cdp.handlers.set("Network.responseReceived", ({ response }) => {
    if (response.url.startsWith(api + "/")) responses.push({ path: new URL(response.url).pathname, status: response.status });
  });
  cdp.handlers.set("Runtime.exceptionThrown", ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
  const requests = [];
  let fault = null;
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: `${api}/*` }] });
  cdp.handlers.set("Fetch.requestPaused", ({ requestId, request }) => {
    const path = new URL(request.url).pathname;
    requests.push({ path, method: request.method });
    const respond = async () => {
      if (fault && fault.remaining > 0 && request.method === fault.method && path === fault.path) {
        const current = fault;
        current.remaining--;
        current.waiting = true;
        if (current.release) await current.release;
        if (current.delay) await pause(current.delay);
        await cdp.send("Fetch.fulfillRequest", {
          requestId, responseCode: current.status,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: origin }, { name: "Access-Control-Allow-Credentials", value: "true" }],
          body: Buffer.from(JSON.stringify(current.body ?? { detail: current.detail })).toString("base64"),
        });
      } else { await cdp.send("Fetch.continueRequest", { requestId }); }
    };
    respond().catch((error) => {
      // Navigation and cancelled React Query reads can invalidate a paused
      // request before DevTools resumes it; that is not an app exception.
      if (!error.message.includes("Invalid InterceptionId")) runtimeErrors.push(`Interceptor: ${error.message}`);
    });
  });

  const evaluate = (fn, ...args) => cdp.evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`);
  const until = async (expression, label, timeout = 12000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await cdp.evaluate(expression)) return; } catch {}
      await pause(100);
    }
    throw new Error(`Timed out: ${label}`);
  };
  const navigate = async (path) => { await cdp.send("Page.navigate", { url: origin + path }); await until("document.readyState === 'complete' && !!document.querySelector('#root')", "page load"); };
  const button = async (text, dialog = false) => evaluate((label, inDialog) => {
    const scope = inDialog ? document.querySelector('[role="dialog"]') : document;
    const element = [...scope.querySelectorAll("button")].find((node) => node.textContent.trim() === label);
    if (!element || element.disabled) throw new Error(`Button unavailable: ${label}`);
    element.click();
  }, text, dialog);
  const click = async (selector) => evaluate((selector) => { const element = document.querySelector(selector); if (!element) throw new Error(`Missing element: ${selector}`); element.click(); }, selector);
  const fill = async (selector, value) => evaluate((selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing field: ${selector}`);
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }, selector, value);
  const dialogOpen = () => until("!!document.querySelector('[role=dialog]')", "dialog opens");
  const dialogClosed = () => until("!document.querySelector('[role=dialog]')", "dialog closes");
  const apiRead = (path) => evaluate(async (url) => { const response = await fetch(url, { credentials: "include" }); if (!response.ok) throw new Error(`Read failed: ${response.status}`); return response.json(); }, api + path);
  const selectValue = (index, name) => evaluate((index, name) => {
    const select = document.querySelectorAll('[role="dialog"] select')[index];
    return [...select.options].find((option) => option.text === name)?.value;
  }, index, name);
  const selectPerson = async (name) => evaluate((name) => {
    const label = [...document.querySelectorAll("svg text")].find((node) => node.textContent === name);
    if (!label) throw new Error(`Graph node unavailable: ${name}`);
    label.parentElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, name);
  const graphReads = () => ({
    persons: requests.filter((request) => request.method === "GET" && request.path === "/person").length,
    connections: requests.filter((request) => request.method === "GET" && request.path === "/connections").length,
  });

  const suffix = randomUUID().slice(0, 8);
  const emailA = `frontend-check-a-${suffix}@example.invalid`;
  const emailB = `frontend-check-b-${suffix}@example.invalid`;
  const password = randomBytes(18).toString("base64url");
  await navigate("/register");
  await until("!!document.querySelector('input[type=email]')", "register form");
  await fill('input[type="email"]', emailA);
  await fill('input[type="password"]', password);
  await button("Создать аккаунт");
  await until("location.pathname === '/home' && document.body.innerText.includes('0 знакомых')", "registration and self bootstrap");
  let persons = await apiRead("/person");
  assert.equal(persons.filter((person) => person.is_self).length, 1);
  const selfId = persons.find((person) => person.is_self).id;
  record("Registration creates one real self person");
  const initialReads = graphReads();
  for (let pass = 0; pass < 2; pass++) {
    await click('a[href="/graph"]');
    await until("location.pathname === '/graph' && document.body.innerText.includes('Пока нет знакомых')", "cached graph navigation");
    await click('a[href="/settings"]');
    await until("location.pathname === '/settings' && document.body.innerText.includes('Имя карточки')", "cached settings navigation");
    await click('a[href="/home"]');
    await until("location.pathname === '/home' && document.body.innerText.includes('0 знакомых')", "cached home navigation");
  }
  await pause(100);
  assert.deepEqual(graphReads(), initialReads);
  record("Fresh graph/home/settings navigation issues zero additional graph GETs");
  const beforeStaleNavigation = graphReads();
  await evaluate(() => { const now = Date.now; Date.now = () => now() + 61_000; });
  await click('a[href="/graph"]');
  await until("location.pathname === '/graph'", "stale graph navigation");
  for (let attempt = 0; attempt < 100 && (graphReads().persons === beforeStaleNavigation.persons || graphReads().connections === beforeStaleNavigation.connections); attempt++) await pause(100);
  assert.deepEqual(graphReads(), { persons: beforeStaleNavigation.persons + 1, connections: beforeStaleNavigation.connections + 1 });
  record("After simulated 61 seconds, navigation refetches each graph query once");
  await navigate("/home");
  await until("document.body.innerText.includes('0 знакомых')", "session restoration");
  assert.equal((await apiRead("/person")).find((person) => person.is_self).id, selfId);
  record("Reload restores session and keeps self ID");

  const cookies = await cdp.send("Network.getCookies", { urls: [api] });
  assert.ok(cookies.cookies.some((cookie) => cookie.name === "refresh_token"));
  await cdp.send("Network.deleteCookies", { name: "access_token", domain: "localhost", path: "/" });
  await navigate("/graph");
  await until("document.body.innerText.includes('Пока нет знакомых')", "refresh cookie restores access");
  const refreshed = await cdp.send("Network.getCookies", { urls: [api] });
  assert.ok(refreshed.cookies.some((cookie) => cookie.name === "access_token"));
  record("Refresh cookie restores access in Chromium on localhost");

  await button("Человек"); await dialogOpen();
  await fill('[role="dialog"] input:not([type=checkbox])', "Анна тест");
  await fill('[role="dialog"] textarea', "Тестовая заметка");
  const beforePersonCreate = graphReads();
  await button("Создать", true); await dialogClosed();
  await until("[...document.querySelectorAll('svg text')].some(node => node.textContent === 'Анна тест')", "unlinked person visible");
  assert.deepEqual(graphReads(), beforePersonCreate);
  const anna = (await apiRead("/person")).find((person) => person.name === "Анна тест");
  assert.ok(anna);
  record("Unlinked person is saved and visible");
  await selectPerson("Анна тест");
  await click('button[aria-label="Изменить человека: Анна тест"]'); await dialogOpen();
  await fill('[role="dialog"] input', "Анна обновлена");
  await fill('[role="dialog"] textarea', "Обновлённая заметка");
  const beforePersonEdit = graphReads();
  await button("Сохранить", true); await dialogClosed();
  await click('button[aria-label="В избранное: Анна обновлена"]');
  await until("!!document.querySelector('button[aria-label=\"Убрать из избранного: Анна обновлена\"]:not(:disabled)')", "favorite saved");
  assert.deepEqual(graphReads(), beforePersonEdit);
  await navigate("/graph");
  await until("document.body.innerText.includes('Анна обновлена')", "person persisted");
  assert.equal((await apiRead("/person")).find((person) => person.id === anna.id).note, "Обновлённая заметка");
  await click('button[aria-label="Убрать из избранного: Анна обновлена"]');
  await until("!!document.querySelector('button[aria-label=\"В избранное: Анна обновлена\"]:not(:disabled)')", "favorite removed");
  assert.equal((await apiRead("/person")).find((person) => person.id === anna.id).is_favourite, false);
  record("Person edit and favorite changes persist");

  await button("Связь"); await dialogOpen();
  await fill('[role="dialog"] select:nth-of-type(1)', "you");
  const annaValue = await selectValue(1, "Анна обновлена");
  await evaluate((value) => { const element = document.querySelectorAll('[role="dialog"] select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); }, annaValue);
  await fill('[role="dialog"] input', "Учёба");
  const beforeConnectionCreate = graphReads();
  await button("Связать", true); await dialogClosed();
  assert.deepEqual(graphReads(), beforeConnectionCreate);
  let connections = await apiRead("/connections");
  assert.equal(connections.length, 1);
  assert.deepEqual([connections[0].person_a_id, connections[0].person_b_id], [selfId, anna.id].sort((a, b) => a - b));
  record("Connection uses real self ID and canonical API pair");
  await click('button[aria-label="Изменить связь с Анна обновлена"]'); await dialogOpen();
  await fill('[role="dialog"] input', "Работа");
  fault = { path: "/connections", method: "PATCH", remaining: 1, status: 404, detail: "Person not found" };
  await button("Сохранить", true);
  await until("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('Человек не найден')", "missing person error");
  assert.equal(await cdp.evaluate("document.querySelector('[role=dialog] input').value"), "Работа");
  assert.equal((await apiRead("/connections"))[0].via, "Учёба");
  record("Injected missing-person error preserves edits and saved connection");
  const beforeConnectionEdit = graphReads();
  await button("Сохранить", true); await dialogClosed();
  assert.deepEqual(graphReads(), beforeConnectionEdit);
  assert.equal((await apiRead("/connections"))[0].via, "Работа");
  record("Via-only PATCH persists");

  await button("Связь"); await dialogOpen();
  await evaluate((value) => { const element = document.querySelectorAll('[role="dialog"] select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); }, annaValue);
  await fill('[role="dialog"] input', "Дубликат");
  const createResponseStart = responses.length;
  await button("Связать", true);
  await until("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('уже существует')", "duplicate create rejected");
  assert.ok(responses.slice(createResponseStart).some((response) => response.path === "/connections/create" && response.status === 409));
  assert.equal(await cdp.evaluate("document.querySelector('[role=dialog] input').value"), "Дубликат");
  await evaluate(() => { const element = document.querySelectorAll('[role="dialog"] select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, "you"); element.dispatchEvent(new Event("change", { bubbles: true })); });
  await button("Связать", true);
  await until("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('самим собой')", "same ID rejected");
  assert.equal((await apiRead("/connections")).length, 1);
  await click('[role="dialog"] button[aria-label="Закрыть"]');
  record("Duplicate create and same ID errors preserve form and saved data");

  await button("Человек"); await dialogOpen();
  await fill('[role="dialog"] input:not([type=checkbox])', "Борис тест");
  await button("Создать", true); await dialogClosed();
  await button("Связь"); await dialogOpen();
  const borisValue = await selectValue(1, "Борис тест");
  await evaluate((value) => { const element = document.querySelectorAll('[role="dialog"] select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); }, borisValue);
  await fill('[role="dialog"] input', "Спорт");
  await button("Связать", true); await dialogClosed();
  await click('button[aria-label="Изменить связь с Анна обновлена"]'); await dialogOpen();
  await evaluate((value) => { const element = document.querySelectorAll('[role="dialog"] select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); }, borisValue);
  const patchResponseStart = responses.length;
  await button("Сохранить", true);
  await until("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('уже существует')", "duplicate PATCH rejected");
  assert.ok(responses.slice(patchResponseStart).some((response) => response.path === "/connections" && response.status === 409));
  assert.equal((await apiRead("/connections")).find((connection) => connection.id === connections[0].id).via, "Работа");
  // Change both participants, in reversed order, to exercise API sorting.
  await evaluate((a, b) => { const selects = document.querySelectorAll('[role="dialog"] select'); [a, b].forEach((value, index) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(selects[index], value); selects[index].dispatchEvent(new Event("change", { bubbles: true })); }); }, borisValue, annaValue);
  await button("Сохранить", true); await dialogClosed();
  connections = await apiRead("/connections");
  const edited = connections.find((connection) => connection.person_a_id === anna.id);
  assert.ok(edited && edited.person_a_id < edited.person_b_id);
  await navigate("/graph");
  await until("document.body.innerText.includes('Борис тест')", "edited pair reload");
  assert.deepEqual(await apiRead("/connections"), connections);
  record("Duplicate PATCH rejected; participant edit follows server sorting and survives reload");
  record("Person/connection create and PATCH update cached graph without refetch");

  await navigate("/home");
  await until("document.body.innerText.includes('Анна обновлена')", "home list");
  await fill('input', "Анна");
  await until("document.body.innerText.includes('Анна обновлена') && !document.body.innerText.includes('Борис тест')", "home search filters");
  record("Home search filters people");

  await navigate("/graph");
  await until("document.body.innerText.includes('Борис тест')", "graph before fault checks");
  await button("Человек"); await dialogOpen();
  await fill('[role="dialog"] input:not([type=checkbox])', "Вера тест");
  await fill('[role="dialog"] select', "you");
  await fill('[role="dialog"] input[placeholder="Работа, школа…"]', "Тест");
  const personPostsBefore = requests.filter((request) => request.path === "/person/create" && request.method === "POST").length;
  fault = { path: "/connections/create", method: "POST", remaining: 1, status: 400, detail: "Тестовая ошибка связи", delay: 400 };
  await evaluate(() => { const form = document.querySelector('[role="dialog"]'); form.requestSubmit(); form.requestSubmit(); });
  await until("document.querySelector('[role=dialog] button[type=submit]')?.disabled", "save locks while pending");
  await until("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('Тестовая ошибка связи')", "connection fault visible");
  assert.equal(requests.filter((request) => request.path === "/person/create" && request.method === "POST").length - personPostsBefore, 1);
  assert.equal((await apiRead("/person")).filter((person) => person.name === "Вера тест").length, 1);
  await fill('[role="dialog"] input[placeholder="Работа, школа…"]', "Исправлено");
  await button("Сохранить связь", true); await dialogClosed();
  assert.equal((await apiRead("/person")).filter((person) => person.name === "Вера тест").length, 1);
  assert.ok((await apiRead("/connections")).some((connection) => connection.via === "Исправлено"));
  record("Injected failure preserves partially saved person; retry and double submit create no duplicate");

  fault = { path: "/connections", method: "GET", remaining: 20, status: 503, detail: "Тестовая ошибка загрузки" };
  await navigate("/graph");
  await until("document.querySelector('[role=alert]')?.textContent.includes('Тестовая ошибка загрузки')", "load fault visible");
  fault.remaining = 0;
  await button("Повторить");
  await until("document.body.innerText.includes('Борис тест') && !document.body.innerText.includes('Тестовая ошибка загрузки')", "load retry succeeds");
  record("Injected loading error is visible and retry restores saved graph");
  await navigate("/settings");
  await until("document.body.innerText.includes('Запланированные возможности')", "settings load");
  assert.ok(await cdp.evaluate("[...document.querySelectorAll('button')].filter(button => button.textContent === 'Пока недоступно').every(button => button.disabled)"));
  record("Unavailable capabilities are explicitly disabled");

  await click('button[aria-label="Выйти из аккаунта"]');
  await until("location.pathname === '/login' && !!document.querySelector('input[type=password]')", "logout");
  const loggedOutCookies = await cdp.send("Network.getCookies", { urls: [api] });
  assert.ok(!loggedOutCookies.cookies.some((cookie) => ["access_token", "refresh_token"].includes(cookie.name)));
  await navigate("/graph");
  await until("location.pathname === '/login'", "protected route after logout");
  record("Logout removes cookies and protects graph");
  await fill('input[type="email"]', emailA); await fill('input[type="password"]', "wrong-password");
  fault = { path: "/auth/login", method: "POST", remaining: 1, status: 422, detail: [{ loc: ["body", "password"], msg: "Invalid test value" }] };
  await button("Войти");
  await until("document.body.innerText.includes('password: Invalid test value')", "validation detail array displayed");
  record("Injected validation detail array is readable in the auth form");
  await button("Войти");
  await until("document.body.innerText.includes('Неверный пароль')", "login error");
  await fill('input[type="password"]', password); await button("Войти");
  await until("location.pathname === '/home' && document.body.innerText.includes('Анна обновлена')", "login");
  record("Wrong password shows API detail; valid login restores account");
  const oldPersons = await apiRead("/person");
  let releaseOldRead;
  const lateRead = { path: "/person", method: "GET", remaining: 1, status: 200, body: oldPersons, release: new Promise((resolve) => { releaseOldRead = resolve; }) };
  fault = lateRead;
  await evaluate(() => { const now = Date.now; Date.now = () => now() + 61_000; });
  await click('a[href="/graph"]');
  for (let attempt = 0; attempt < 100 && !lateRead.waiting; attempt++) await pause(100);
  assert.ok(lateRead.waiting, "Old account's graph read is paused before switching accounts");
  await click('button[aria-label="Выйти из аккаунта"]'); await until("location.pathname === '/login'", "second logout");
  // Use SPA navigation so the second account exercises the existing QueryClient.
  await click('a[href="/register"]'); await until("location.pathname === '/register' && !!document.querySelector('input[type=email]')", "second registration form");
  await fill('input[type="email"]', emailB); await fill('input[type="password"]', password); await button("Создать аккаунт");
  await until("location.pathname === '/home' && document.body.innerText.includes('0 знакомых')", "second account");
  assert.ok(!await cdp.evaluate("document.body.innerText.includes('Анна обновлена') || document.body.innerText.includes('Борис тест')"));
  assert.equal((await apiRead("/person")).length, 1);
  assert.equal((await apiRead("/connections")).length, 0);
  record("Switching accounts isolates cached people and connections");
  releaseOldRead();
  await pause(300);
  assert.ok(!await cdp.evaluate("document.body.innerText.includes('Анна обновлена') || document.body.innerText.includes('Борис тест')"));
  await click('a[href="/graph"]');
  await until("document.body.innerText.includes('Пока нет знакомых')", "second account stays empty after late response");
  record("Late graph response from previous account cannot populate the new account cache");
  assert.deepEqual(runtimeErrors, []);
  record("No unhandled browser exceptions");
  console.log(`Completed ${results.length} browser checks. Two dedicated test accounts remain in the API (DELETE is unavailable).`);
} catch (error) {
  if (cdp) {
    try { console.error("Visible browser state:", await cdp.evaluate("document.body.innerText.slice(0, 1200)")); } catch {}
  }
  throw error;
} finally {
  if (cdp) {
    try { await cdp.send("Browser.close"); } catch {}
    cdp.ws.close();
  }
  if (browser && browser.exitCode === null) {
    const stopped = once(browser, "exit");
    browser.kill();
    await Promise.race([stopped, pause(3000)]);
  }
  if (ownedServer) await new Promise((resolve) => server.close(resolve));
  // Verify the absolute recursive-delete target is our dedicated profile.
  if (!resolve(profile).startsWith(root + sep) || !profile.includes("profile-")) throw new Error("Unexpected browser profile path");
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }).catch(() => {});
}
