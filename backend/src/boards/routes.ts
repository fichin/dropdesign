import { Router } from 'express'
import type pg from 'pg'
import { z } from 'zod'
import { addTask, getBoard, listBoards, moveTask } from './repository.ts'

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

  return router
}
