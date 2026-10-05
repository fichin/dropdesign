/**
 * The public demo account. The password is deliberately not a secret: it's printed in the
 * README and on the login page's "Try Demo" path, so anyone can look around. The demo
 * account can't delete tasks, and the board it sees is restored every day (see board.ts).
 */
export const DEMO_EMAIL = 'demo@example.com'
export const DEMO_PASSWORD = 'try-dropdesign'

export const isDemoEmail = (email: string) => email === DEMO_EMAIL
