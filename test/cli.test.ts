import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { main, stripJsonc } from '../src/cli.js'

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'rt7-cli-'))
  mkdirSync(join(dir, 'src/components'), { recursive: true })
  mkdirSync(join(dir, 'src/pages'), { recursive: true })
  writeFileSync(join(dir, 'tsconfig.json'), `{
    // JSONC, as tsconfig files often are
    "compilerOptions": { "baseUrl": "./src", "paths": { "@ui/*": ["components/*"] }, },
  }`)
  writeFileSync(join(dir, 'src/components/Grid.tsx'), `import { useTable, useSortBy, Column } from 'react-table'
export function Grid<T extends object>({ columns, data }: { columns: Column<T>[]; data: T[] }) {
  const { rows, prepareRow, headerGroups } = useTable({ columns, data }, useSortBy)
  return <table>{headerGroups.map((g) => <tr {...g.getHeaderGroupProps()}>{g.headers.map((c) => <th {...c.getHeaderProps(c.getSortByToggleProps())}>{c.render('Header')}</th>)}</tr>)}{rows.map((row) => { prepareRow(row); return <tr {...row.getRowProps()}>{row.cells.map((cell) => <td {...cell.getCellProps()}>{cell.render('Cell')}</td>)}</tr> })}</table>
}
`)
  writeFileSync(join(dir, 'src/pages/users.tsx'), `import { Column } from 'react-table'
import { Grid } from '@ui/Grid'
type User = { name: string }
const columns: Column<User>[] = [{ Header: 'Name', accessor: 'name' }]
export const Users = () => <Grid columns={columns} data={[]} />
`)
  writeFileSync(join(dir, 'src/types.d.ts'), `declare module 'react-table' {
  export interface TableOptions<D extends object> {}
}
`)
  writeFileSync(join(dir, 'src/other.ts'), `export const x = 1\n`)
  return dir
}

function capture() {
  const out: string[] = []
  return { out, io: { log: (s: string) => out.push(s), error: (s: string) => out.push(s) } }
}

describe('cli', () => {
  it('--dry reports without writing', async () => {
    const dir = project()
    const before = readFileSync(join(dir, 'src/components/Grid.tsx'), 'utf8')
    const { out, io } = capture()
    expect(await main(['--dry', join(dir, 'src')], io)).toBe(0)
    const text = out.join('\n')
    expect(text).toMatch(/Grid\.tsx: would change, 1 useTable call/)
    expect(text).toMatch(/users\.tsx: would change/)
    expect(text).toMatch(/TODO .*types\.d\.ts:1 .*augments react-table's types/)
    expect(text).toMatch(/2 files would change, 1 TODO to review/)
    expect(readFileSync(join(dir, 'src/components/Grid.tsx'), 'utf8')).toBe(before)
  })

  it('writes files and links a column file to the table file it imports (tsconfig paths)', async () => {
    const dir = project()
    const { io } = capture()
    expect(await main([join(dir, 'src')], io)).toBe(0)
    const grid = readFileSync(join(dir, 'src/components/Grid.tsx'), 'utf8')
    const users = readFileSync(join(dir, 'src/pages/users.tsx'), 'utf8')
    expect(grid).toMatch(/export const features = tableFeatures\(/)
    expect(grid).toMatch(/columns: ColumnDef<typeof features, T, any>\[\]/)
    expect(users).toMatch(/import type \{ features \} from '@ui\/Grid'/)
    expect(users).toMatch(/const columns: ColumnDef<typeof features, User, any>\[\]/)
    expect(users).not.toMatch(/from 'react-table'/)
    // a second run finds nothing left to change
    const again = capture()
    await main(['--dry', join(dir, 'src')], again.io)
    expect(again.out.join('\n')).not.toMatch(/would change/)
  })

  it('--json prints a machine-readable report', async () => {
    const dir = project()
    const { out, io } = capture()
    await main(['--json', '--dry', join(dir, 'src/components/Grid.tsx')], io)
    const report = JSON.parse(out.join('\n'))
    expect(report.dry).toBe(true)
    expect(report.files).toHaveLength(1)
    expect(report.files[0]).toMatchObject({ changed: true, tables: 1, featuresVar: 'features' })
    expect(report.files[0].features).toContain('rowSortingFeature')
  })

  it('reports files it cannot parse and exits 1', async () => {
    const dir = project()
    writeFileSync(join(dir, 'src/broken.jsx'), `import { useTable } from 'react-table'\nconst x = (\n`)
    const { out, io } = capture()
    expect(await main(['--dry', join(dir, 'src/broken.jsx')], io)).toBe(1)
    expect(out.join('\n')).toMatch(/broken\.jsx: error/)
  })

  it('prints help', async () => {
    const { out, io } = capture()
    expect(await main(['--help'], io)).toBe(0)
    expect(out.join('\n')).toMatch(/Usage: react-table-v7-migrate/)
  })

  it('strips JSONC comments but not // or /* inside strings', () => {
    expect(JSON.parse(stripJsonc('{ "a": "x/*y", // c\n "b": "http://z", /* d */ }'))).toEqual({ a: 'x/*y', b: 'http://z' })
  })
})
