import { useState, type FormEvent } from 'react'

interface AddTaskFormProps {
  onAdd: (title: string) => void
}

function AddTaskForm({ onAdd }: AddTaskFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')

  function close() {
    setTitle('')
    setIsOpen(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    onAdd(title)
    close()
  }

  if (!isOpen) {
    return (
      <button type="button" className="add-task-button" onClick={() => setIsOpen(true)}>
        + Add task
      </button>
    )
  }

  return (
    <form className="add-task-form" onSubmit={handleSubmit}>
      <input
        type="text"
        aria-label="Task title"
        placeholder="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && close()}
        autoFocus
      />
      <button type="submit" disabled={!title.trim()}>
        Add
      </button>
      <button type="button" onClick={close}>
        Cancel
      </button>
    </form>
  )
}

export default AddTaskForm
