-- An optional due date per task (a calendar date, no time or timezone), set in the task modal.
ALTER TABLE tasks ADD COLUMN due_date date;
