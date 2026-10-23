import { parse as babelParse, parseExpression, type ParserPlugin } from '@babel/parser'
import * as recast from 'recast'

export type Node = any

const b = recast.types.builders

function plugins(filename: string): ParserPlugin[] {
  const ts = /\.(c|m)?tsx?$/.test(filename)
  const jsx = !/\.(c|m)?ts$/.test(filename)
  const list: ParserPlugin[] = ['decorators-legacy', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'importAttributes' as ParserPlugin]
  if (ts) list.push('typescript')
  if (jsx) list.push('jsx')
  return list
}

export function parseFile(source: string, filename: string): Node {
  return recast.parse(source, {
    parser: {
      parse: (code: string) =>
        babelParse(code, {
          sourceType: 'module',
          allowReturnOutsideFunction: true,
          allowImportExportEverywhere: true,
          errorRecovery: false,
          tokens: true,
          plugins: plugins(filename),
        }),
    },
  })
}

export function printFile(ast: Node, quote: 'single' | 'double' = 'single'): string {
  return recast.print(ast, { quote, reuseWhitespace: true }).code
}

/** The quote style most string literals in the source use, for generated code to match. */
export function quoteStyle(source: string): 'single' | 'double' {
  const single = (source.match(/(?:from|import|require\(|=|:|\(|,)\s*'[^'\n]*'/g) ?? []).length
  const double = (source.match(/(?:from|import|require\(|=|:|\(|,)\s*"[^"\n]*"/g) ?? []).length
  return double > single ? 'double' : 'single'
}

export function printNode(node: Node): string {
  return recast.print(node, { quote: 'single' }).code
}

/** Strip positions so recast prints generated nodes fresh instead of reusing source text. */
export function clean(node: Node): Node {
  if (Array.isArray(node)) {
    node.forEach(clean)
    return node
  }
  if (!node || typeof node !== 'object') return node
  delete node.loc
  delete node.start
  delete node.end
  delete node.range
  delete node.tokens
  delete node.leadingComments
  delete node.trailingComments
  delete node.innerComments
  delete node.comments
  if (node.extra) {
    const { parenthesized, ...rest } = node.extra
    void parenthesized
    node.extra = Object.keys(rest).length ? rest : undefined
    if (node.extra === undefined) delete node.extra
  }
  for (const key of Object.keys(node)) {
    if (key === 'type') continue
    const value = node[key]
    if (value && typeof value === 'object') clean(value)
  }
  return node
}

let tsMode = false
export function setTsMode(on: boolean) {
  tsMode = on
}

const exprPlugins = (): ParserPlugin[] => (tsMode ? ['jsx', 'typescript'] : ['jsx'])

/**
 * Parse an expression template. Placeholders written as `$name` are replaced by the given nodes
 * (the original nodes, so earlier rewrites inside them survive).
 */
export function expr(code: string, subs: Record<string, Node> = {}): Node {
  const node = clean(parseExpression(code.replace(/\$([A-Za-z0-9_]+)/g, '__SUB_$1__'), { plugins: exprPlugins() }))
  if (tsMode) annotateParams(node)
  return substitute(node, subs)
}

/**
 * In TypeScript files, generated arrow functions that are not call arguments (where TypeScript
 * infers parameter types) get `any` parameters so `noImplicitAny` code still compiles.
 */
function annotateParams(root: Node) {
  walk(root, (p) => {
    const n = p.node
    if (n.type !== 'ArrowFunctionExpression') return
    if (isCall(p.parent) && p.key !== 'callee') return
    for (const param of n.params) {
      if (param.type === 'Identifier' && !param.typeAnnotation && !/^__SUB_/.test(param.name)) {
        param.typeAnnotation = b.tsTypeAnnotation(b.tsAnyKeyword())
        param.optional = true
      }
    }
  })
}

export function stmts(code: string, subs: Record<string, Node> = {}): Node[] {
  const file = babelParse(code.replace(/\$([A-Za-z0-9_]+)/g, '__SUB_$1__'), {
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    plugins: exprPlugins(),
  })
  return file.program.body.map((s: Node) => substitute(clean(s), subs))
}

function substitute(node: Node, subs: Record<string, Node>): Node {
  if (!Object.keys(subs).length) return node
  const visit = (n: Node, parent: Node, key: string | number, list?: Node[]): void => {
    if (!n || typeof n !== 'object') return
    if (n.type === 'Identifier' && /^__SUB_[A-Za-z0-9_]+__$/.test(n.name)) {
      const name = n.name.slice(6, -2)
      if (!(name in subs)) throw new Error(`missing template value $${name}`)
      if (list) list[key as number] = subs[name]
      else parent[key] = subs[name]
      return
    }
    for (const k of Object.keys(n)) {
      if (k === 'type') continue
      const v = n[k]
      if (Array.isArray(v)) v.forEach((c, i) => visit(c, n, i, v))
      else if (v && typeof v === 'object') visit(v, n, k)
    }
  }
  const holder = { root: node }
  visit(node, holder, 'root')
  return holder.root
}

export const builders = b

/** A visit callback gets the node and a handle to replace it. */
export interface Path {
  node: Node
  parent: Node | null
  key: string | number
  list: Node[] | null
  parentPath: Path | null
}

export function replace(path: Path, next: Node) {
  if (path.list) {
    // Siblings may have been spliced since the path was recorded, so look the node up again.
    const i = path.list.indexOf(path.node)
    path.list[i === -1 ? (path.key as number) : i] = next
  } else if (path.parent) path.parent[path.key] = next
  path.node = next
}

/** The scope node (function, block, program) that declares `name`, seen from `path`. */
export function declScope(path: Path, name: string): Node | null {
  let p: Path | null = path
  while (p) {
    if (shadows(p.node, name)) return p.node
    p = p.parentPath
  }
  return null
}

const SKIP_KEYS = new Set(['type', 'loc', 'start', 'end', 'range', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'extra', 'original'])
const TYPE_KEYS = new Set(['typeAnnotation', 'returnType', 'typeParameters', 'typeArguments', 'superTypeParameters', 'implements'])

/** Depth-first walk over the AST. Returning false from `enter` skips the node's children. */
export function walk(root: Node, enter: (path: Path) => boolean | void, options: { types?: boolean } = {}) {
  const go = (path: Path) => {
    const node = path.node
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return
    if (enter(path) === false) return
    const current = path.node
    if (!current || typeof current !== 'object') return
    for (const key of Object.keys(current)) {
      if (SKIP_KEYS.has(key)) continue
      if (!options.types && TYPE_KEYS.has(key)) continue
      if (!options.types && /^TS/.test(current.type) && current.type !== 'TSAsExpression' && current.type !== 'TSNonNullExpression' && current.type !== 'TSSatisfiesExpression') return
      const value = current[key]
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) go({ node: value[i], parent: current, key: i, list: value, parentPath: path })
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        go({ node: value, parent: current, key, list: null, parentPath: path })
      }
    }
  }
  go({ node: root, parent: null, key: 'root', list: null, parentPath: null })
}

export const isFunction = (n: Node) =>
  !!n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod'].includes(n.type)

/** Names a binding pattern declares. */
export function patternNames(p: Node, out: string[] = []): string[] {
  if (!p) return out
  switch (p.type) {
    case 'Identifier':
      out.push(p.name)
      break
    case 'ObjectPattern':
      for (const prop of p.properties) patternNames(prop.type === 'RestElement' ? prop.argument : prop.value, out)
      break
    case 'ArrayPattern':
      for (const el of p.elements) patternNames(el, out)
      break
    case 'AssignmentPattern':
      patternNames(p.left, out)
      break
    case 'RestElement':
      patternNames(p.argument, out)
      break
    case 'TSParameterProperty':
      patternNames(p.parameter, out)
      break
  }
  return out
}

/** Names declared directly in a block/function body (not nested functions). */
function declaredIn(body: Node[], name: string, includeVar: boolean): boolean {
  for (const s of body) {
    if (!s) continue
    if (s.type === 'VariableDeclaration' && (includeVar || s.kind !== 'var')) {
      if (s.declarations.some((d: Node) => patternNames(d.id).includes(name))) return true
    }
    if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id?.name === name) return true
    if (s.type === 'ExportNamedDeclaration' && s.declaration) {
      if (declaredIn([s.declaration], name, includeVar)) return true
    }
  }
  return false
}

export function shadows(node: Node, name: string): boolean {
  if (isFunction(node)) {
    if (node.params.some((p: Node) => patternNames(p).includes(name))) return true
    if (node.type === 'FunctionExpression' && node.id?.name === name) return true
    if (node.body?.type === 'BlockStatement' && declaredIn(node.body.body, name, true)) return true
    return false
  }
  if (node.type === 'BlockStatement' || node.type === 'Program') return declaredIn(node.body, name, false)
  if (node.type === 'CatchClause') return patternNames(node.param).includes(name)
  if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
    const init = node.init ?? node.left
    return init?.type === 'VariableDeclaration' && init.kind !== 'var' && init.declarations.some((d: Node) => patternNames(d.id).includes(name))
  }
  return false
}

/** Is this Identifier path a reference (not a property key, label, or declaration)? */
export function isReference(path: Path): boolean {
  const { parent, key } = path
  if (!parent) return false
  switch (parent.type) {
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return key === 'object' || parent.computed
    case 'ObjectProperty':
      return key === 'value' || (key === 'key' && parent.computed)
    case 'ObjectMethod':
    case 'ClassMethod':
    case 'ClassProperty':
      return key !== 'key' || parent.computed
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return false
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
    case 'ExportSpecifier':
      return false
    case 'VariableDeclarator':
      return key === 'init'
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return key === 'body'
    case 'AssignmentPattern':
      return key === 'right'
    case 'ArrayPattern':
    case 'RestElement':
    case 'ObjectPattern':
      return false
    default:
      return true
  }
}

/**
 * References to `name` inside `scopeNode` (a function or block that declares it), skipping
 * nested scopes that declare their own `name`. Pattern positions are not references.
 */
export function findRefs(scopeNode: Node, name: string): Path[] {
  const refs: Path[] = []
  walk(scopeNode, (path) => {
    const node = path.node
    // a function's own body block is part of its scope, not a nested one
    const own = node === scopeNode || (isFunction(scopeNode) && node === scopeNode.body)
    if (!own && shadows(node, name)) return false
    if (node.type === 'Identifier' && node.name === name && isReference(path)) {
      // Inside a declaration pattern (`const { a } = x`), the ObjectProperty value is a binding.
      if (path.parent?.type === 'ObjectProperty' && path.parentPath?.parent?.type === 'ObjectPattern') return
      refs.push(path)
    }
  })
  return refs
}

/** Every identifier name used anywhere in the file (to pick non-clashing names). */
export function usedNames(root: Node): Set<string> {
  const names = new Set<string>()
  walk(root, (path) => {
    // JSX tag names like <table> are not variables; component tags are declared elsewhere anyway
    if (path.node.type === 'Identifier') names.add(path.node.name)
  }, { types: true })
  return names
}

export function addComment(node: Node, text: string) {
  node.comments = node.comments ?? []
  node.comments.push({ type: 'CommentLine', value: ` ${text}`, leading: true, trailing: false })
}

export function keyName(prop: Node): string | null {
  if (!prop || (prop.type !== 'ObjectProperty' && prop.type !== 'ObjectMethod') || prop.computed) {
    if (prop?.computed && prop.key?.type === 'StringLiteral') return prop.key.value
    return null
  }
  if (prop.key.type === 'Identifier') return prop.key.name
  if (prop.key.type === 'StringLiteral') return prop.key.value
  return null
}

export function memberName(member: Node): string | null {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name
  if (member.computed && member.property.type === 'StringLiteral') return member.property.value
  return null
}

export const isMember = (n: Node) => n?.type === 'MemberExpression' || n?.type === 'OptionalMemberExpression'
export const isCall = (n: Node) => n?.type === 'CallExpression' || n?.type === 'OptionalCallExpression'
