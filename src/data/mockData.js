// Placeholder data generation. Everything here is client-side random data
// standing in for the real backend. When the FastAPI API is ready, replace
// this module with TanStack Query hooks (useContacts(), useConnections())
// that hit /people and /relationships — pages should barely need to change,
// since they already just consume { people, relationships }.

export const FIRST_NAMES = [
  "Асель", "Данил", "Марат", "Айгерим", "Олег", "Света", "Тимур", "Нурлан",
  "Дана", "Ержан", "Алия", "Бекзат", "Гульнара", "Дамир", "Ерлан", "Жанна",
  "Канат", "Лаура", "Мадина", "Нурсултан", "Ольга", "Рустам", "Сая", "Тамара",
  "Улан", "Фарида", "Хасан", "Шынар", "Эдуард", "Юлия", "Яна", "Азамат",
  "Botagoz", "Виктор", "Диас", "Есенгуль", "Женис", "Заур", "Индира", "Куаныш",
  "Лейла", "Максат", "Наталья", "Оксана", "Павел", "Раушан", "Самал", "Толеген",
  "Ұлжан", "Фёдор", "Гаухар", "Динара", "Ерасыл", "Жансая", "Зарина", "Ильяс",
  "Карина", "Лиза", "Мейрам", "Настя", "Орал", "Прасковья", "Роза", "Серик",
  "Темирлан", "Умит", "Фатима", "Хадиша", "Цветана", "Чингиз", "Шамиль",
  "Эльмира", "Юрий", "Ясмин", "Абай", "Бахыт", "Валерия", "Гульмира", "Дастан",
  "Ерулан", "Жанболат", "Зере", "Ислам", "Камила", "Лев", "Мира", "Назерке",
  "Омар", "Полина", "Ринат", "Сабина", "Тимофей", "Ұлан", "Фарух", "Ханат",
  "Шакен", "Эмиль", "Юлдуз", "Яков", "Бану", "Гриша",
];

export const VIA_POOL = [
  { via: "работа", weight: [1, 2, 2, 3] },
  { via: "школа", weight: [2, 3, 3] },
  { via: "универ", weight: [1, 2, 2, 3] },
  { via: "семья", weight: [3, 3] },
  { via: "конференция", weight: [1] },
  { via: "спорт по выходным", weight: [2, 3] },
  { via: "общие друзья", weight: [1, 2] },
  { via: "путешествие", weight: [1] },
  { via: "хобби-клуб", weight: [1, 2] },
  { via: "сосед", weight: [1, 2] },
];

export const PEOPLE_COUNT = 99;

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildData(count) {
  const people = [{ id: "you", name: "Ты" }];
  const relationships = [];

  for (let i = 0; i < count; i++) {
    const id = `p${i}`;
    const name =
      FIRST_NAMES[i % FIRST_NAMES.length] +
      (i >= FIRST_NAMES.length ? ` ${Math.floor(i / FIRST_NAMES.length) + 1}` : "");
    const viaEntry = pick(VIA_POOL);
    const via = viaEntry.via;
    const strength = pick(viaEntry.weight);
    people.push({ id, name, note: `Познакомились: ${via}` });
    relationships.push({ source: "you", target: id, via, strength });
  }

  const others = people.filter((p) => p.id !== "you");
  const extraEdges = Math.round(count * 0.4);
  const seen = new Set();
  for (let i = 0; i < extraEdges; i++) {
    const a = pick(others);
    const b = pick(others);
    if (a.id === b.id) continue;
    const key = [a.id, b.id].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    const viaEntry = pick(VIA_POOL);
    relationships.push({
      source: a.id,
      target: b.id,
      via: viaEntry.via,
      strength: pick(viaEntry.weight),
    });
  }

  return { people, relationships };
}
