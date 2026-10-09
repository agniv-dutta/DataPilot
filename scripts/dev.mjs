#!/usr/bin/env node
/**
 * Run the backend (FastAPI/uvicorn) and the frontend (Vite) together for local
 * development, with prefixed logs. Cross-platform, no dependencies.
 *
 *   node scripts/dev.mjs      # or: make dev
 *
 * Backend  -> http://localhost:8000
 * Frontend -> http://localhost:5173  (proxies /api to the backend)
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const RESET = '\x1b[0m'
const jobs = [
  {
    name: 'backend ',
    color: '\x1b[35m',
    cwd: resolve(root, 'backend'),
    cmd: isWin ? 'python' : 'python3',
    args: ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'],
  },
  {
    name: 'frontend',
    color: '\x1b[36m',
    cwd: resolve(root, 'frontend'),
    cmd: isWin ? 'npm' : 'npm',
    args: ['run', 'dev'],
  },
]

const children = []

function run(job) {
  const child = spawn(job.cmd, job.args, {
    cwd: job.cwd,
    shell: isWin,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  children.push(child)

  const prefix = `${job.color}${job.name}${RESET} │ `
  const pipe = (stream, out) => {
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) out.write(`${prefix}${line}\n`)
    })
    stream.on('end', () => {
      if (buffer) out.write(`${prefix}${buffer}\n`)
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)

  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code ?? 0}\n`)
    if (children.every((c) => c.exitCode !== null)) process.exit(code ?? 0)
  })
  child.on('error', (err) => {
    process.stderr.write(`${prefix}failed to start: ${err.message}\n`)
  })
}

function shutdown() {
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log(
  `\n  Starting DataPilot — backend :8000, frontend :5173 (Ctrl+C to stop)\n`,
)

jobs.forEach(run)
