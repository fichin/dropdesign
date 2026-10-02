import { useState, type FormEvent } from 'react'
import './AddTaskForm.css'

interface AddTaskFormProps {
  onAdd: (title: string) => void
  onClose: () => void
}

function AddTaskForm({ onAdd, onClose }: AddTaskFormProps) {
  const [title, setTitle] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    onAdd(title)
    onClose()
  }

  return (
    <form className="add-task-form" onSubmit={handleSubmit}>
      <input
        type="text"
        aria-label="Task title"
        placeholder="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
        autoFocus
      />
      <div className="add-task-form-actions">
        <button type="button" className="button-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={!title.trim()}>
          Add task
        </button>
      </div>
    </form>
  )
}

export default AddTaskForm
