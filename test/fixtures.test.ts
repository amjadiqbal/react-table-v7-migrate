import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { transformSource } from '../src/index.js'

// Each fixture folder holds input.(jsx|tsx) and the reviewed codemod output, output.(jsx|tsx).
// UPDATE_FIXTURES=1 rewrites the outputs (review the diff before committing).
const roots = ['test/fixtures/v7-examples', 'test/fixtures/cases']

for (const root of roots) {
  if (!existsSync(root)) continue
  describe(root, () => {
    for (const name of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
      const ext = existsSync(join(root, name, 'input.tsx')) ? 'tsx' : 'jsx'
      it(name, () => {
        const input = readFileSync(join(root, name, `input.${ext}`), 'utf8')
        const result = transformSource(input, { filename: `input.${ext}` })
        const notes = result.notes.map((n) => `${n.level} ${n.line}: ${n.message}`).join('\n')
        const outFile = join(root, name, `output.${ext}`)
        const notesFile = join(root, name, 'notes.txt')
        if (process.env.UPDATE_FIXTURES) {
          writeFileSync(outFile, result.code)
          writeFileSync(notesFile, notes + '\n')
        }
        expect(result.code).toBe(readFileSync(outFile, 'utf8'))
        expect(notes + '\n').toBe(readFileSync(notesFile, 'utf8'))
        // idempotent: running again on the output changes nothing
        expect(transformSource(result.code, { filename: `output.${ext}` }).changed).toBe(false)
      })
    }
  })
}
