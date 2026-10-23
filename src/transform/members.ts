import { builders as b, expr, isCall, isMember, keyName, memberName, printNode, replace, type Node, type Path } from './ast.js'
import type { Ctx, Kind } from './context.js'
import { CELL, COLUMN, HEADER, HEADER_GROUP, INSTANCE, RENDER, ROW, STATE_NEEDS, STATE_READ, type MemberEntry } from './maps.js'

export interface Env {
  /** The v9 table variable of the table this binding belongs to (for `state`). */
  table?: string
  pagination?: boolean
}

const PROPS_KINDS = new Set<Kind>(['cellProps', 'headerProps'])

/** Rewrite one use of a v7 object (`objPath.node` is an Identifier or member chain of kind `kind`). */
export function rewriteUse(objPath: Path, kind: Kind, ctx: Ctx, env: Env) {
  const parent = objPath.parent
  if (!isMember(parent) || parent.object !== objPath.node) return bareUse(objPath, kind, ctx, env)
  const prop = memberName(parent)
  if (prop == null) return
  const memberPath = objPath.parentPath!
  const X = printNode(objPath.node)
  const gp = memberPath.parent
  const callPath = isCall(gp) && gp.callee === memberPath.node ? memberPath.parentPath : null

  switch (kind) {
    case 'state':
      return stateRead(memberPath, prop, env.table ?? 'table', ctx)
    case 'instance':
      if (prop === 'state') return rewriteUse(memberPath, 'state', ctx, { ...env, table: X })
      return instanceRead(memberPath, callPath, prop, X, ctx, env)
    case 'cellProps':
    case 'headerProps': {
      if (prop === 'value' && kind === 'cellProps') return replace(memberPath, expr(`${X}.getValue()`))
      if (prop === 'row') return rewriteUse(memberPath, 'row', ctx, env)
      if (prop === 'cell') return rewriteUse(memberPath, 'cell', ctx, env)
      if (prop === 'column') return rewriteUse(memberPath, 'column', ctx, env)
      if (prop === 'state') return rewriteUse(memberPath, 'state', ctx, { ...env, table: `${X}.table` })
      if (INSTANCE[prop]) return instanceRead(memberPath, callPath, prop, `${X}.table`, ctx, env)
      ctx.note('info', `\`${X}.${prop}\` now reads table.options.meta.${prop} (unknown useTable options are moved into meta)`, memberPath.node)
      return replace(memberPath, expr(`${X}.table.options.meta?.${prop}`))
    }
  }

  if (prop === 'render' && callPath) return render(callPath, kind, X, ctx)

  if (kind === 'row' && prop === 'values') return rowValues(memberPath, X)
  if (kind === 'cell' && prop === 'row') return rewriteUse(memberPath, 'row', ctx, env)
  if (kind === 'cell' && prop === 'column') return rewriteUse(memberPath, 'column', ctx, env)

  let entry: MemberEntry | undefined
  let target = X
  if (kind === 'header') {
    entry = HEADER[prop]
    if (!entry && COLUMN[prop]) {
      entry = COLUMN[prop]
      target = `${X}.column`
    }
    if (!entry && !V9_HEADER_KEEP.has(prop)) return metaRead(memberPath, `${X}.column`, prop, ctx)
  } else if (kind === 'column') {
    entry = COLUMN[prop]
    if (!entry && !V9_COLUMN_KEEP.has(prop)) return metaRead(memberPath, X, prop, ctx)
  } else if (kind === 'row') entry = ROW[prop]
  else if (kind === 'cell') entry = CELL[prop]
  else if (kind === 'headerGroup') entry = HEADER_GROUP[prop]

  if (!entry) return
  ctx.need(entry.needs)
  if (entry.todo) ctx.note('todo', `\`${X}.${prop}\`: ${entry.todo}`, memberPath.node, memberPath)

  if (entry.key && callPath) return elementProps(callPath, entry.key(target), entry.attrs?.(target) ?? {}, ctx)
  if (entry.props && callPath) return propGetter(callPath, entry.props(target), ctx)
  if (entry.call && callPath) {
    const args = callPath.node.arguments
    const subs: Record<string, Node> = {}
    const names = args.map((a: Node, i: number) => ((subs[`a${i}`] = a), `$a${i}`))
    return replace(callPath, expr(entry.call(target, names), subs))
  }
  if (entry.read) return replace(memberPath, expr(entry.read(target)))
}

// v9 Header/Column members that v7 code may already read with the same meaning
const V9_HEADER_KEEP = new Set(['id', 'colSpan', 'rowSpan', 'depth', 'index', 'column', 'subHeaders', 'getContext', 'getSize', 'getStart', 'isPlaceholder', 'headerGroup'])
const V9_COLUMN_KEEP = new Set(['id', 'depth', 'parent', 'columns', 'columnDef', 'accessorFn', 'getSize', 'getIndex', 'getContext'])

/** `column.align` (a custom column-definition key in v7) → `column.columnDef.meta?.align`. */
function metaRead(memberPath: Path, column: string, prop: string, ctx: Ctx) {
  if (!ctx.metaKeys.has(prop)) ctx.note('info', `\`${prop}\` is not a v7 column API, so it is read as a custom column key: ${column}.columnDef.meta?.${prop} (the codemod moves custom column keys into meta)`, memberPath.node)
  replace(memberPath, expr(`${column}.columnDef.meta?.${prop}`))
}

function stateRead(memberPath: Path, prop: string, T: string, ctx: Ctx) {
  ctx.need(STATE_NEEDS[prop])
  const read = STATE_READ[prop]
  replace(memberPath, expr(read ? read(T) : `${T}.state.${prop}`))
}

function instanceRead(memberPath: Path, callPath: Path | null, prop: string, T: string, ctx: Ctx, env: Env) {
  const entry = INSTANCE[prop]
  if (!entry) {
    ctx.note('todo', `\`${printNode(memberPath.node)}\` is not a v9 table API; check it by hand`, memberPath.node, memberPath)
    return
  }
  ctx.need(entry.needs)
  if (entry.props && callPath) return propGetter(callPath, entry.props(T), ctx)
  if (entry.drop && callPath) {
    // `instance.prepareRow(row)` → removed; `{...instance.getTableProps()}` → removed
    return dropCall(callPath, ctx)
  }
  const read = env.pagination && entry.paginationAware ? entry.paginationAware(T) : entry.read(T)
  replace(memberPath, expr(read))
}

/** A bare reference that is not a member read. */
function bareUse(objPath: Path, kind: Kind, ctx: Ctx, env: Env) {
  const parent = objPath.parent
  if (kind === 'state') {
    ctx.note('info', 'v7 `state` is now the v9 table.state (sorting, columnFilters, pagination, rowSelection, ... instead of sortBy, filters, pageIndex, selectedRowIds)', objPath.node)
    replace(objPath, expr(`${env.table ?? 'table'}.state`))
    return
  }
  // Iterating or passing to prepareRow is fine; anything else gets a note.
  if (isMember(parent) || (isCall(parent) && parent.callee === objPath.node)) return
  if (PROPS_KINDS.has(kind)) {
    ctx.note('todo', `\`${objPath.node.name}\` is the whole v9 ${kind === 'cellProps' ? 'cell' : 'header'} context now ({ table, column, row, cell, getValue }), not v7 render props`, objPath.node, objPath)
    return
  }
  if (kind === 'instance') {
    ctx.note('todo', `\`${objPath.node.name}\` is a v9 table now; code that receives it must use the v9 API`, objPath.node, objPath)
    return
  }
  const isArgument = isCall(parent) || parent?.type === 'JSXExpressionContainer' || parent?.type === 'ObjectProperty'
  if (isArgument && ['row', 'cell', 'header', 'column'].includes(kind)) {
    ctx.note('info', `\`${objPath.node.name}\` is passed on as a v9 ${kind}; code that receives it must use the v9 API`, objPath.node)
  }
}

function rowValues(memberPath: Path, X: string) {
  const gp = memberPath.parent
  if (isMember(gp) && gp.object === memberPath.node) {
    const key = gp.computed ? gp.property : b.stringLiteral(gp.property.name)
    return replace(memberPath.parentPath!, expr(`${X}.getValue($k)`, { k: key }))
  }
  replace(memberPath, expr(`Object.fromEntries(${X}.getAllCells().map((c) => [c.column.id, c.getValue()]))`))
}

function render(callPath: Path, kind: Kind, X: string, ctx: Ctx) {
  const arg = callPath.node.arguments[0]
  const which = arg?.type === 'StringLiteral' ? arg.value : null
  const table = kind === 'header' ? RENDER.header : kind === 'cell' ? RENDER.cell : null
  const fn = which && table?.[which]
  if (fn) {
    if (which === 'Filter') ctx.note('info', 'column Filter components now receive the v9 header context ({ column, header, table }); they were moved to columnDef.meta.Filter', callPath.node)
    ctx.v9Imports.add('flexRender')
    return replace(callPath, expr(fn(X)))
  }
  ctx.note('todo', `\`${printNode(callPath.node)}\`: v9 has no render(); use flexRender(columnDef.<renderer>, header/cell.getContext())`, callPath.node, callPath)
}

function dropCall(callPath: Path, ctx: Ctx) {
  const parent = callPath.parent
  if (parent?.type === 'ExpressionStatement') {
    removeStatement(callPath.parentPath!)
    return
  }
  if (parent?.type === 'JSXSpreadAttribute') {
    const arg = callPath.node.arguments[0]
    const attrsPath = callPath.parentPath!
    if (arg?.type === 'ObjectExpression') return spliceAttrs(attrsPath, objectToAttrs(arg, ctx))
    if (arg) return spliceAttrs(attrsPath, [b.jsxSpreadAttribute(arg)])
    return spliceAttrs(attrsPath, [])
  }
  replace(callPath, callPath.node.arguments[0] ?? b.objectExpression([]))
}

export function removeStatement(stmtPath: Path) {
  if (stmtPath.list) {
    const i = stmtPath.list.indexOf(stmtPath.node)
    if (i !== -1) stmtPath.list.splice(i, 1)
  } else replace(stmtPath, b.emptyStatement())
}

/** `row.getRowProps(arg)` and friends: `key` (+ colSpan) as JSX attributes, or an object. */
function elementProps(callPath: Path, key: string, attrs: Record<string, string>, ctx: Ctx) {
  const obj = b.objectExpression([
    b.objectProperty(b.identifier('key'), expr(key)),
    ...Object.entries(attrs).map(([k, v]) => b.objectProperty(b.identifier(k), expr(v))),
  ])
  mergeArgs(obj, callPath.node.arguments, ctx, callPath)
  placeProps(callPath, obj, ctx)
}

/** `column.getSortByToggleProps(arg)` and friends: v7's default props merged with the argument. */
function propGetter(callPath: Path, body: string, ctx: Ctx) {
  const obj = expr(`({ ${body} })`)
  mergeArgs(obj, callPath.node.arguments, ctx, callPath)
  placeProps(callPath, obj, ctx)
}

function placeProps(callPath: Path, obj: Node, ctx: Ctx) {
  if (callPath.parent?.type === 'JSXSpreadAttribute') return spliceAttrs(callPath.parentPath!, objectToAttrs(obj, ctx))
  replace(callPath, obj)
}

/** Merge prop-getter arguments the way v7's mergeProps did: later wins, `style` objects merge. */
function mergeArgs(obj: Node, args: Node[], ctx: Ctx, at: Path) {
  const list = args.length === 1 && args[0].type === 'ArrayExpression' ? args[0].elements : args
  for (const arg of list) {
    if (!arg) continue
    if (arg.type === 'ObjectExpression') {
      for (const p of arg.properties) {
        const k = keyName(p)
        if (k == null) {
          obj.properties.push(p)
          continue
        }
        const existing = obj.properties.findIndex((q: Node) => keyName(q) === k)
        if (k === 'style' && existing !== -1 && p.type === 'ObjectProperty') {
          const base = obj.properties[existing].value
          const merged = base.type === 'ObjectExpression' && p.value.type === 'ObjectExpression'
            ? b.objectExpression([
              ...base.properties.filter((q: Node) => !p.value.properties.some((r: Node) => keyName(r) != null && keyName(r) === keyName(q))),
              ...p.value.properties,
            ])
            : expr('({ ...$a, ...$b })', { a: base, b: p.value })
          obj.properties[existing].value = merged
          continue
        }
        if (existing !== -1) obj.properties.splice(existing, 1)
        obj.properties.push(p)
      }
    } else if (isFunctionNode(arg) || (arg.type === 'Identifier' && ctx.functionNames.has(arg.name))) {
      ctx.note('todo', 'a prop-getter function argument ((props, meta) => ...) is not migrated; merge those props by hand', arg, at)
    } else {
      obj.properties.push(b.spreadElement(arg))
    }
  }
}

const isFunctionNode = (n: Node) => n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression'

function objectToAttrs(obj: Node, ctx: Ctx): Node[] {
  const attrs: Node[] = []
  for (const p of obj.properties) {
    const k = keyName(p)
    if (p.type === 'SpreadElement' || k == null || !/^[A-Za-z_][\w-]*$/.test(k) || p.type !== 'ObjectProperty') {
      attrs.push(b.jsxSpreadAttribute(p.type === 'SpreadElement' ? p.argument : b.objectExpression([p])))
      continue
    }
    const v = p.value
    const value = v.type === 'StringLiteral' ? b.stringLiteral(v.value) : b.jsxExpressionContainer(v)
    attrs.push(b.jsxAttribute(b.jsxIdentifier(k), value))
  }
  void ctx
  return attrs
}

/**
 * Replace a JSX spread with attributes. An explicit attribute after the spread still wins (as in v7),
 * one before it loses, so duplicates are dropped accordingly (TypeScript rejects duplicate attributes).
 */
function spliceAttrs(spreadPath: Path, attrs: Node[]) {
  const list = spreadPath.list!
  const i = list.indexOf(spreadPath.node)
  const nameOf = (a: Node) => (a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' ? a.name.name : null)
  const kept = attrs.filter((a) => {
    const n = nameOf(a)
    return !n || !list.slice(i + 1).some((x) => nameOf(x) === n)
  })
  for (const a of kept) {
    const n = nameOf(a)
    if (!n) continue
    for (let j = i - 1; j >= 0; j--) {
      if (nameOf(list[j]) !== n) continue
      // v7 merged className and style only when the getter set them; otherwise the earlier attribute stayed
      const before = list[j].value
      const beforeExpr = before?.type === 'JSXExpressionContainer' ? before.expression : before
      const now = a.value?.type === 'JSXExpressionContainer' ? a.value.expression : a.value
      if (beforeExpr && now && (n === 'className' || n === 'style')) {
        a.value = b.jsxExpressionContainer(n === 'className' ? expr('$a || $b', { a: now, b: beforeExpr }) : expr('({ ...$b, ...$a })', { a: now, b: beforeExpr }))
      }
      list.splice(j, 1)
    }
  }
  list.splice(list.indexOf(spreadPath.node), 1, ...kept)
}
