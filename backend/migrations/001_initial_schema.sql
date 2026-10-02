-- Boards, columns, tasks and people, matching shared/kanban.ts.
-- The CHECK lists mirror TASK_STATUSES and PRIORITIES there: keep them in sync.

CREATE TABLE boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE columns (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id  uuid NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  title     text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  status    text NOT NULL CHECK (status IN ('todo', 'in-progress', 'completed')),
  -- Left-to-right order within the board, from 0
  position  integer NOT NULL CHECK (position >= 0)
);
CREATE INDEX columns_board_position_idx ON columns (board_id, position);

-- Anyone who can be assigned to tasks
CREATE TABLE people (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  avatar_url  text NOT NULL
);

CREATE TABLE tasks (
  -- No default needed in practice: the frontend generates ids so a retried create can't duplicate
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id                uuid NOT NULL REFERENCES columns (id) ON DELETE CASCADE,
  title                    text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  priority                 text NOT NULL DEFAULT 'ok'
                           CHECK (priority IN ('high-priority', 'important', 'ok', 'meh', 'not-important')),
  progress                 integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  comment_count            integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  completed_subtask_count  integer NOT NULL DEFAULT 0 CHECK (completed_subtask_count >= 0),
  -- Top-to-bottom order within the column, from 0; moves renumber inside a transaction
  position                 integer NOT NULL CHECK (position >= 0),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_column_position_idx ON tasks (column_id, position);

CREATE TABLE task_assignees (
  task_id    uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  -- Order the avatars are shown in on the card
  position   integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (task_id, person_id)
);
CREATE INDEX task_assignees_person_idx ON task_assignees (person_id);
