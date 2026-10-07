import { useRef, useState } from "react";
import { useUpdatePerson } from "../hooks/usePersons";
import Modal, { Field, inputStyle } from "./Modal";

export default function EditPersonModal({ person, onClose }) {
  const [name, setName] = useState(person.rawName ?? person.name);
  const [note, setNote] = useState(person.note || "");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const updatePerson = useUpdatePerson();
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!name.trim()) { setError("Имя не может быть пустым"); return; }
    const changes = {};
    if (name.trim() !== (person.rawName ?? person.name)) changes.name = name.trim();
    if (note !== (person.note || "")) changes.note = note;
    if (!Object.keys(changes).length) { onClose(); return; }
    submitting.current = true;
    try {
      await updatePerson.mutateAsync({ personId: person.apiId, ...changes });
      onClose();
    } catch (err) { setError(err.message || "Не удалось сохранить изменения"); }
    finally { submitting.current = false; }
  };
  return (
    <Modal title="Изменить человека" busy={updatePerson.isPending} error={error} submitLabel="Сохранить" onClose={onClose} onSubmit={handleSubmit}>
      <Field label="Имя"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
      {person.id === "you" && <div style={{ fontSize: 12 }}>На графе карточка подписана «Ты». Сохранённое имя видно в настройках.</div>}
      <Field label="Заметка"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={inputStyle} /></Field>
    </Modal>
  );
}
