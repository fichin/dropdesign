-- Rate limiting for login and register, shared by every serverless instance (an in-memory
-- limiter would only see the requests that happened to reach the same instance).
--
-- One row per (rule, subject) fixed window, e.g. "failed logins for this email". The key is
-- a SHA-256 hash of the rule name and the subject, so the table never stores plaintext
-- emails or IP addresses. A window is "fresh" until window_start + the rule's length; the
-- API's atomic upsert starts a new window when the old one has expired.
CREATE TABLE auth_rate_limits (
  key           text        PRIMARY KEY,
  window_start  timestamptz NOT NULL,
  count         integer     NOT NULL CHECK (count >= 0)
);

-- Cleanup deletes rows whose window ended long ago
CREATE INDEX auth_rate_limits_window_start_idx ON auth_rate_limits (window_start);
