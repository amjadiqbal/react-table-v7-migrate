import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'

// The TypeScript fixtures' codemod output must compile (strict) against @tanstack/react-table 9.
it('TypeScript outputs compile against @tanstack/react-table 9 (strict)', () => {
  const r = spawnSync('npx', ['--no-install', 'tsc', '-p', 'test/tsconfig.fixtures.json'], { encoding: 'utf8' })
  expect(r.stdout + r.stderr).toBe('')
  expect(r.status).toBe(0)
}, 120_000)
