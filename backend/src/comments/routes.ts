import { Router } from 'express'
import type pg from 'pg'
import { z } from 'zod'
import { addComment, deleteComment, listComments } from './repository.ts'

const taskParams = z.object({ taskId: z.uuid() })
const commentParams = z.object({ commentId: z.uuid() })

const addCommentBody = z
  .object({
    id: z.uuid(),
    body: z.string().trim().min(1, 'Write something first').max(2000, 'Comments can be at most 2000 characters'),
  })
  .strict()

// Mounted behind requireAuth, which puts the signed-in user's id in res.locals.userId
export function commentRoutes(pool: pg.Pool) {
  const router = Router()

  router.get('/tasks/:taskId/comments', async (req, res) => {
    const { taskId } = taskParams.parse(req.params)
    res.json(await listComments(pool, taskId))
  })

  router.post('/tasks/:taskId/comments', async (req, res) => {
    const { taskId } = taskParams.parse(req.params)
    const { comment, commentCount, created } = await addComment(
      pool,
      taskId,
      res.locals.userId,
      addCommentBody.parse(req.body),
    )
    res.status(created ? 201 : 200).json({ comment, commentCount })
  })

  router.delete('/comments/:commentId', async (req, res) => {
    const { commentId } = commentParams.parse(req.params)
    res.json(await deleteComment(pool, commentId, res.locals.userId))
  })

  return router
}
