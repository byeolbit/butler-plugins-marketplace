import { test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Per-handler bun-test coverage for the slash-command expansion.
// We isolate the plugin from the real ~/.butler tree by pointing BUTLER_HOME /
// BUTLER_DATA at a tmp dir, then dynamically import server.ts which re-exports
// __butlerHelpers. Telegram bot itself doesn't poll in tests (TELEGRAM_BOT_TOKEN
// is the only required env; we set a dummy). We never call bot.start.

const TMP = mkdtempSync(join(tmpdir(), 'tg-slash-test-'))
const BUTLER_HOME = join(TMP, 'butler')
const BUTLER_DATA = join(BUTLER_HOME, 'data')

beforeAll(() => {
  mkdirSync(join(BUTLER_HOME, 'personas', 'templates'), { recursive: true })
  mkdirSync(join(BUTLER_DATA, 'config'), { recursive: true })
  mkdirSync(join(BUTLER_DATA, 'tasks'), { recursive: true })
  mkdirSync(join(BUTLER_HOME, 'butler-core', '.claude-plugin'), { recursive: true })
  mkdirSync(join(BUTLER_HOME, 'butler-core', 'skills', 'demo'), { recursive: true })

  // Persona preset + active stub
  writeFileSync(
    join(BUTLER_HOME, 'personas', 'templates', 'pragmatic.md'),
    '---\nname: pragmatic\ndescription: pragmatic preset\n---\n\nbody\n',
  )
  writeFileSync(
    join(BUTLER_HOME, 'personas', 'active.md'),
    '---\nname: active\nbase: classic\n---\n\nactive body\n',
  )

  // A couple of fake tasks
  for (const id of ['1700000000111', '1700000000222', 'BAD/ID']) {
    if (id.includes('/')) continue
    const dir = join(BUTLER_DATA, 'tasks', id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'status'), 'DONE')
    writeFileSync(join(dir, 'project'), 'demo-project')
    writeFileSync(join(dir, 'request.md'), `request for ${id}`)
    writeFileSync(join(dir, 'result.md'), `result for ${id}`)
  }

  // A skill
  writeFileSync(
    join(BUTLER_HOME, 'butler-core', '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'butler-core' }),
  )
  writeFileSync(
    join(BUTLER_HOME, 'butler-core', 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo-skill\ndescription: demo skill\n---\n\nbody\n',
  )

  // Existing model file
  writeFileSync(join(BUTLER_DATA, 'config', 'model.txt'), 'sonnet\n')

  process.env.BUTLER_HOME = BUTLER_HOME
  process.env.BUTLER_DATA = BUTLER_DATA
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '123:fake'
  process.env.TELEGRAM_STATE_DIR = join(TMP, 'state')
  mkdirSync(process.env.TELEGRAM_STATE_DIR, { recursive: true })
})

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

test('helpers: listRecentTasks returns tasks newest-first, filters bad IDs', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  const tasks = __butlerHelpers.listRecentTasks(10)
  expect(tasks.length).toBe(2)
  expect(tasks[0].taskId).toBe('1700000000222')
  expect(tasks[0].project).toBe('demo-project')
  expect(tasks[0].status).toBe('DONE')
})

test('helpers: readTaskInfo returns result when DONE; rejects path traversal', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  const info = __butlerHelpers.readTaskInfo('1700000000111', true)
  expect(info?.result).toBe('result for 1700000000111')
  expect(__butlerHelpers.readTaskInfo('../etc', true)).toBeNull()
  expect(__butlerHelpers.readTaskInfo('does-not-exist', true)).toBeNull()
})

test('helpers: listButlerProjects aggregates per project', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  const projs = __butlerHelpers.listButlerProjects()
  expect(projs).toEqual([
    { project: 'demo-project', total: 2, running: 0, done: 2, failed: 0 },
  ])
})

test('helpers: listButlerSkills picks up frontmatter name+description', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  process.env.BUTLER_PLUGIN_DIRS = join(BUTLER_HOME, 'butler-core')
  const skills = __butlerHelpers.listButlerSkills()
  expect(skills.find(s => s.name === 'demo-skill')).toBeDefined()
  expect(skills.find(s => s.name === 'demo-skill')?.plugin).toBe('butler-core')
})

test('helpers: getCurrentModels reads model.txt', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  const cur = __butlerHelpers.getCurrentModels()
  expect(cur.worker).toBe('sonnet')
})

test('handler: setWorkerModel writes valid alias and rejects invalid', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  __butlerHelpers.setWorkerModel('opus')
  expect(readFileSync(join(BUTLER_DATA, 'config', 'model.txt'), 'utf8').trim()).toBe('opus')
  expect(() => __butlerHelpers.setWorkerModel('not-a-model')).toThrow(/Invalid model/)
})

test('handler: getActivePersona reads frontmatter base', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  expect(__butlerHelpers.getActivePersona().base).toBe('classic')
})

test('handler: setActivePersona copies preset and rewrites name+base', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  __butlerHelpers.setActivePersona('pragmatic')
  const raw = readFileSync(join(BUTLER_HOME, 'personas', 'active.md'), 'utf8')
  expect(raw).toContain('name: active')
  expect(raw).toContain('base: pragmatic')
  expect(__butlerHelpers.getActivePersona().base).toBe('pragmatic')
  expect(() => __butlerHelpers.setActivePersona('nope')).toThrow(/Invalid persona/)
})

test('handler: queryMemoryGraph returns [] when DB absent (graceful)', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  expect(existsSync(join(BUTLER_DATA, 'memory', 'db', 'graph.sqlite'))).toBe(false)
  const rows = await __butlerHelpers.queryMemoryGraph('anything')
  expect(rows).toEqual([])
})

test('handler: shellEscape protects single quotes for dispatch', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  expect(__butlerHelpers.shellEscape(`don't break it`)).toBe(`'don'\\''t break it'`)
})

test('handler: VALID_MODELS / PERSONA_PRESETS exposed for keyboards', async () => {
  const { __butlerHelpers } = await import('./server.ts')
  expect(__butlerHelpers.VALID_MODELS).toContain('sonnet')
  expect(__butlerHelpers.VALID_MODELS).toContain('opus[1m]')
  expect(__butlerHelpers.PERSONA_PRESETS).toEqual(['classic', 'pragmatic', 'friendly', 'hacker'])
})
