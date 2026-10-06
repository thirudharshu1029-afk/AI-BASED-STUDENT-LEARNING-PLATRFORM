import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const children = []
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
}

function monitor(child, name) {
  children.push(child)
  child.on('error', (error) => {
    console.error(error)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${name} exited unexpectedly.`)
      stop(code ?? 1)
    }
  })
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

const api = spawn(process.execPath, ['--watch', 'server/index.js'], {
  stdio: 'inherit',
  env: process.env,
})
monitor(api, 'API server')

try {
  const deadline = Date.now() + 15000
  let ready = false
  while (!ready && !stopping && Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4000/api/health')
      const health = await response.json()
      ready = response.ok && health.database === 'connected'
    } catch {
      await delay(250)
    }
  }
  if (!ready) throw new Error('MongoDB API was not ready within 15 seconds.')
  if (!stopping) {
    const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
      stdio: 'inherit',
      env: process.env,
    })
    monitor(vite, 'Vite server')
  }
} catch (error) {
  console.error(error)
  stop(1)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())