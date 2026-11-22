import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('\x1b[32m%s\x1b[0m', '🌱 Starting FieldWise Platform...')
console.log('\x1b[36m%s\x1b[0m', '  • FieldWise Landing Page: http://localhost:5173')
console.log('\x1b[35m%s\x1b[0m', '  • FieldWise Main App:     http://localhost:5174')
console.log('\x1b[33m%s\x1b[0m', '  • FieldWise Backend API:  http://localhost:3001')

const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'

function startProcess(name, dir, colorCode) {
  const proc = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.resolve(__dirname, dir),
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  })

  const prefix = `\x1b[${colorCode}m[${name}]\x1b[0m `

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n')
    lines.forEach((line) => {
      if (line.trim()) console.log(prefix + line)
    })
  })

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n')
    lines.forEach((line) => {
      if (line.trim()) console.error(prefix + line)
    })
  })

  proc.on('close', (code) => {
    console.log(`${prefix} Process exited with code ${code}`)
  })

  return proc
}

const landingProc = startProcess('Landing', 'FieldWise_landing', '36') // Cyan
const mainProc = startProcess('MainApp', 'FieldWise_main', '35')      // Magenta
const backendProc = startProcess('Backend', 'FieldWise_main/backend', '33') // Yellow

function shutdown() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down FieldWise dev servers...')
  landingProc.kill('SIGINT')
  mainProc.kill('SIGINT')
  backendProc.kill('SIGINT')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
