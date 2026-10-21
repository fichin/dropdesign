// Builds the whole app in Vercel's Build Output format (.vercel/output), ready for
// `vercel deploy --prebuilt`: the Vite frontend as static files, and the Express API
// bundled into one serverless function on the same domain (so the session cookie is
// first-party). Run with: npm run build:vercel
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

const OUT = '.vercel/output'
const FUNCTION_DIR = `${OUT}/functions/api/index.func`

rmSync(OUT, { recursive: true, force: true })

// Frontend: type-check and build to dist/, then serve it as static files
execSync('npm run build', { stdio: 'inherit' })
cpSync('dist', `${OUT}/static`, { recursive: true })

/**
 * Security headers for every response. The Content-Security-Policy allows exactly what the
 * app loads: its own scripts plus the inline theme script in index.html (by hash, computed
 * from the built file so it always matches what's served), Google Fonts' stylesheet and font
 * files, avatars from i.pravatar.cc and data: URLs (initials avatars), and API calls to its
 * own origin (or VITE_API_URL's, when the API is hosted elsewhere).
 */
function securityHeaders() {
  const html = readFileSync('dist/index.html', 'utf8')
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  // Fail the build rather than ship a policy that would block the page or allow too much
  if (inlineScripts.length !== 1) throw new Error(`Expected 1 inline script in index.html, found ${inlineScripts.length}`)
  if (/<style[\s>]|\sstyle="/.test(html)) throw new Error('index.html has inline styles, which the CSP would block')
  // Browsers hash the script as the HTML parser sees it, with every line break normalised to
  // \n; a Windows checkout has \r\n in index.html, so hashing the raw bytes would block it
  const scriptText = inlineScripts[0].replace(/\r\n?/g, '\n')
  const scriptHash = `'sha256-${createHash('sha256').update(scriptText, 'utf8').digest('base64')}'`
  const apiOrigin = process.env.VITE_API_URL ? new URL(process.env.VITE_API_URL).origin : null

  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHash}`,
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: https://i.pravatar.cc",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    // frame-ancestors covers current browsers; X-Frame-Options the older ones
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}
const headers = securityHeaders()

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
        // Security headers on everything (pages, assets, API), then the specific rules
        { src: '^/(.*)$', headers, continue: true },
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
