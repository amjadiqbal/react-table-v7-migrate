// Copies react-table v7.8.0 example apps (MIT, https://github.com/TanStack/table/tree/v7.8.0/examples,
// commit 7535f8fd51a2aa784949e32a68b9bb24c8a6c811) into test/fixtures/v7-examples/<name>/input.jsx.
// Usage: node scripts/prepare-v7-fixtures.mjs <path to a v7.8.0 checkout>
// Changes made to each App.js (and nothing else):
//  - styled-components is replaced by a plain <div> (styles are irrelevant to the tests)
//  - makeData comes from ../makeData.js (seeded, deterministic) instead of namor + Math.random
//  - `import matchSorter from 'match-sorter'` becomes the named import current match-sorter exports
//  - large row counts are capped at 300 so the jsdom tests stay fast
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
const names = ['basic', 'sorting', 'filtering', 'pagination', 'pagination-controlled', 'row-selection',
  'row-selection-and-pagination', 'expanding', 'footers', 'column-hiding', 'editable-data', 'sub-components',
  'kitchen-sink', 'column-ordering']
for (const name of names) {
  let src = readFileSync(join(root, 'examples', name, 'src', 'App.js'), 'utf8')
  src = src.replace("import styled from 'styled-components'\n", '')
  src = src.replace(/const Styles = styled\.div`[\s\S]*?\n`\n/, 'const Styles = ({ children }) => <div>{children}</div>\n')
  src = src.replace("import makeData from './makeData'", "import makeData from '../makeData.js'")
  src = src.replace("import matchSorter from 'match-sorter'", "import { matchSorter } from 'match-sorter'")
  src = src.replace(/makeData\((\d+)/g, (m, n) => `makeData(${Math.min(Number(n), 300)}`)
  mkdirSync(join('test/fixtures/v7-examples', name), { recursive: true })
  writeFileSync(join('test/fixtures/v7-examples', name, 'input.jsx'), src)
}
console.log(`copied ${names.length} examples`)
