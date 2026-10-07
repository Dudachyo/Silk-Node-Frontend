import { useRef, useState } from "react";
import { useCreatePerson } from "../hooks/usePersons";
import { useCreateConnection } from "../hooks/useConnections";
import Modal, { Field, inputStyle } from "./Modal";

export default function AddPersonModal({ people, selfId, onClose }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isFavourite, setIsFavourite] = useState(false);
  const [connectToId, setConnectToId] = useState("");
  const [via, setVia] = useState("");
  const [error, setError] = useState("");
  const [savedPerson, setSavedPerson] = useState(null);
  const submitting = useRef(false);
  const createPerson = useCreatePerson();
  const createConnection = useCreateConnection();
  const busy = createPerson.isPending || createConnection.isPending;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!name.trim()) { setError("Укажи имя"); return; }
    const targetId = connectToId === "you" ? selfId : people.find((person) => person.id === connectToId)?.apiId;
    if (connectToId && !Number.isInteger(targetId)) { setError("Дождись загрузки выбранной карточки"); return; }
    if (connectToId && !via.trim()) { setError("Укажи, через что вы связаны"); return; }
    submitting.current = true;
    try {
      // If the second request failed, retry only the connection, not the person.
      const created = savedPerson || await createPerson.mutateAsync({ name: name.trim(), note: note.trim(), is_self: false, is_favourite: isFavourite });
      setSavedPerson(created);
      if (connectToId) await createConnection.mutateAsync({ person_id_a: created.id, person_id_b: targetId, via: via.trim() });
      onClose();
    } catch (err) {
      setError(err.message || "Не удалось сохранить человека");
    } finally { submitting.current = false; }
  };

  return (
    <Modal title="Новый человек" busy={busy} error={error} submitLabel={savedPerson ? (connectToId ? "Сохранить связь" : "Готово") : "Создать"} onClose={onClose} onSubmit={handleSubmit}>
      {savedPerson && <div role="status" style={{ fontSize: 12 }}>Человек уже сохранён. Исправь связь или выбери «Не связывать», чтобы завершить.</div>}
      <Field label="Имя"><input autoFocus value={name} disabled={!!savedPerson} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Например, Асель" /></Field>
      <Field label="Заметка"><textarea value={note} disabled={!!savedPerson} onChange={(e) => setNote(e.target.value)} rows={2} style={inputStyle} /></Field>
      <label style={{ fontSize: 13 }}><input type="checkbox" checked={isFavourite} disabled={!!savedPerson} onChange={(e) => setIsFavourite(e.target.checked)} /> В избранное</label>
      <Field label="Связать с человеком (необязательно)">
        <select value={connectToId} onChange={(e) => setConnectToId(e.target.value)} style={inputStyle}>
          <option value="">Не связывать</option>
          {people.filter((person) => person.apiId !== savedPerson?.id).map((person) => <option key={person.id} value={person.id} disabled={person.id === "you" && selfId == null}>{person.name}</option>)}
        </select>
      </Field>
      <Field label="Через что связаны"><input value={via} onChange={(e) => setVia(e.target.value)} disabled={!connectToId} style={inputStyle} placeholder="Работа, школа…" /></Field>
    </Modal>
  );
}
