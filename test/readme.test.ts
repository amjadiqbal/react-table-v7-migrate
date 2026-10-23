import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { transformSource } from '../src/index.js'

// The README's Before/After example must be the codemod's real output.
it('README example is the real codemod output', () => {
  const readme = readFileSync('README.md', 'utf8')
  const block = (heading: string) => {
    const at = readme.indexOf(heading)
    const start = readme.indexOf('```jsx\n', at) + '```jsx\n'.length
    return readme.slice(start, readme.indexOf('\n```', start))
  }
  const before = block('Before (the v7 sorting example')
  const after = block('After (the codemod')
  const actual = transformSource(before + '\n', { filename: 'Table.jsx' }).code
  expect(actual.split('\n').filter((l) => l.trim()).join('\n')).toBe(after)
})
