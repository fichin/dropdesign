import { Router } from 'express'
import type pg from 'pg'
import { z } from 'zod'
import { PRIORITIES } from '../../../shared/kanban.ts'
import { addTask, deleteTask, getBoard, listBoards, moveTask, updateTask } from './repository.ts'

const boardParams = z.object({ boardId: z.uuid() })
const taskParams = z.object({ taskId: z.uuid() })

const addTaskBody = z.object({
  id: z.uuid(),
  columnId: z.uuid(),
  title: z.string().trim().min(1, 'Title is required').max(500),
})

const moveTaskBody = z.object({
  toColumnId: z.uuid(),
  toIndex: z.int().min(0),
})

const updateTaskBody = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(500),
    description: z.string().max(5000),
    priority: z.enum(PRIORITIES),
    assigneeIds: z
      .array(z.uuid())
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, 'Each person can only be assigned once'),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

// Validation failures throw ZodError, which the app's error handler turns into a 400
export function boardRoutes(pool: pg.Pool) {
  const router = Router()

  router.get('/boards', async (_req, res) => {
    res.json(await listBoards(pool))
  })

  router.get('/boards/:boardId', async (req, res) => {
    const { boardId } = boardParams.parse(req.params)
    res.json(await getBoard(pool, boardId))
  })

  router.post('/boards/:boardId/tasks', async (req, res) => {
    const { boardId } = boardParams.parse(req.params)
    const { task, created } = await addTask(pool, boardId, addTaskBody.parse(req.body))
    res.status(created ? 201 : 200).json(task)
  })

  router.patch('/tasks/:taskId/move', async (req, res) => {
    const { taskId } = taskParams.parse(req.params)
    res.json(await moveTask(pool, taskId, moveTaskBody.parse(req.body)))
  })

  router.patch('/tasks/:taskId', async (req, res) => {
    const { taskId } = taskParams.parse(req.params)
    res.json(await updateTask(pool, taskId, updateTaskBody.parse(req.body)))
  })

  router.delete('/tasks/:taskId', async (req, res) => {
    const { taskId } = taskParams.parse(req.params)
    res.json(await deleteTask(pool, taskId))
  })

  return router
}
