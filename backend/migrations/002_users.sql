-- Accounts for signing in. Emails are stored trimmed and lowercased by the API;
-- the CHECK guarantees it, so the UNIQUE constraint is effectively case-insensitive.
-- (citext would do the same, but installs into one schema, which per-run test schemas can't see.)

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
