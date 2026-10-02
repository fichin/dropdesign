import type { Assignee, Board, Task } from '../types/kanban'

const assignees = {
  ana: { id: 'u1', name: 'Ana Petrova', avatarUrl: 'https://i.pravatar.cc/64?img=5' },
  marko: { id: 'u2', name: 'Marko Ilievski', avatarUrl: 'https://i.pravatar.cc/64?img=12' },
  sara: { id: 'u3', name: 'Sara Novak', avatarUrl: 'https://i.pravatar.cc/64?img=32' },
  david: { id: 'u4', name: 'David Chen', avatarUrl: 'https://i.pravatar.cc/64?img=53' },
} satisfies Record<string, Assignee>

const tasks: Task[] = [
  // To Do
  {
    id: 't1',
    title: 'Design onboarding screens',
    tag: 'Design',
    tagColor: '#7c5cff',
    progress: 0,
    assignees: [assignees.ana],
  },
  {
    id: 't2',
    title: 'Set up analytics events',
    tag: 'Backend',
    tagColor: '#2f9e44',
    progress: 10,
    assignees: [assignees.marko, assignees.david],
  },
  {
    id: 't3',
    title: 'Write copy for pricing page',
    tag: 'Marketing',
    tagColor: '#f08c00',
    progress: 0,
    assignees: [assignees.sara],
  },

  // In Progress
  {
    id: 't4',
    title: 'Build authentication flow',
    tag: 'Frontend',
    tagColor: '#1c7ed6',
    progress: 45,
    assignees: [assignees.david, assignees.ana],
  },
  {
    id: 't5',
    title: 'Migrate database to Postgres 17',
    tag: 'Backend',
    tagColor: '#2f9e44',
    progress: 70,
    assignees: [assignees.marko],
  },
  {
    id: 't6',
    title: 'Dashboard empty states',
    tag: 'Design',
    tagColor: '#7c5cff',
    progress: 30,
    assignees: [assignees.ana, assignees.sara, assignees.david],
  },

  // Completed
  {
    id: 't7',
    title: 'Project kickoff meeting',
    tag: 'Planning',
    tagColor: '#e64980',
    progress: 100,
    assignees: [assignees.ana, assignees.marko, assignees.sara, assignees.david],
  },
  {
    id: 't8',
    title: 'Set up CI pipeline',
    tag: 'DevOps',
    tagColor: '#495057',
    progress: 100,
    assignees: [assignees.david],
  },
]

export const initialBoard: Board = {
  tasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
  columns: {
    todo: { id: 'todo', title: 'To Do', status: 'todo', taskIds: ['t1', 't2', 't3'] },
    'in-progress': {
      id: 'in-progress',
      title: 'In Progress',
      status: 'in-progress',
      taskIds: ['t4', 't5', 't6'],
    },
    completed: { id: 'completed', title: 'Completed', status: 'completed', taskIds: ['t7', 't8'] },
  },
  columnOrder: ['todo', 'in-progress', 'completed'],
}
