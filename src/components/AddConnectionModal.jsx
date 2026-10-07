import { useRef, useState } from "react";
import { useCreateConnection, useUpdateConnection } from "../hooks/useConnections";
import Modal, { Field, inputStyle } from "./Modal";

// The same form creates and edits a connection. API response IDs are canonical.
export default function AddConnectionModal({ people, selfId, connection, onClose }) {
  const [aId, setAId] = useState(connection?.source || "you");
  const [bId, setBId] = useState(connection?.target || "");
  const [via, setVia] = useState(connection?.via || "");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const create = useCreateConnection();
  const update = useUpdateConnection();
  const busy = create.isPending || update.isPending;
  const rawId = (id) => id === "you" ? selfId : people.find((person) => person.id === id)?.apiId;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const personAId = rawId(aId);
    const personBId = rawId(bId);
    if (!Number.isInteger(personAId) || !Number.isInteger(personBId)) {
      setError("Выбери двух людей с сохранёнными карточками. Карточка «Ты» должна быть загружена.");
      return;
    }
    if (personAId === personBId) { setError("Нельзя связать человека с самим собой"); return; }
    if (!via.trim()) { setError("Укажи, через что связаны люди"); return; }
    submitting.current = true;
    try {
      if (connection) {
        const changes = {};
        if (personAId !== connection.personAId) changes.person_a_id = personAId;
        if (personBId !== connection.personBId) changes.person_b_id = personBId;
        if (via.trim() !== connection.via) changes.via = via.trim();
        if (Object.keys(changes).length) await update.mutateAsync({ connectionId: connection.id, ...changes });
      } else {
        await create.mutateAsync({ person_id_a: personAId, person_id_b: personBId, via: via.trim() });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Не удалось сохранить связь");
    } finally { submitting.current = false; }
  };

  const options = <>
    <option value="">Выбери человека</option>
    {people.map((person) => <option key={person.id} value={person.id} disabled={person.id === "you" && selfId == null}>{person.name}</option>)}
  </>;

  return (
    <Modal title={connection ? "Изменить связь" : "Новая связь"} busy={busy} error={error} submitLabel={connection ? "Сохранить" : "Связать"} onClose={onClose} onSubmit={handleSubmit}>
      <Field label="Первый человек"><select value={aId} onChange={(e) => setAId(e.target.value)} style={inputStyle}>{options}</select></Field>
      <Field label="Второй человек"><select value={bId} onChange={(e) => setBId(e.target.value)} style={inputStyle}>{options}</select></Field>
      <Field label="Через что связаны"><input value={via} onChange={(e) => setVia(e.target.value)} style={inputStyle} placeholder="Работа, школа…" /></Field>
    </Modal>
  );
}
