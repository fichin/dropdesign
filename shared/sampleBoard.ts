import type { Assignee, Board, Task } from './kanban.ts'

// Mirrors the cards in the Figma design so the two can be compared side by side.
// Used by the frontend as its fallback board and by backend/src/db/seed.ts.
const people: Assignee[] = [
  { id: 'u1', name: 'Ana Petrova', avatarUrl: 'https://i.pravatar.cc/64?img=5' },
  { id: 'u2', name: 'Marko Ilievski', avatarUrl: 'https://i.pravatar.cc/64?img=12' },
  { id: 'u3', name: 'Sara Novak', avatarUrl: 'https://i.pravatar.cc/64?img=32' },
  { id: 'u4', name: 'David Chen', avatarUrl: 'https://i.pravatar.cc/64?img=53' },
  { id: 'u5', name: 'Elena Stojanova', avatarUrl: 'https://i.pravatar.cc/64?img=44' },
  { id: 'u6', name: 'Luka Horvat', avatarUrl: 'https://i.pravatar.cc/64?img=15' },
  { id: 'u7', name: 'Mia Jovanovska', avatarUrl: 'https://i.pravatar.cc/64?img=26' },
]

const team = (count: number) => people.slice(0, count)

// Descriptions start empty; they're added in the task detail modal
const sampleTasks: Omit<Task, 'description'>[] = [
  // To Do
  {
    id: 't1',
    title: 'UI/UX Design in the age of AI',
    priority: 'important',
    progress: 0,
    assignees: team(2),
    commentCount: 11,
    completedSubtaskCount: 187,
  },
  {
    id: 't2',
    title: 'Responsive Website Design for 23 more clients',
    priority: 'meh',
    progress: 0,
    assignees: team(7),
    commentCount: 32,
    completedSubtaskCount: 115,
  },
  {
    id: 't3',
    title: 'Blog Copywriting (Low priority) 😅',
    priority: 'ok',
    progress: 0,
    assignees: team(2),
    commentCount: 987,
    completedSubtaskCount: 21800,
  },
  {
    id: 't4',
    title: 'Landing page for Azunyan senpai',
    priority: 'not-important',
    progress: 0,
    assignees: team(2),
    commentCount: 5,
    completedSubtaskCount: 11,
  },

  // In Progress
  {
    id: 't5',
    title: 'Machine Learning Progress',
    priority: 'important',
    progress: 52,
    assignees: team(2),
    commentCount: 11,
    completedSubtaskCount: 187,
  },
  {
    id: 't6',
    title: 'Learn Computer Science',
    priority: 'meh',
    progress: 30,
    assignees: team(4),
    commentCount: 32,
    completedSubtaskCount: 115,
  },

  // Completed
  {
    id: 't7',
    title: 'User flow confirmation for fintech App',
    priority: 'important',
    progress: 100,
    assignees: team(2),
    commentCount: 11,
    completedSubtaskCount: 2200,
  },
  {
    id: 't8',
    title: 'Do some usual chores',
    priority: 'high-priority',
    progress: 100,
    assignees: team(3),
    commentCount: 1,
    completedSubtaskCount: 87,
  },
  {
    id: 't9',
    title: 'Write a few articles for slothUI',
    priority: 'ok',
    progress: 100,
    assignees: team(1),
    commentCount: 987,
    completedSubtaskCount: 21800,
  },
  {
    id: 't10',
    title: 'Transform into a cyborg',
    priority: 'ok',
    progress: 100,
    assignees: team(6),
    commentCount: 987,
    completedSubtaskCount: 21800,
  },
  {
    id: 't11',
    title: 'Design 100 landing page for client',
    priority: 'not-important',
    progress: 100,
    assignees: team(1),
    commentCount: 5,
    completedSubtaskCount: 11,
  },
]
const tasks: Task[] = sampleTasks.map((task) => ({ ...task, description: '' }))

export const initialBoard: Board = {
  // Placeholder: the seed script gives the board (and everything in it) real UUIDs
  id: 'sample-board',
  title: 'Project PlanetX',
  tasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
  columns: {
    todo: { id: 'todo', title: 'To Do', status: 'todo', taskIds: ['t1', 't2', 't3', 't4'] },
    'in-progress': {
      id: 'in-progress',
      title: 'In Progress',
      status: 'in-progress',
      taskIds: ['t5', 't6'],
    },
    completed: {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      taskIds: ['t7', 't8', 't9', 't10', 't11'],
    },
  },
  columnOrder: ['todo', 'in-progress', 'completed'],
  people: [...people].sort((a, b) => a.name.localeCompare(b.name)),
}
