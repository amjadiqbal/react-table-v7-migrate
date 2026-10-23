#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { glob } from 'tinyglobby'
import { transformSource, type TransformOptions, type TransformResult } from './transform/index.js'

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
  const files = await glob(patterns, { ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'], absolute: true })
  const reports: FileReport[] = []
  const sources = new Map<string, string>()
  const results = new Map<string, TransformResult>()
  const options = new Map<string, TransformOptions>()
  const run = (file: string) => {
    const result = transformSource(sources.get(file)!, { filename: file, ...options.get(file) })
    results.set(file, result)
  }
  for (const file of files.sort()) {
    const source = readFileSync(file, 'utf8')
    if (!source.includes('react-table')) continue
    sources.set(file, source)
    try {
      run(file)
    } catch (err) {
      reports.push({ file: relative(process.cwd(), file) || file, changed: false, notes: [], features: [], tables: 0, featuresVar: null, wantsFeaturesType: false, error: (err as Error).message })
    }
  }

  // TypeScript: a file with column types but no table uses the features type of the table file it
  // imports (or of the only table file in this run). That file exports its features.
  const providers = [...results].filter(([, r]) => r.featuresVar).map(([f]) => f)
  for (const [file, result] of [...results]) {
    if (!result.wantsFeaturesType) continue
    const linked = importedProviders(file, sources.get(file)!, providers)
    const target = linked.length === 1 ? linked[0] : providers.length === 1 ? { file: providers[0], specifier: relativeSpecifier(file, providers[0]) } : null
    if (!target) continue
    options.set(file, { featuresImport: { from: target.specifier, name: results.get(target.file)!.featuresVar! } })
    options.set(target.file, { ...options.get(target.file), exportFeatures: true })
  }
  for (const file of options.keys()) run(file)

  for (const [file, result] of results) {
    const rel = relative(process.cwd(), file) || file
    if (!result.changed && !result.notes.length) continue
    const { code, ...rest } = result
    reports.push({ file: rel, ...rest })
    if (result.changed && !dry) writeFileSync(file, code)
    if (result.changed && values.print) console.log(`// ===== ${rel}\n${code}`)
  }
  reports.sort((a, b) => a.file.localeCompare(b.file))
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

const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']

/** Table files (from `providers`) that `file` imports, with the specifier it uses. */
function importedProviders(file: string, source: string, providers: string[]) {
  const found: { file: string; specifier: string }[] = []
  const roots = moduleRoots(file)
  for (const m of source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    const bases = spec.startsWith('.') ? [resolve(dirname(file), spec)] : roots.flatMap((r) => r(spec))
    for (const base of bases) {
      const hit = EXTS.map((e) => base + e).find((p) => providers.includes(p))
      if (hit && !found.some((f) => f.file === hit)) found.push({ file: hit, specifier: spec })
    }
  }
  return found
}

/** Non-relative import roots from the nearest tsconfig/jsconfig (baseUrl and simple `paths`). */
function moduleRoots(file: string): ((spec: string) => string[])[] {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const p = join(dir, name)
      if (!existsSync(p)) continue
      try {
        const json = JSON.parse(stripJsonc(readFileSync(p, 'utf8')))
        const base = resolve(dir, json.compilerOptions?.baseUrl ?? '.')
        const paths: Record<string, string[]> = json.compilerOptions?.paths ?? {}
        return [
          (spec) => [join(base, spec)],
          (spec) => Object.entries(paths).flatMap(([from, tos]) => {
            const prefix = from.replace(/\*$/, '')
            if (!(from.endsWith('*') ? spec.startsWith(prefix) : spec === from)) return []
            return tos.map((to) => join(base, to.replace(/\*$/, '') + (from.endsWith('*') ? spec.slice(prefix.length) : '')))
          }),
        ]
      } catch {
        return []
      }
    }
    if (dirname(dir) === dir) return []
  }
}

/** tsconfig.json is JSONC: drop comments (outside strings) and trailing commas. */
export function stripJsonc(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === '\\') out += text[++i] ?? ''
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2)
      if (i === -1) break
      i++
    } else out += c
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

function relativeSpecifier(from: string, to: string) {
  const rel = relative(dirname(from), to).replace(/\.(c|m)?[jt]sx?$/, '').replace(/\\/g, '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

