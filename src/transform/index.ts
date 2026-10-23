import {
  addComment,
  builders as b,
  declScope,
  expr,
  findRefs,
  isCall,
  isFunction,
  isMember,
  keyName,
  memberName,
  parseFile,
  patternNames,
  printFile,
  quoteStyle,
  printNode,
  replace,
  setTsMode,
  stmts,
  usedNames,
  walk,
  type Node,
  type Path,
} from './ast.js'
import { Ctx, type Binding, type Kind, type Note } from './context.js'
import { rewriteUse, removeStatement } from './members.js'
import {
  COLUMN_KEEP,
  COLUMN_MARKERS,
  COLUMN_NEGATIONS,
  COLUMN_RENAMES,
  FEATURE_ORDER,
  FILTER_TYPES,
  INSTANCE,
  OPTION_DROPPED_AUTORESET,
  OPTION_KEEP,
  OPTION_NEGATIONS,
  OPTION_RENAMES,
  OPTION_TODO,
  PLUGINS,
  ROW_MODEL_ORDER,
  SORT_TYPES,
  STATE_NEEDS,
  STATE_READ,
  UNSUPPORTED_PLUGINS,
  type Need,
} from './maps.js'

export type { Note } from './context.js'

export interface TransformResult {
  code: string
  changed: boolean
  notes: Note[]
  /** v9 features registered in the generated `tableFeatures({...})` call(s). */
  features: string[]
  /** Number of useTable calls migrated. */
  tables: number
  /** The module-level `features` variable this file declares, if exactly one. */
  featuresVar: string | null
  /** True when the file uses v7 types but has no table of its own (types fall back to `any` features). */
  wantsFeaturesType: boolean
}

export interface TransformOptions {
  /** Used to pick the parser (ts/tsx/js/jsx). Defaults to `file.tsx`. */
  filename?: string
  /** Export the generated module-level `features` (another file types its columns with it). */
  exportFeatures?: boolean
  /** Type this file's v9 types with another module's features: `import type { name } from from`. */
  featuresImport?: { from: string; name: string }
}

const COMPAT = '@amjadiqbal/react-table-v7-migrate/compat'
const V9 = '@tanstack/react-table'
const ITERATORS = new Set(['map', 'forEach', 'filter', 'find', 'findLast', 'some', 'every', 'flatMap'])
const PRESERVING = new Set(['slice', 'filter', 'concat', 'sort', 'reverse', 'toSorted', 'toReversed'])
const COLLECTION_OF: Partial<Record<Kind, Record<string, Kind>>> = {
  headerGroup: { headers: 'headers' },
  header: { headers: 'headers' },
  row: { cells: 'cells' as Kind, allCells: 'cells' as Kind, subRows: 'rows' },
  column: { columns: 'columns' },
}
const ELEMENT_OF: Record<string, Kind> = { headerGroups: 'headerGroup', rows: 'row', columns: 'column', headers: 'header', cells: 'cell' }
const INSTANCE_COLLECTIONS: Record<string, Kind> = {
  headerGroups: 'headerGroups', footerGroups: 'headerGroups', rows: 'rows', page: 'rows', flatRows: 'rows',
  selectedFlatRows: 'rows', preGlobalFilteredRows: 'rows', globalFilteredRows: 'rows', preFilteredRows: 'rows',
  filteredRows: 'rows', preSortedRows: 'rows', sortedRows: 'rows', expandedRows: 'rows',
  allColumns: 'columns', visibleColumns: 'columns', columns: 'columns', flatHeaders: 'headers',
}
const DISTINCTIVE: Record<string, Kind> = {
  getHeaderGroupProps: 'headerGroup', getFooterGroupProps: 'headerGroup',
  getHeaderProps: 'header', getFooterProps: 'header', getSortByToggleProps: 'header', getResizerProps: 'header', isSortedDesc: 'header',
  getRowProps: 'row', getToggleRowSelectedProps: 'row', getToggleRowExpandedProps: 'row',
  getCellProps: 'cell',
  getToggleHiddenProps: 'column',
}

interface Table {
  call: Node
  name: string
  scope: Node
  needs: Need[]
  featuresVar?: string
  /** Options object of the call, for generated options. */
  options: Node | null
  statementPath: Path
  fnsInComponent: boolean
  userTypes: Node[]
}

export function transformSource(source: string, options: TransformOptions = {}): TransformResult {
  const filename = options.filename ?? 'file.tsx'
  const ts = /\.(c|m)?tsx?$/.test(filename)
  setTsMode(ts)
  const ast = parseFile(source, filename)
  const program = ast.program
  const ctx = new Ctx(ts)
  ctx.source = source
  const unchanged = (): TransformResult => ({ code: source, changed: false, notes: ctx.notes, features: [], tables: 0, featuresVar: null, wantsFeaturesType: false })

  let augments = false
  walk(program, (p) => {
    if (p.node.type === 'TSModuleDeclaration' && p.node.id?.value === 'react-table') {
      augments = true
      ctx.note('todo', "this file augments react-table's types (`declare module 'react-table'`); delete it once the app is on v9 (v9 types come from the features you register)", p.node)
    }
  }, { types: true })
  const rtImports = program.body.filter((s: Node) => s.type === 'ImportDeclaration' && s.source.value === 'react-table')
  if (!rtImports.length || augments) return unchanged()

  // local name → imported name
  const imported = new Map<string, string>()
  const typeOnly = new Set<string>()
  for (const decl of rtImports) {
    for (const s of decl.specifiers) {
      if (s.type === 'ImportSpecifier') {
        imported.set(s.local.name, s.imported.name ?? s.imported.value)
        if (decl.importKind === 'type' || s.importKind === 'type') typeOnly.add(s.local.name)
      } else {
        ctx.note('todo', `\`import ${s.type === 'ImportNamespaceSpecifier' ? '* as ' : ''}${s.local.name} from 'react-table'\` is not migrated; use named imports`, decl, { node: decl, parent: program, key: 0, list: program.body, parentPath: null })
        return unchanged()
      }
    }
  }
  const localOf = (name: string) => [...imported].find(([, v]) => v === name)?.[0]
  const names = usedNames(ast)
  for (const st of program.body) {
    if (st.type === 'FunctionDeclaration' && st.id) ctx.functionNames.add(st.id.name)
    if (st.type === 'VariableDeclaration') for (const d of st.declarations) if (d.id.type === 'Identifier' && isFunction(d.init)) ctx.functionNames.add(d.id.name)
  }
  const fresh = (base: string, taken: Set<string> = names) => {
    let n = base
    for (let i = 2; taken.has(n); i++) n = `${base}${i}`
    taken.add(n)
    return n
  }

  const tables: Table[] = []
  const useTableLocal = localOf('useTable')

  // ---- 1. useTable calls ---------------------------------------------------------------------
  if (useTableLocal) {
    const calls: Path[] = []
    walk(program, (p) => {
      if (isCall(p.node) && p.node.callee.type === 'Identifier' && p.node.callee.name === useTableLocal) calls.push(p)
    })
    for (const callPath of calls) {
      const t = migrateUseTable(callPath, ctx, imported, fresh)
      if (t) tables.push(t)
    }
  }

  // ---- 2. column definitions -------------------------------------------------------------------
  const columnObjects: Path[] = []
  walk(program, (p) => {
    if (p.node.type === 'ObjectExpression' && p.node.properties.some((q: Node) => COLUMN_MARKERS.has(keyName(q) ?? ''))) columnObjects.push(p)
  })
  for (const t of tables) for (const d of t.userTypes) void d
  const defaultColumns = collectDefaultColumns(tables, program)
  for (const p of defaultColumns) if (!columnObjects.some((c) => c.node === p.node)) columnObjects.push(p)
  const doneRenderers = new WeakSet<Node>()
  for (const p of columnObjects) migrateColumn(p, ctx, program, doneRenderers)

  // ---- 3. classify render-time objects ---------------------------------------------------------
  classify(program, ctx)

  // ---- 4. rewrite every use of every classified binding (innermost first) ----------------------
  renameHeaderParams(ctx)
  const work: { path: Path; binding: Binding }[] = []
  for (const binding of ctx.bindings) {
    if (['headerGroups', 'rows', 'columns', 'headers', 'cells'].includes(binding.kind)) {
      // `rows[0].values[id]`: an element read by index
      const element = ELEMENT_OF[binding.kind]
      for (const path of findRefs(binding.scope, binding.name)) {
        const parent = path.parent
        if (isMember(parent) && parent.computed && parent.object === path.node && isMember(path.parentPath!.parent) && path.parentPath!.parent.object === parent) {
          work.push({ path: path.parentPath!, binding: { ...binding, kind: element } })
        }
      }
      continue
    }
    // generated code (no source position) is already v9
    for (const path of findRefs(binding.scope, binding.name)) if (path.node.start != null) work.push({ path, binding })
  }
  work.sort((x, y) => (y.path.node.start ?? 0) - (x.path.node.start ?? 0))
  const tableOf = (binding: Binding) => binding.table
  for (const { path, binding } of work) {
    const t = tables.find((x) => x.name === tableOf(binding))
    rewriteUse(path, binding.kind, ctx, { table: tableOf(binding), pagination: !!t?.needs.some((n) => n.kind === 'feature' && n.name === 'rowPaginationFeature') })
  }

  // ---- 5. features and imports -----------------------------------------------------------------
  const featuresVar = buildFeatures(tables, ctx, program, fresh)
  if (featuresVar && options.exportFeatures) {
    const decl = program.body.find((st: Node) => st.type === 'VariableDeclaration' && st.declarations[0]?.id.name === featuresVar)
    if (decl) program.body.splice(program.body.indexOf(decl), 1, b.exportNamedDeclaration(decl, []))
  }
  let F = featuresVar ? `typeof ${featuresVar}` : 'any'
  if (!featuresVar && options.featuresImport && ts) {
    const local = names.has(options.featuresImport.name) ? fresh(`${options.featuresImport.name}Type`) : options.featuresImport.name
    const spec: Node = b.importSpecifier(b.identifier(options.featuresImport.name), b.identifier(local))
    const decl: Node = b.importDeclaration([spec], b.stringLiteral(options.featuresImport.from))
    decl.importKind = 'type'
    program.body.splice(program.body.indexOf(rtImports[0]) + 1, 0, decl)
    F = `typeof ${local}`
  }
  const typedWithAny = fixImports(program, rtImports, imported, typeOnly, ctx, ts, F, names)

  const code = printFile(ast, quoteStyle(source))
  const features = new Set<string>()
  for (const t of tables) for (const n of [...t.needs, ...ctx.shared]) if (n.kind === 'feature') features.add(n.name)
  ctx.notes.sort((a, b2) => a.line - b2.line)
  return { code, changed: code !== source, notes: ctx.notes, features: [...features], tables: tables.length, featuresVar, wantsFeaturesType: typedWithAny && F === 'any' }
}

// ================================================================================================
// useTable
// ================================================================================================

function enclosingFunction(path: Path): Path | null {
  let p = path.parentPath
  while (p && !isFunction(p.node)) p = p.parentPath
  return p
}

function statementOf(path: Path): Path | null {
  let p: Path | null = path
  while (p && !(p.list && /Statement$|Declaration$/.test(p.node.type))) p = p.parentPath
  return p
}

function migrateUseTable(callPath: Path, ctx: Ctx, imported: Map<string, string>, fresh: (b: string) => string): Table | null {
  const call = callPath.node
  const fnPath = enclosingFunction(callPath)
  const stmtPath = statementOf(callPath)
  if (!fnPath || !stmtPath) {
    ctx.note('todo', 'useTable() outside a component function is not migrated', call, callPath)
    return null
  }
  const scope = fnPath.node.body
  const decl = callPath.parent?.type === 'VariableDeclarator' && callPath.parent.init === call ? callPath.parent : null
  const table: Table = {
    call,
    name: decl?.id.type === 'Identifier' ? decl.id.name : fresh('table'),
    scope,
    needs: [],
    options: null,
    statementPath: stmtPath,
    fnsInComponent: false,
    userTypes: [],
  }

  // Plugins
  const [opts, ...plugins] = call.arguments
  const prepend: Node[] = []
  let columnsWrap: Node | null = null
  for (const plugin of plugins) {
    const name = plugin.type === 'Identifier' ? imported.get(plugin.name) : undefined
    if (name && PLUGINS[name]) table.needs.push(...PLUGINS[name])
    else if (name && UNSUPPORTED_PLUGINS[name]) ctx.note('todo', UNSUPPORTED_PLUGINS[name], plugin, stmtPath)
    else if (plugin.type === 'ArrowFunctionExpression' || plugin.type === 'FunctionExpression') {
      columnsWrap = visibleColumnsHook(plugin, ctx, stmtPath) ?? columnsWrap
      // v7's hook types no longer type this function; `any` keeps noImplicitAny code compiling
      if (ctx.ts && columnsWrap && isFunction(columnsWrap)) {
        const p0 = columnsWrap.params[0]
        if (p0?.type === 'Identifier' && !p0.typeAnnotation) p0.typeAnnotation = b.tsTypeAnnotation(b.tsAnyKeyword())
        // typed as ColumnDef<features, any>[] once the features variable exists (see fixImports)
        if (!columnsWrap.returnType) ctx.columnArrayFns.push(columnsWrap)
      }
    } else ctx.note('todo', `plugin \`${printNode(plugin)}\` is not migrated`, plugin, stmtPath)
  }

  // Options
  if (opts?.type === 'ObjectExpression') {
    table.options = opts
    migrateOptions(opts, table, ctx, stmtPath)
    if (columnsWrap) {
      const cols = opts.properties.find((p: Node) => keyName(p) === 'columns')
      if (cols) {
        const name = fresh('columnsWithHooks')
        const useMemo = reactHook('useMemo', callPath)
        prepend.push(...stmts(`const ${name} = ${useMemo}(() => ($fn)($cols), [$deps])`, { fn: columnsWrap, cols: cols.value, deps: expr(printNode(cols.value)) }))
        cols.value = b.identifier(name)
        cols.shorthand = false
      }
    }
  } else if (opts) {
    ctx.note('todo', 'useTable options are passed as a variable; map them to v9 (features, initialState, ...) by hand', opts, stmtPath)
    call.arguments = [expr('({ ...$o })', { o: opts })]
    table.options = call.arguments[0]
  }
  call.arguments = [call.arguments[0]]
  // v7's useTable<D> becomes useTable<TFeatures, TData>; inference from features + columns does it
  if (call.typeParameters || call.typeArguments) {
    call.typeParameters = null
    call.typeArguments = null
  }

  // Destructuring → table + consts
  const after: Node[] = []
  if (decl && decl.id.type === 'ObjectPattern') {
    const pattern = decl.id
    decl.id = b.identifier(table.name)
    after.push(...expandInstance(pattern, table.name, scope, ctx, table, stmtPath, 'main'))
  } else if (decl && decl.id.type === 'Identifier') {
    ctx.bind(scope, table.name, 'instance', table.name)
    // later `const { ... } = instance` in the same component
    walk(scope, (p) => {
      const n = p.node
      if (n.type === 'VariableDeclarator' && n.init?.type === 'Identifier' && n.init.name === table.name && n.id.type === 'ObjectPattern') {
        const sp = statementOf(p)
        const pattern = n.id
        const consts = expandInstance(pattern, table.name, scope, ctx, table, sp, 'main')
        if (sp?.node.declarations.length === 1) {
          sp.list!.splice(sp.list!.indexOf(sp.node), 1, ...consts)
        }
        return false
      }
    })
  } else if (!decl) {
    ctx.note('todo', 'the useTable() result is not assigned to a variable; v9 returns the table instance', call, stmtPath)
  }

  const list = stmtPath.list!
  const i = list.indexOf(stmtPath.node)
  list.splice(i + 1, 0, ...after)
  list.splice(i, 0, ...prepend)
  ctx.v9Imports.add('useTable')
  return table
}

/** `hooks => { hooks.visibleColumns.push(columns => [...]) }` → the function to wrap columns with. */
function visibleColumnsHook(fn: Node, ctx: Ctx, at: Path): Node | null {
  const hooksName = fn.params[0]?.type === 'Identifier' ? fn.params[0].name : null
  const body = fn.body.type === 'BlockStatement' ? fn.body.body : [b.expressionStatement(fn.body)]
  let found: Node | null = null
  for (const s of body) {
    const e = s.type === 'ExpressionStatement' ? s.expression : null
    if (
      e && isCall(e) && isMember(e.callee) && memberName(e.callee) === 'push' && isMember(e.callee.object) &&
      memberName(e.callee.object) === 'visibleColumns' && e.callee.object.object.type === 'Identifier' &&
      e.callee.object.object.name === hooksName && e.arguments.length === 1 && !found
    ) {
      found = e.arguments[0]
    } else {
      ctx.note('todo', `plugin hook code \`${printNode(s).split('\n')[0]}\` is not migrated (only hooks.visibleColumns.push is)`, s, at)
    }
  }
  return found
}

function reactHook(name: string, at: Path): string {
  let root: Path | null = at
  while (root?.parentPath) root = root.parentPath
  const program = root?.node.type === 'File' ? root.node.program : root?.node
  for (const s of program?.body ?? []) {
    if (s.type !== 'ImportDeclaration' || s.source.value !== 'react') continue
    for (const sp of s.specifiers) {
      if (sp.type === 'ImportSpecifier' && (sp.imported.name ?? sp.imported.value) === name) return sp.local.name
    }
    for (const sp of s.specifiers) {
      if (sp.type === 'ImportDefaultSpecifier' || sp.type === 'ImportNamespaceSpecifier') return `${sp.local.name}.${name}`
    }
    s.specifiers.push(b.importSpecifier(b.identifier(name)))
    return name
  }
  program?.body.unshift(b.importDeclaration([b.importSpecifier(b.identifier(name))], b.stringLiteral('react')))
  return name
}

function migrateOptions(opts: Node, table: Table, ctx: Ctx, at: Path) {
  const meta: Node[] = []
  const out: Node[] = []
  const has = (k: string) => opts.properties.some((p: Node) => keyName(p) === k)
  for (const p of opts.properties) {
    const k = keyName(p)
    if (k == null) {
      out.push(p)
      continue
    }
    if (OPTION_KEEP.has(k)) out.push(p)
    else if (k === 'initialState') out.push(migrateInitialState(p, ctx, at))
    else if (OPTION_RENAMES[k]) out.push(renameProp(p, OPTION_RENAMES[k]))
    else if (OPTION_NEGATIONS[k]) out.push(negateProp(p, OPTION_NEGATIONS[k]))
    else if (OPTION_DROPPED_AUTORESET.has(k)) {
      ctx.note('info', `\`${k}\` was dropped: v9 never resets this state when data changes (v7 did by default)`, p)
    } else if (k === 'filterTypes' || k === 'sortTypes') {
      table.userTypes.push(p)
      // a module-level filterTypes/sortTypes constant lets features stay module-level (and typeable)
      const moduleLevel = p.value.type === 'Identifier' && declScope(at, p.value.name)?.type === 'Program'
      if (!moduleLevel) table.fnsInComponent = true
      const keys = p.value.type === 'ObjectExpression' ? p.value.properties.map(keyName) : resolveObjectKeys(p.value, at)
      for (const key of keys ?? []) if (key) (k === 'filterTypes' ? ctx.userFilterTypes : ctx.userSortTypes).add(key)
    } else if (k === 'globalFilter') {
      const v = p.value
      if (v.type === 'StringLiteral') out.push(b.objectProperty(b.identifier('globalFilterFn'), filterFnRef(v.value, ctx)))
      else {
        ctx.compatImports.add('fromV7FilterType')
        out.push(b.objectProperty(b.identifier('globalFilterFn'), expr('fromV7FilterType($f)', { f: v })))
      }
      table.needs = table.needs.filter((n) => !(n.kind === 'option' && n.name === 'globalFilterFn'))
    } else if (OPTION_TODO[k]) {
      ctx.note('todo', OPTION_TODO[k], p, at)
    } else {
      meta.push(p)
      ctx.metaKeys.add(k)
    }
  }
  if (meta.length) {
    out.push(b.objectProperty(b.identifier('meta'), b.objectExpression(meta)))
    ctx.note('info', `custom useTable options (${meta.map(keyName).join(', ')}) moved to \`meta\`; read them as table.options.meta`, opts)
  }
  // v7 read row.subRows by default; v9 only with getSubRows. Added where sub rows can matter.
  const subRowsMatter = table.needs.some((n) => n.kind === 'feature' && (n.name === 'rowExpandingFeature' || n.name === 'rowSelectionFeature')) || /\bsubRows\b/.test(ctx.source)
  if (!has('getSubRows') && subRowsMatter) {
    out.push(b.objectProperty(b.identifier('getSubRows'), expr(ctx.ts ? '(row: any) => row.subRows' : '(row) => row.subRows')))
  }
  opts.properties = out
}

function resolveObjectKeys(node: Node, at: Path): (string | null)[] | null {
  if (node.type !== 'Identifier') return null
  const scope = declScope(at, node.name)
  let keys: (string | null)[] | null = null
  if (!scope) return null
  walk(scope, (p) => {
    const n = p.node
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === node.name) {
      const obj = unwrapMemo(n.init)
      if (obj?.type === 'ObjectExpression') keys = obj.properties.map(keyName)
      return false
    }
  })
  return keys
}

/** `useMemo(() => ({...}), [])`, `React.useMemo(() => { return {...} })`, or the object itself. */
function unwrapMemo(init: Node): Node | null {
  if (!init) return null
  if (init.type === 'ObjectExpression' || init.type === 'ArrayExpression') return init
  if (isCall(init) && init.arguments[0] && /useMemo$/.test(printNode(init.callee))) {
    const fn = init.arguments[0]
    if (fn.body?.type === 'ObjectExpression' || fn.body?.type === 'ArrayExpression') return fn.body
    if (fn.body?.type === 'BlockStatement') {
      const ret = fn.body.body.find((s: Node) => s.type === 'ReturnStatement')
      return ret?.argument ?? null
    }
  }
  if (init.type === 'TSAsExpression' || init.type === 'TSSatisfiesExpression') return unwrapMemo(init.expression)
  return null
}

function renameProp(p: Node, to: string): Node {
  if (p.shorthand) return b.objectProperty(b.identifier(to), p.value)
  p.key = b.identifier(to)
  return p
}

function negateProp(p: Node, to: string): Node {
  const v = p.value
  const value = v.type === 'BooleanLiteral' ? b.booleanLiteral(!v.value) : expr('!$v', { v })
  return b.objectProperty(b.identifier(to), value)
}

function migrateInitialState(p: Node, ctx: Ctx, at: Path): Node {
  const v = p.value
  if (v.type !== 'ObjectExpression') {
    ctx.note('todo', 'initialState is not an object literal; rename its keys by hand (sortBy → sorting, filters → columnFilters, pageIndex/pageSize → pagination, selectedRowIds → rowSelection, hiddenColumns → columnVisibility)', p, at)
    return p
  }
  const out: Node[] = []
  let pageIndex: Node | null = null
  let pageSize: Node | null = null
  const rename: Record<string, string> = { sortBy: 'sorting', filters: 'columnFilters', selectedRowIds: 'rowSelection', groupBy: 'grouping' }
  for (const q of v.properties) {
    const k = keyName(q)
    if (k === 'pageIndex') pageIndex = q.value
    else if (k === 'pageSize') pageSize = q.value
    else if (k && rename[k]) out.push(renameProp(q, rename[k]))
    else if (k === 'hiddenColumns') {
      ctx.need(STATE_NEEDS.hiddenColumns)
      const value = q.value.type === 'ArrayExpression' && q.value.elements.every((e: Node) => e?.type === 'StringLiteral')
        ? b.objectExpression(q.value.elements.map((e: Node) => b.objectProperty(b.stringLiteral(e.value), b.booleanLiteral(false))))
        : expr('Object.fromEntries($h.map((id) => [id, false]))', { h: q.value })
      out.push(b.objectProperty(b.identifier('columnVisibility'), value))
    } else if (k === 'columnOrder') {
      ctx.need(STATE_NEEDS.columnOrder)
      out.push(q)
    } else if (k && !['globalFilter', 'expanded'].includes(k)) {
      ctx.note('todo', `initialState.${k} has no v9 mapping`, q, at)
      out.push(q)
    } else out.push(q)
  }
  if (pageIndex || pageSize) {
    out.push(b.objectProperty(b.identifier('pagination'), expr('({ pageIndex: $i, pageSize: $s })', {
      i: pageIndex ?? b.numericLiteral(0),
      s: pageSize ?? b.numericLiteral(10),
    })))
  }
  v.properties = out
  return p
}

/** Expand a destructured v7 instance into `const x = <v9 read>` statements. */
function expandInstance(pattern: Node, T: string, scope: Node, ctx: Ctx, table: Table | null, at: Path | null, mode: 'main' | 'renderer'): Node[] {
  const out: Node[] = []
  const pagination = !!table?.needs.some((n) => n.kind === 'feature' && n.name === 'rowPaginationFeature')
  for (const prop of pattern.properties) {
    if (prop.type === 'RestElement') {
      out.push(...stmts(`const ${printNode(prop.argument)} = ${T}`))
      ctx.note('todo', `\`...${printNode(prop.argument)}\` is the v9 table now`, prop, at)
      continue
    }
    const k = keyName(prop)
    if (k == null) continue
    let target = prop.value
    let fallback: Node | null = null
    if (target.type === 'AssignmentPattern') {
      fallback = target.right
      target = target.left
    }
    const withDefault = (code: string) => (fallback ? expr(`(${code}) ?? $d`, { d: fallback }) : expr(code))
    if (k === 'state') {
      if (target.type === 'Identifier') ctx.bind(scope, target.name, 'state', T)
      else if (target.type === 'ObjectPattern') {
        for (const sp of target.properties) {
          const sk = keyName(sp)
          if (!sk || sp.type === 'RestElement') {
            ctx.note('todo', 'rest element in the state pattern is not migrated', sp, at)
            continue
          }
          let st = sp.value
          let d: Node | null = null
          if (st.type === 'AssignmentPattern') {
            d = st.right
            st = st.left
          }
          ctx.need(STATE_NEEDS[sk])
          const read = STATE_READ[sk] ? STATE_READ[sk](T) : `${T}.state.${sk}`
          if (!STATE_READ[sk]) ctx.note('todo', `state.${sk} has no v9 mapping`, sp, at)
          out.push(b.variableDeclaration('const', [b.variableDeclarator(st, d ? expr(`(${read}) ?? $d`, { d }) : expr(read))]))
        }
      }
      continue
    }
    const entry = INSTANCE[k]
    if (entry) {
      ctx.need(entry.needs)
      if (target.type !== 'Identifier') {
        out.push(b.variableDeclaration('const', [b.variableDeclarator(target, expr(entry.read(T)))]))
        continue
      }
      if (entry.drop) {
        const refs = findRefs(scope, target.name)
        const remaining = refs.filter((r) => !dropRef(r))
        if (remaining.length) out.push(b.variableDeclaration('const', [b.variableDeclarator(target, expr(entry.read(T)))]))
        continue
      }
      const read = pagination && entry.paginationAware ? entry.paginationAware(T) : entry.read(T)
      out.push(b.variableDeclaration('const', [b.variableDeclarator(target, withDefault(read))]))
      if (INSTANCE_COLLECTIONS[k]) ctx.bind(scope, target.name, INSTANCE_COLLECTIONS[k])
      continue
    }
    // custom option or unknown instance property
    if (mode === 'main' && !ctx.metaKeys.has(k)) ctx.note('todo', `\`${k}\` is not a v7 table property the codemod knows; it now reads ${T}.options.meta?.${k}`, prop, at)
    out.push(b.variableDeclaration('const', [b.variableDeclarator(target, withDefault(`${T}.options.meta?.${k}`))]))
  }
  return out
}

/** Remove a droppable reference (`prepareRow(row)` statement, `{...getTableProps()}`). */
function dropRef(ref: Path): boolean {
  const parent = ref.parent
  if (!isCall(parent) || parent.callee !== ref.node) return false
  const callPath = ref.parentPath!
  if (callPath.parent?.type === 'ExpressionStatement') {
    removeStatement(callPath.parentPath!)
    return true
  }
  if (callPath.parent?.type === 'JSXSpreadAttribute') {
    const spreadPath = callPath.parentPath!
    const arg = parent.arguments[0]
    const list = spreadPath.list!
    const i = list.indexOf(spreadPath.node)
    if (!arg) list.splice(i, 1)
    else if (arg.type === 'ObjectExpression') list.splice(i, 1, ...arg.properties.map((p: Node) =>
      p.type === 'ObjectProperty' && keyName(p) && !p.computed
        ? b.jsxAttribute(b.jsxIdentifier(keyName(p)!), p.value.type === 'StringLiteral' ? b.stringLiteral(p.value.value) : b.jsxExpressionContainer(p.value))
        : b.jsxSpreadAttribute(p.type === 'SpreadElement' ? p.argument : b.objectExpression([p]))))
    else list.splice(i, 1, b.jsxSpreadAttribute(arg))
    return true
  }
  return false
}

// ================================================================================================
// Column definitions and renderers
// ================================================================================================

function collectDefaultColumns(tables: Table[], program: Node): Path[] {
  const found: Path[] = []
  for (const t of tables) {
    const p = t.options?.properties.find((q: Node) => keyName(q) === 'defaultColumn')
    if (!p) continue
    if (p.value.type === 'ObjectExpression') {
      walk(program, (x) => {
        if (x.node === p.value) found.push(x)
      })
    } else if (p.value.type === 'Identifier') {
      walk(t.scope, (x) => {
        if (x.node.type === 'VariableDeclarator' && x.node.id.type === 'Identifier' && x.node.id.name === p.value.name) {
          const obj = unwrapMemo(x.node.init)
          if (obj) walk(x.node, (y) => {
            if (y.node === obj) found.push(y)
          })
          return false
        }
      })
      if (!found.length) {
        walk(program, (x) => {
          if (x.node.type === 'VariableDeclarator' && x.node.id.type === 'Identifier' && x.node.id.name === p.value.name) {
            const obj = unwrapMemo(x.node.init)
            if (obj) walk(x.node, (y) => {
              if (y.node === obj) found.push(y)
            })
          }
        })
      }
    }
  }
  return found
}

type Role = 'header' | 'cell' | 'filter'
const RENDERER_ROLE: Record<string, Role> = { Header: 'header', Footer: 'header', Cell: 'cell', Aggregated: 'cell', Filter: 'filter' }

function migrateColumn(objPath: Path, ctx: Ctx, program: Node, done: WeakSet<Node>) {
  const obj = objPath.node
  const out: Node[] = []
  const meta: Node[] = []
  let id: string | null = null
  let dottedAccessor: string | null = null
  for (const p of obj.properties) {
    const k = keyName(p)
    if (k === 'id' && p.value?.type === 'StringLiteral') id = p.value.value
  }
  for (const p of obj.properties) {
    const k = keyName(p)
    if (k == null || p.type !== 'ObjectProperty') {
      if (p.type === 'ObjectMethod' && k && RENDERER_ROLE[k]) {
        // `Cell(props) { ... }` → `cell: (props) => { ... }` keeps `this`-free renderers working
        const fn = b.functionExpression(null, p.params, p.body)
        migrateRenderer(fn, RENDERER_ROLE[k], ctx, objPath)
        const prop = b.objectProperty(b.identifier(COLUMN_RENAMES[k] ?? k), fn)
        if (k === 'Filter') meta.push(b.objectProperty(b.identifier('Filter'), fn))
        else out.push(prop)
        continue
      }
      out.push(p)
      continue
    }
    if (k === 'accessor') {
      if (p.value.type === 'StringLiteral') {
        out.push(b.objectProperty(b.identifier('accessorKey'), p.value))
        if (p.value.value.includes('.')) dottedAccessor = p.value.value
      } else {
        if ((p.value.params?.length ?? 0) > 2) ctx.note('todo', "accessor functions get (row, index) in v9; v7's third argument ({ subRows, depth, data }) is gone", p, objPath)
        out.push(b.objectProperty(b.identifier('accessorFn'), p.value))
      }
      continue
    }
    if (RENDERER_ROLE[k]) {
      const role = RENDERER_ROLE[k]
      renderer(p.value, role, ctx, objPath, program, done)
      if (k === 'Filter') meta.push(b.objectProperty(b.identifier('Filter'), p.value))
      else out.push(renameProp(p, COLUMN_RENAMES[k]))
      if (k === 'Aggregated') ctx.note('todo', 'Aggregated → aggregatedCell, but grouping (useGroupBy) is not migrated', p, objPath)
      continue
    }
    if (k === 'filter') {
      out.push(b.objectProperty(b.identifier('filterFn'), filterValue(p.value, ctx)))
      continue
    }
    if (k === 'sortType') {
      out.push(b.objectProperty(b.identifier('sortFn'), sortValue(p.value, ctx)))
      continue
    }
    if (COLUMN_NEGATIONS[k]) {
      out.push(negateProp(p, COLUMN_NEGATIONS[k]))
      continue
    }
    if (COLUMN_RENAMES[k]) {
      if (['width', 'minWidth', 'maxWidth'].includes(k)) ctx.need({ kind: 'feature', name: 'columnSizingFeature' })
      if (k === 'aggregate') ctx.note('todo', 'aggregate → aggregationFn, but grouping (useGroupBy) is not migrated', p, objPath)
      out.push(renameProp(p, COLUMN_RENAMES[k]))
      continue
    }
    if (COLUMN_KEEP.has(k)) {
      out.push(p)
      continue
    }
    meta.push(p)
    ctx.metaKeys.add(k)
  }
  if (dottedAccessor && !id) out.unshift(b.objectProperty(b.identifier('id'), b.stringLiteral(dottedAccessor)))
  if (meta.length) {
    const existing = out.find((p) => keyName(p) === 'meta')
    if (existing?.value.type === 'ObjectExpression') existing.value.properties.push(...meta)
    else if (existing) {
      existing.value = expr('({ ...$m, ...$n })', { m: existing.value, n: b.objectExpression(meta) })
      existing.shorthand = false
    }
    else out.push(b.objectProperty(b.identifier('meta'), b.objectExpression(meta)))
  }
  obj.properties = out
}

function filterFnRef(name: string, ctx: Ctx): Node {
  // the file's own filterTypes (registered under their v7 names) win over built-ins, as in v7
  if (ctx.userFilterTypes.has(name)) return b.stringLiteral(name)
  const m = FILTER_TYPES[name]
  if (m) {
    registerFilter(m.v9, m.v9, ctx)
    return b.stringLiteral(m.v9)
  }
  ctx.note('todo', `filter type '${name}' is not a v7 built-in; register it in tableFeatures({ filterFns }) (wrap v7 functions with fromV7FilterType)`, null)
  return b.stringLiteral(name)
}

function registerFilter(key: string, v9: string, ctx: Ctx) {
  ctx.need({ kind: 'filterFn', key, v9 })
}

function filterValue(v: Node, ctx: Ctx): Node {
  if (v.type === 'StringLiteral') return filterFnRef(v.value, ctx)
  ctx.compatImports.add('fromV7FilterType')
  return expr('fromV7FilterType($f)', { f: v })
}

function sortValue(v: Node, ctx: Ctx): Node {
  if (v.type === 'StringLiteral') {
    const name = v.value
    if (ctx.userSortTypes.has(name)) return b.stringLiteral(name)
    const m = SORT_TYPES[name]
    if (m) {
      ctx.need({ kind: 'sortFn', key: m.v9, v9: m.v9 })
      return b.stringLiteral(m.v9)
    }
    ctx.note('todo', `sort type '${name}' is not a v7 built-in; register it in tableFeatures({ sortFns }) (wrap v7 functions with fromV7SortType)`, v)
    return v
  }
  ctx.compatImports.add('fromV7SortType')
  return expr('fromV7SortType($f)', { f: v })
}

/** A Header/Cell/Footer/Filter value: inline function, or a component defined in this file. */
function renderer(value: Node, role: Role, ctx: Ctx, at: Path, program: Node, done: WeakSet<Node>) {
  if (value.type === 'StringLiteral' || value.type === 'TemplateLiteral' || value.type === 'JSXElement' || value.type === 'JSXFragment') return
  if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') {
    if (!done.has(value)) {
      done.add(value)
      migrateRenderer(value, role, ctx, at)
    }
    return
  }
  if (value.type === 'Identifier') {
    const fn = findFunction(program, value.name)
    if (fn === 'wrapped') {
      ctx.note('todo', `\`${value.name}\` is wrapped (memo/forwardRef/HOC); update its props by hand: it now receives the v9 ${role === 'cell' ? 'cell' : 'header'} context`, value, at)
      return
    }
    if (!fn) {
      ctx.note('info', `\`${value.name}\` is not defined in this file; it now receives the v9 ${role === 'cell' ? 'cell context { getValue, row, column, cell, table }' : 'header context { column, header, table }'}`, value)
      return
    }
    if (!done.has(fn)) {
      done.add(fn)
      migrateRenderer(fn, role, ctx, at)
    }
    return
  }
  ctx.note('todo', `renderer \`${printNode(value).split('\n')[0]}\` is not migrated; it now receives the v9 ${role === 'cell' ? 'cell' : 'header'} context`, value, at)
}

function findFunction(program: Node, name: string): Node | 'wrapped' | null {
  for (const s0 of program.body) {
    const s = s0.type === 'ExportNamedDeclaration' || s0.type === 'ExportDefaultDeclaration' ? s0.declaration : s0
    if (!s) continue
    if (s.type === 'FunctionDeclaration' && s.id?.name === name) return s
    if (s.type === 'VariableDeclaration') {
      for (const d of s.declarations) {
        if (d.id.type !== 'Identifier' || d.id.name !== name) continue
        if (d.init?.type === 'ArrowFunctionExpression' || d.init?.type === 'FunctionExpression') return d.init
        if (isCall(d.init)) return 'wrapped'
      }
    }
  }
  return null
}

const ROLE_KIND: Record<string, Kind> = { row: 'row', cell: 'cell', column: 'column' }
const SAFE_NESTED: Record<string, Set<string>> = {
  row: new Set(['index', 'original', 'id', 'depth', 'subRows']),
  column: new Set(['id', 'depth', 'parent']),
  cell: new Set(['id']),
}

/** Rewrite a v7 renderer's props parameter to the v9 context. */
function migrateRenderer(fn: Node, role: Role, ctx: Ctx, at: Path) {
  const param = fn.params[0]
  if (!param) return
  if (param.type === 'Identifier') {
    ctx.bind(fn, param.name, role === 'cell' ? 'cellProps' : 'headerProps')
    return
  }
  if (param.type === 'AssignmentPattern' && param.left.type === 'ObjectPattern') fn.params[0] = param.left
  const pattern = fn.params[0]
  if (pattern.type !== 'ObjectPattern') return
  const prelude: Node[] = []
  const keep: Node[] = []
  const rest: Node[] = []
  let needTable = false
  let hasTable = false
  let getValue: string | null = null
  const fresh = new Set([...usedNames(fn.body), ...fn.params.slice(1).flatMap((x: Node) => [...usedNames(x)])])
  const pick = (base: string) => {
    let n = base
    for (let i = 2; fresh.has(n); i++) n = `${base}${i}`
    fresh.add(n)
    return n
  }
  for (const prop of pattern.properties) {
    const k = prop.type === 'RestElement' ? null : keyName(prop)
    if (k == null) {
      ctx.note('todo', 'a rest element in renderer props now collects the v9 context', prop, at)
      keep.push(prop)
      continue
    }
    if (k === 'table') hasTable = true
    let target = prop.value
    let fallback: Node | null = null
    if (target.type === 'AssignmentPattern') {
      fallback = target.right
      target = target.left
    }
    if (k === 'value' && role === 'cell') {
      getValue = getValue ?? pick('getValue')
      const read = `${getValue}()`
      prelude.push(b.variableDeclaration('const', [b.variableDeclarator(target, fallback ? expr(`${read} ?? $d`, { d: fallback }) : expr(read))]))
      continue
    }
    if (ROLE_KIND[k]) {
      const kind = ROLE_KIND[k]
      if (target.type === 'Identifier') {
        keep.push(prop)
        ctx.bind(fn, target.name, kind)
      } else if (target.type === 'ObjectPattern') {
        const safe = target.properties.every((q: Node) => q.type === 'ObjectProperty' && SAFE_NESTED[k]?.has(keyName(q) ?? ''))
        if (safe) keep.push(prop)
        else {
          const local = pick(k)
          keep.push(local === k
            ? b.objectProperty.from({ key: b.identifier(k), value: b.identifier(k), shorthand: true })
            : b.objectProperty(b.identifier(k), b.identifier(local)))
          // `column: { filterValue, setFilter, preFilteredRows, id }` → consts read from the v9 object
          for (const q of target.properties) {
            const qk = keyName(q)
            if (!qk || q.type !== 'ObjectProperty') {
              ctx.note('todo', `rest element in \`${k}\` props is not migrated`, q, at)
              continue
            }
            let qt = q.value
            let qd: Node | null = null
            if (qt.type === 'AssignmentPattern') {
              qd = qt.right
              qt = qt.left
            }
            const member = expr(`${local}.${qk}`)
            const holder = b.variableDeclaration('const', [b.variableDeclarator(qt, member)])
            prelude.push(holder)
            const decl: Node = holder.declarations[0]
            rewriteUse({ node: member.object, parent: member, key: 'object', list: null, parentPath: { node: member, parent: decl, key: 'init', list: null, parentPath: null } }, kind, ctx, {})
            if (qd) decl.init = expr('$v ?? $d', { v: decl.init, d: qd })
            if (qt.type === 'Identifier' && kind === 'column' && qk === 'preFilteredRows') ctx.bind(fn, qt.name, 'rows')
          }
          ctx.bind(fn, local, kind)
        }
      } else keep.push(prop)
      continue
    }
    if (k === 'header' || k === 'table' || k === 'getValue' || k === 'renderValue') {
      keep.push(prop)
      continue
    }
    rest.push(prop)
  }
  if (rest.length) {
    needTable = true
    const tableName = hasTable ? 'table' : pick('table')
    const consts = expandInstance(b.objectPattern(rest), tableName, fn.body, ctx, null, at, 'renderer')
    prelude.push(...consts)
    if (!hasTable) keep.push(tableName === 'table' ? b.objectProperty.from({ key: b.identifier('table'), value: b.identifier('table'), shorthand: true }) : b.objectProperty(b.identifier('table'), b.identifier(tableName)))
  }
  if (getValue) keep.unshift(getValue === 'getValue'
    ? b.objectProperty.from({ key: b.identifier('getValue'), value: b.identifier('getValue'), shorthand: true })
    : b.objectProperty(b.identifier('getValue'), b.identifier(getValue)))
  void needTable
  // mutating the original pattern lets recast keep its layout where it can
  pattern.properties = keep
  if (prelude.length) {
    if (fn.body.type !== 'BlockStatement') fn.body = b.blockStatement([...prelude, b.returnStatement(fn.body)])
    else fn.body.body.unshift(...prelude)
    // bindings created on the renderer's body scope must be found from the function node
    for (const binding of ctx.bindings) if (binding.scope === fn.body) binding.scope = fn
  }
}

/** `headerGroup.headers.map((column) => ...)`: v7 called headers columns; in v9 they are headers. */
function renameHeaderParams(ctx: Ctx) {
  for (const binding of ctx.bindings) {
    if (binding.kind !== 'header' || binding.name !== 'column' || !isFunction(binding.scope)) continue
    const fn = binding.scope
    if (fn.params[0]?.type !== 'Identifier' || fn.params[0].name !== 'column' || usedNames(fn).has('header')) continue
    for (const ref of findRefs(fn, 'column')) {
      if (ref.parent?.type === 'ObjectProperty' && ref.parent.shorthand) ref.parent.shorthand = false
      ref.node.name = 'header'
    }
    fn.params[0].name = 'header'
    binding.name = 'header'
  }
}

// ================================================================================================
// Classification
// ================================================================================================

function classify(program: Node, ctx: Ctx) {
  // Collections → loop parameters (and aliases like `const firstPage = rows.slice(0, 10)`).
  for (let i = 0; i < ctx.bindings.length; i++) {
    const binding = ctx.bindings[i]
    for (const ref of findRefs(binding.scope, binding.name)) {
      followCollection(ref, binding.kind, ctx)
      const subs = COLLECTION_OF[binding.kind]
      if (subs && isMember(ref.parent) && ref.parent.object === ref.node) {
        const sub = subs[memberName(ref.parent) ?? '']
        if (sub) followCollection(ref.parentPath!, sub, ctx)
      }
      if (['instance', 'cellProps', 'headerProps'].includes(binding.kind) && isMember(ref.parent) && ref.parent.object === ref.node) {
        const coll = INSTANCE_COLLECTIONS[memberName(ref.parent) ?? '']
        if (coll) followCollection(ref.parentPath!, coll, ctx)
      }
    }
  }
  // Anything else that uses a distinctive v7 member.
  walk(program, (p) => {
    const n = p.node
    let kind: Kind | undefined
    let objPath: Path | null = null
    if (isMember(n) && n.object.type === 'Identifier') {
      kind = DISTINCTIVE[memberName(n) ?? '']
      // `row.values` on a variable literally named row (v7 code passing rows around)
      if (!kind && memberName(n) === 'values' && n.object.name === 'row') kind = 'row'
      if (memberName(n) === 'render' && isCall(p.parent) && p.parent.arguments[0]?.type === 'StringLiteral') {
        const which = p.parent.arguments[0].value
        kind = which === 'Cell' || which === 'Aggregated' ? 'cell' : 'header'
      }
      objPath = { node: n.object, parent: n, key: 'object', list: null, parentPath: p }
    }
    if (kind && objPath) {
      const name = n.object.name
      const scope = declScope(objPath, name)
      if (scope && !ctx.bindings.some((x) => x.name === name && (x.scope === scope || x.scope.body === scope))) {
        const before = ctx.bindings.length
        ctx.bind(scopeOwner(objPath, scope), name, kind)
        // follow collections from newly classified objects too
        for (let i = before; i < ctx.bindings.length; i++) {
          for (const ref of findRefs(ctx.bindings[i].scope, name)) {
            const subs = COLLECTION_OF[kind]
            if (subs && isMember(ref.parent) && ref.parent.object === ref.node) {
              const sub = subs[memberName(ref.parent) ?? '']
              if (sub) followCollection(ref.parentPath!, sub, ctx)
            }
          }
        }
      }
    }
  })
}

/** The function node owning a scope body (bindings are keyed by function where possible). */
function scopeOwner(path: Path, scope: Node): Node {
  let p: Path | null = path
  while (p) {
    if (p.node === scope) return isFunction(p.parentPath?.node) && p.parentPath!.node.body === scope ? p.parentPath!.node : scope
    p = p.parentPath
  }
  return scope
}

/** `coll.slice(..).map((x) => ...)`: classify `x`; `const y = coll.filter(..)`: classify `y` as a collection. */
function followCollection(path: Path, kind: Kind, ctx: Ctx) {
  const element = ELEMENT_OF[kind]
  if (!element) return
  let p = path
  for (;;) {
    const parent = p.parent
    if (!isMember(parent) || parent.object !== p.node) break
    const method = memberName(parent)
    const callPath = p.parentPath!.parentPath
    if (!callPath || !isCall(callPath.node) || callPath.node.callee !== parent) break
    if (method && (ITERATORS.has(method) || method === 'reduce' || method === 'reduceRight')) {
      const cb = callPath.node.arguments[0]
      const i = method.startsWith('reduce') ? 1 : 0
      if (cb && isFunction(cb) && cb.params[i]?.type === 'Identifier') ctx.bind(cb, cb.params[i].name, element)
      if (method !== 'filter') return
    }
    if (method && PRESERVING.has(method)) {
      p = callPath
      continue
    }
    return
  }
  // aliasing
  if (p.parent?.type === 'VariableDeclarator' && p.parent.init === p.node && p.parent.id.type === 'Identifier' && p !== path) {
    const scope = declScope(p, p.parent.id.name)
    if (scope) ctx.bind(scopeOwner(p, scope), p.parent.id.name, kind)
  }
}

// ================================================================================================
// Features and imports
// ================================================================================================

/** Returns the module-level features variable when the file has exactly one. */
function buildFeatures(tables: Table[], ctx: Ctx, program: Node, fresh: (b: string, t?: Set<string>) => string): string | null {
  if (!tables.length) return null
  const moduleVars = new Set<string>()
  const generated = new Map<string, string>()
  const lastImport = () => {
    let i = 0
    program.body.forEach((s: Node, j: number) => {
      if (s.type === 'ImportDeclaration') i = j + 1
    })
    return i
  }
  for (const t of tables) {
    const needs = [...t.needs, ...ctx.shared]
    const features = new Set<string>()
    const rowModels = new Map<string, string>()
    const filterFns = new Map<string, string>()
    const sortFns = new Map<string, string>()
    const options = new Set<string>()
    for (const n of needs) {
      if (n.kind === 'feature') features.add(n.name)
      if (n.kind === 'rowModel') rowModels.set(n.slot, n.factory)
      if (n.kind === 'filterFn') filterFns.set(n.key, n.v9)
      if (n.kind === 'sortFn') sortFns.set(n.key, n.v9)
      if (n.kind === 'option') options.add(n.name)
    }
    // A row model needs its feature registered first; faceting and filtering go together.
    if (rowModels.has('facetedRowModel')) features.add('columnFacetingFeature')
    // v7's core always had column hiding (row.cells, visibleColumns); v9 needs the feature for them.
    features.add('columnVisibilityFeature')
    // v7 defaults made explicit
    const dc: string[] = []
    if (options.has('defaultFilterFn')) {
      // v7 fell back to its built-in text filter even when filterTypes overrode 'text'
      filterFns.set('includesString', 'includesString')
      dc.push(`filterFn: 'includesString'`)
    }
    if (options.has('sortDescFirst')) {
      const key = ctx.userSortTypes.has('alphanumeric') ? 'alphanumeric' : 'alphanumericCaseSensitive'
      if (key === 'alphanumericCaseSensitive') sortFns.set(key, 'alphanumericCaseSensitive')
      dc.push(`sortFn: '${key}'`)
    }
    const opts = t.options
    if (opts) {
      const has = (k: string) => opts.properties.some((p: Node) => keyName(p) === k)
      const add = (code: string) => opts.properties.push(...expr(`({ ${code} })`).properties)
      if (options.has('sortDescFirst') && !has('sortDescFirst')) add('sortDescFirst: false')
      if (options.has('globalFilterFn') && !has('globalFilterFn')) {
        filterFns.set('includesString', 'includesString')
        add(`globalFilterFn: 'includesString'`)
      }
      if (options.has('enableRowRangeSelection') && !has('enableRowRangeSelection')) add('enableRowRangeSelection: false')
      // v7 let any row expand (sub components); v9 only rows getRowCanExpand allows (default: has sub rows)
      if (options.has('getRowCanExpand') && !has('getRowCanExpand')) add('getRowCanExpand: () => true')
      if (dc.length) {
        const name = generated.get(`dc:${dc.join()}`) ?? fresh('v7DefaultColumn')
        if (!generated.has(`dc:${dc.join()}`)) {
          generated.set(`dc:${dc.join()}`, name)
          const what = [
            dc.some((d) => d.startsWith('filterFn')) ? "its built-in 'text' filter" : '',
            dc.some((d) => d.startsWith('sortFn')) ? 'its case-sensitive alphanumeric sort' : '',
          ].filter(Boolean).join(' and ')
          const decl = stmts(`const ${name} = { ${dc.join(', ')} }${ctx.ts ? ' as const' : ''}`)
          addComment(decl[0], `react-table v7's defaults on every column: ${what}`)
          program.body.splice(lastImport(), 0, ...decl)
        }
        const existing = opts.properties.find((p: Node) => keyName(p) === 'defaultColumn')
        if (existing) {
          existing.value = expr(`({ ...${name}, ...$d })`, { d: existing.value })
          existing.shorthand = false
        }
        else add(`defaultColumn: ${name}`)
      }
    }

    const lines: string[] = []
    const ordered = [...FEATURE_ORDER.filter((f) => features.has(f)), ...[...features].filter((f) => !FEATURE_ORDER.includes(f))]
    for (const f of ordered) {
      lines.push(f)
      ctx.v9Imports.add(f)
    }
    for (const slot of ROW_MODEL_ORDER) {
      const factory = rowModels.get(slot)
      if (!factory) continue
      lines.push(`${slot}: ${factory}()`)
      ctx.v9Imports.add(factory)
    }
    const fnsObject = (m: Map<string, string>, prefix: 'filterFn' | 'sortFn', compatNames: Set<string>) => {
      const parts: string[] = []
      for (const [key, v9] of m) {
        const ident = `${prefix}_${v9}`
        if (compatNames.has(v9)) ctx.compatImports.add(ident)
        else ctx.v9Imports.add(ident)
        parts.push(key === v9 ? `${key}: ${ident}` : `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${ident}`)
      }
      return parts
    }
    const filterParts = fnsObject(filterFns, 'filterFn', new Set(['v7Includes']))
    const sortParts = fnsObject(sortFns, 'sortFn', new Set(['v7Number']))
    const userFilter = t.userTypes.find((p) => keyName(p) === 'filterTypes')
    const userSort = t.userTypes.find((p) => keyName(p) === 'sortTypes')
    const subs: Record<string, Node> = {}
    if (userFilter) {
      ctx.compatImports.add('fromV7FilterTypes')
      filterParts.push('...fromV7FilterTypes($uf)')
      subs.uf = userFilter.value
    }
    if (userSort) {
      ctx.compatImports.add('fromV7SortTypes')
      sortParts.push('...fromV7SortTypes($us)')
      subs.us = userSort.value
    }
    if (filterParts.length) lines.push(`filterFns: { ${filterParts.join(', ')} }`)
    if (sortParts.length) lines.push(`sortFns: { ${sortParts.join(', ')} }`)
    ctx.v9Imports.add('tableFeatures')
    const body = `tableFeatures({${lines.length ? `\n  ${lines.join(',\n  ')},\n` : ''}})`

    let varName: string
    if (t.fnsInComponent) {
      varName = fresh('features')
      const useMemo = reactHook('useMemo', t.statementPath)
      const deps = Object.values(subs).filter((n) => n.type === 'Identifier').map((n) => n.name)
      const list = t.statementPath.list!
      list.splice(list.indexOf(t.statementPath.node), 0, ...stmts(`const ${varName} = ${useMemo}(() => ${body}, [${deps.join(', ')}])`, subs))
    } else if (generated.has(body)) varName = generated.get(body)!
    else {
      varName = fresh('features')
      generated.set(body, varName)
      // after the imports, and after any top-level declaration it uses (filterTypes), to avoid the TDZ
      let at = lastImport()
      const uses = Object.values(subs).filter((n) => n.type === 'Identifier').map((n) => n.name)
      program.body.forEach((st: Node, i: number) => {
        const declared = st.type === 'VariableDeclaration' ? st.declarations.flatMap((d: Node) => patternNames(d.id)) : st.type === 'FunctionDeclaration' ? [st.id?.name] : []
        if (declared.some((n: string) => uses.includes(n))) at = Math.max(at, i + 1)
      })
      program.body.splice(at, 0, ...stmts(`const ${varName} = ${body}`, subs))
    }
    if (opts) opts.properties.unshift(b.objectProperty.from({ key: b.identifier('features'), value: b.identifier(varName), shorthand: varName === 'features' }))
    moduleVars.add(t.fnsInComponent ? '' : varName)
  }
  return moduleVars.size === 1 && !moduleVars.has('') ? [...moduleVars][0] : null
}

/** v7 type → v9 type and its type arguments (`F` is the features type, `a` the v7 arguments). */
const V9_TYPES: Record<string, { to: string; args: (F: string, a: string[]) => string[] }> = {
  // TValue `any`, as TanStack suggests for column arrays: typed Cell renderers stay assignable
  Column: { to: 'ColumnDef', args: (F, [d = 'any', v = 'any']) => [F, d, v] },
  ColumnInstance: { to: 'Column', args: (F, [d = 'any', v]) => (v ? [F, d, v] : [F, d]) },
  TableInstance: { to: 'Table', args: (F, [d = 'any']) => [F, d] },
  TableOptions: { to: 'TableOptions', args: (F, [d = 'any']) => [F, d] },
  TableState: { to: 'TableState', args: (F) => [F] },
  Row: { to: 'Row', args: (F, [d = 'any']) => [F, d] },
  Cell: { to: 'Cell', args: (F, [d = 'any', v]) => (v ? [F, d, v] : [F, d]) },
  HeaderGroup: { to: 'HeaderGroup', args: (F, [d = 'any']) => [F, d] },
  CellProps: { to: 'CellContext', args: (F, [d = 'any', v]) => (v ? [F, d, v] : [F, d]) },
  HeaderProps: { to: 'HeaderContext', args: (F, [d = 'any']) => [F, d] },
  FilterProps: { to: 'HeaderContext', args: (F, [d = 'any']) => [F, d] },
  SortingRule: { to: 'ColumnSort', args: () => [] },
  Filters: { to: 'ColumnFiltersState', args: () => [] },
  IdType: { to: 'string', args: () => [] },
}

/** Rewrites imports and v7 type references; returns true when a type took the features type `F`. */
function fixImports(program: Node, rtImports: Node[], imported: Map<string, string>, typeOnly: Set<string>, ctx: Ctx, ts: boolean, F: string, names: Set<string>): boolean {
  let usedF = false
  const specOf = (local: string) => rtImports.flatMap((d) => d.specifiers).find((sp: Node) => sp.local.name === local) ?? rtImports[0]
  const v9Values = new Set(ctx.v9Imports)
  const typeLocals = new Map<string, string>() // local → v7 type name
  for (const [local, name] of imported) {
    if (name === 'useTable' || PLUGINS[name] || UNSUPPORTED_PLUGINS[name]) continue
    if (name === 'useAsyncDebounce') ctx.compatImports.add(local === name ? name : `${name} as ${local}`)
    else if (name === 'flexRender' || name === 'makeRenderer') v9Values.add(local === 'flexRender' ? 'flexRender' : `flexRender as ${local}`)
    else if (V9_TYPES[name] && (ts || typeOnly.has(local))) typeLocals.set(local, name)
    else if (typeOnly.has(local) || ts) ctx.note('todo', `type \`${name}\` has no v9 equivalent; v9 types come from the features you register (e.g. Row<typeof features, TData>)`, specOf(local))
    else ctx.note('todo', `\`${name}\` from react-table has no v9 equivalent`, specOf(local))
  }

  // Type references: `Column<User>` → `ColumnDef<typeof features, User>`
  const v9TypeImports = new Map<string, string>() // v9 name → local name used
  const localFor = (to: string) => {
    if (!v9TypeImports.has(to)) {
      const clash = names.has(to) && ![...typeLocals.keys()].includes(to)
      v9TypeImports.set(to, clash ? `V9${to}` : to)
    }
    return v9TypeImports.get(to)!
  }
  for (const fn of ctx.columnArrayFns) {
    fn.returnType = expr(`(): ${localFor('ColumnDef')}<${F}, any>[] => []`).returnType
  }
  if (typeLocals.size) {
    walk(program, (p) => {
      const n = p.node
      if (n.type !== 'TSTypeReference' || n.typeName.type !== 'Identifier' || !typeLocals.has(n.typeName.name)) return
      const v7 = typeLocals.get(n.typeName.name)!
      const map = V9_TYPES[v7]
      if (map.to === 'string') return replace(p, b.tsStringKeyword())
      const args = (n.typeParameters?.params ?? []).map((t: Node) => printNode(t))
      const typeArgs = map.args(F, args)
      if (typeArgs.includes(F)) usedF = true
      const next = typeArgs.length ? `${localFor(map.to)}<${typeArgs.join(', ')}>` : localFor(map.to)
      const parsed = expr(`null as unknown as ${next}`)
      replace(p, parsed.typeAnnotation)
      return false
    }, { types: true })
    for (const [local, v7] of typeLocals) {
      if (V9_TYPES[v7].to !== 'string') ctx.note('info', `type ${v7} → ${V9_TYPES[v7].to}<${V9_TYPES[v7].args(F, ['TData']).join(', ')}>`, specOf(local))
    }
  }

  const specs: Node[] = []
  for (const name of [...v9Values].sort()) {
    const [imp, local] = name.split(' as ')
    specs.push(b.importSpecifier(b.identifier(imp), b.identifier(local ?? imp)))
  }
  for (const [to, local] of v9TypeImports) {
    const s: Node = b.importSpecifier(b.identifier(to), b.identifier(local))
    s.importKind = 'type'
    specs.push(s)
  }
  const index = program.body.indexOf(rtImports[0])
  const decls: Node[] = []
  if (specs.length) decls.push(b.importDeclaration(specs, b.stringLiteral(V9)))
  if (ctx.compatImports.size) {
    decls.push(b.importDeclaration([...ctx.compatImports].sort().map((n) => {
      const [imp, local] = n.split(' as ')
      return b.importSpecifier(b.identifier(imp), b.identifier(local ?? imp))
    }), b.stringLiteral(COMPAT)))
  }
  for (const d of rtImports) program.body.splice(program.body.indexOf(d), 1)
  program.body.splice(Math.min(index, program.body.length), 0, ...decls)
  if (usedF && F === 'any') {
    ctx.note('todo', "v9 column types need your table's features type: ColumnDef<typeof features, TData>. This file has no table of its own, so it uses `any`; run the codemod on the table's file in the same run to have it linked, or import the table's features type by hand", rtImports[0])
  }
  return usedF
}
