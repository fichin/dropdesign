// Builds the whole app in Vercel's Build Output format (.vercel/output), ready for
// `vercel deploy --prebuilt`: the Vite frontend as static files, and the Express API
// bundled into one serverless function on the same domain (so the session cookie is
// first-party). Run with: npm run build:vercel
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

const OUT = '.vercel/output'
const FUNCTION_DIR = `${OUT}/functions/api/index.func`

rmSync(OUT, { recursive: true, force: true })

// Frontend: type-check and build to dist/, then serve it as static files
execSync('npm run build', { stdio: 'inherit' })
cpSync('dist', `${OUT}/static`, { recursive: true })

// API: one ES module with every dependency inlined
await build({
  entryPoints: ['backend/src/vercel.ts'],
  outfile: `${FUNCTION_DIR}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // pg tries to load its optional native driver; it isn't used
  external: ['pg-native'],
  // Some dependencies are CommonJS and call require() for Node built-ins
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
})
writeFileSync(
  `${FUNCTION_DIR}/.vc-config.json`,
  JSON.stringify(
    // fra1 (Frankfurt): next to the Neon database in eu-central-1, so queries stay in-region
    { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30, regions: ['fra1'] },
    null,
    2,
  ),
)

// Routing: real files first (assets), then the API, then the single-page app for every
// other path (/login, /register…). The cron restores the demo board daily at 04:00 UTC.
mkdirSync(OUT, { recursive: true })
writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '^/api(?:/.*)?$', dest: '/api/index' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      crons: [{ path: '/api/demo/reset', schedule: '0 4 * * *' }],
    },
    null,
    2,
  ),
)
console.log(`\nBuilt ${OUT}: static frontend + api/index function`)
