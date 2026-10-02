-- A longer description for each task, edited in the task detail modal.
-- NOT NULL DEFAULT '' (rather than nullable) so "no description" has one representation;
-- existing tasks get ''.

ALTER TABLE tasks
  ADD COLUMN description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000);
