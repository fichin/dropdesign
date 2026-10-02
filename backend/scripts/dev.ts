// `npm run dev`: runs the API and restarts it when files in src/ or ../shared/ change.
//
// Node's own --watch (and --watch-path) also restarts on changes inside node_modules, which
// tools like antivirus or indexers report even when nothing really changed, causing random
// restarts. Watching just these folders avoids that, without adding a dependency.
import { spawn, type ChildProcess } from 'node:child_process'
import { watch } from 'node:fs'

const WATCHED_DIRS = ['src', '../shared']
const SERVER_ARGS = ['--env-file-if-exists=.env', 'src/server.ts']

let server: ChildProcess | null = null
let restartTimer: NodeJS.Timeout | undefined

function start() {
  server = spawn(process.execPath, SERVER_ARGS, { stdio: 'inherit' })
  server.on('exit', (code, signal) => {
    // Crashed (not stopped by us for a restart): keep watching so a fix brings it back
    // Plain dots: Windows PowerShell's console garbles the "…" character
    if (signal === null && code !== 0) console.log(`API exited with code ${code}; waiting for changes...`)
  })
}

function restart(changedFile: string) {
  // Editors often write a file in several steps; restart once they're done
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    console.log(`Change detected in ${changedFile}, restarting`)
    if (server && server.exitCode === null && server.signalCode === null) {
      server.once('exit', start)
      server.kill('SIGTERM')
    } else {
      start()
    }
  }, 150)
}

for (const dir of WATCHED_DIRS) {
  watch(dir, { recursive: true }, (_event, file) => {
    if (file) restart(`${dir}/${file.replaceAll('\\', '/')}`)
  })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server?.kill(signal)
    process.exit(0)
  })
}

console.log(`Watching ${WATCHED_DIRS.join(' and ')} for changes`)
start()
