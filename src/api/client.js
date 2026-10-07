const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const messages = {
  "invalid password": "Неверный пароль",
  "incorrect password": "Неверный пароль",
  "user not found": "Пользователь не найден",
  "email already exist": "Эта почта уже зарегистрирована",
  "email already using": "Эта почта уже зарегистрирована",
  "person not found": "Человек не найден или недоступен в этом аккаунте",
  "connection not found": "Связь не найдена или недоступна в этом аккаунте",
  "you already have this connection": "Связь между этими людьми уже существует",
  "you already have a self person": "Карточка «Ты» уже существует",
  "you can't create a connection with same person": "Нельзя связать человека с самим собой",
};

function errorMessage(data, status) {
  const detail = data?.detail || data?.message;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const field = item.loc?.filter((part) => part !== "body").join(" → ");
      return [field, item.msg || "Некорректное значение"].filter(Boolean).join(": ");
    }).join("; ");
  }
  if (typeof detail === "string") return messages[detail.toLowerCase()] || detail;
  return `Ошибка запроса (${status})`;
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Не удалось связаться с сервером. Проверь, что бэкенд запущен.", 0, null);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data);
  return data;
}

// The server sets session cookies; the client never stores tokens.
export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: (signal) => request("/users/me", { signal }),
  getPersons: () => request("/person"),
  createPerson: (payload) => request("/person/create", { method: "POST", body: payload }),
  updatePerson: (personId, changes) => request(`/person?person_id=${personId}`, { method: "PATCH", body: changes }),
  getConnections: (signal) => request("/connections", { signal }),
  createConnection: (payload) => request("/connections/create", { method: "POST", body: payload }),
  updateConnection: (connectionId, changes) => request(`/connections?connection_id=${connectionId}`, { method: "PATCH", body: changes }),
};
