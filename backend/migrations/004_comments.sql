-- Comments on tasks, written by signed-in users.
--
-- Comment authors are people (the same table as assignees), so a signed-in account
-- needs a person to act as. people.user_id links the two; the API creates the person
-- the first time an account comments.
ALTER TABLE people
  ADD COLUMN user_id uuid UNIQUE REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- A task's comments, oldest first
CREATE INDEX comments_task_created_idx ON comments (task_id, created_at, id);

-- tasks.comment_count is now kept equal to the real number of comments (updated by the
-- API in the same transaction as each insert/delete). Until now it held placeholder
-- numbers copied from the design mockups, so reset it to the real count.
UPDATE tasks SET comment_count = (SELECT count(*) FROM comments c WHERE c.task_id = tasks.id);
