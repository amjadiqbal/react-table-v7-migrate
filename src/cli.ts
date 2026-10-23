#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { glob } from 'tinyglobby'
import { transformSource, type TransformResult } from './transform/index.js'

const HELP = `Usage: react-table-v7-migrate [options] <paths or globs...>

Rewrites react-table v7 code to TanStack Table v9. Directories are searched for
.js, .jsx, .ts and .tsx files (node_modules, dist and build are skipped).

Options:
  --dry        Do not write files; print the report only
  --print      Print each changed file's new code to stdout (implies --dry)
  --json       Print the report as JSON
  -h, --help   Show this help

Files are rewritten in place: commit or back up first. Every place the codemod
could not migrate safely gets a "// TODO(react-table-v7-migrate):" comment.`

interface FileReport extends Omit<TransformResult, 'code'> {
  file: string
  error?: string
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dry: { type: 'boolean', default: false },
      print: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help || !positionals.length) {
    console.log(HELP)
    process.exit(values.help ? 0 : 1)
  }
  const dry = values.dry || values.print
  const patterns = positionals.map((p) => (/[*?{[]/.test(p) || /\.[cm]?[jt]sx?$/.test(p) ? p : `${p.replace(/\/$/, '')}/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`))
  const files = await glob(patterns, { ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts'], absolute: true })
  const reports: FileReport[] = []
  for (const file of files.sort()) {
    const source = readFileSync(file, 'utf8')
    if (!source.includes('react-table')) continue
    const rel = relative(process.cwd(), file) || file
    try {
      const result = transformSource(source, { filename: file })
      if (!result.changed && !result.notes.length) continue
      const { code, ...rest } = result
      reports.push({ file: rel, ...rest })
      if (result.changed && !dry) writeFileSync(file, code)
      if (result.changed && values.print) console.log(`// ===== ${rel}\n${code}`)
    } catch (err) {
      reports.push({ file: rel, changed: false, notes: [], features: [], tables: 0, error: (err as Error).message })
    }
  }
  if (values.json) {
    console.log(JSON.stringify({ dry, files: reports }, null, 2))
    return
  }
  const out = values.print ? console.error : console.log
  if (!reports.length) {
    out('No react-table v7 code found.')
    return
  }
  for (const r of reports) {
    const status = r.error ? 'error' : r.changed ? (dry ? 'would change' : 'changed') : 'unchanged'
    out(`\n${r.file}: ${status}${r.tables ? `, ${r.tables} useTable call${r.tables > 1 ? 's' : ''}` : ''}`)
    if (r.error) out(`  could not parse or transform: ${r.error}`)
    if (r.features.length) out(`  features: ${r.features.join(', ')}`)
    for (const n of r.notes) out(`  ${n.level === 'todo' ? 'TODO' : 'note'} ${r.file}:${n.line}  ${n.message}`)
  }
  const todos = reports.reduce((s, r) => s + r.notes.filter((n) => n.level === 'todo').length, 0)
  const changed = reports.filter((r) => r.changed).length
  const errors = reports.filter((r) => r.error).length
  out(`\n${changed} file${changed === 1 ? '' : 's'} ${dry ? 'would change' : 'changed'}, ${todos} TODO${todos === 1 ? '' : 's'} to review${errors ? `, ${errors} could not be processed` : ''}.`)
  if (!dry && changed) out('Next: npm uninstall react-table @types/react-table && npm install @tanstack/react-table@^9 (and this package, if the code imports its /compat helpers).')
  if (errors) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

