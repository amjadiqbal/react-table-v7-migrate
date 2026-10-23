import { addComment, type Node, type Path } from './ast.js'
import type { Need } from './maps.js'

export interface Note {
  line: number
  level: 'todo' | 'info'
  message: string
}

export type Kind =
  | 'headerGroups' // collection of header groups
  | 'rows' // collection of rows
  | 'columns' // collection of columns
  | 'headers' // collection of headers
  | 'headerGroup'
  | 'header'
  | 'column'
  | 'row'
  | 'cell'
  | 'state' // the v7 `state` object
  | 'instance' // a whole v7 instance kept under its own name (now the v9 table)
  | 'cellProps' // a renderer's whole props object (Cell)
  | 'headerProps' // a renderer's whole props object (Header, Footer, Filter)

export interface Binding {
  scope: Node
  name: string
  kind: Kind
  /** For `instance`: the table variable it is now. */
  table?: string
}

export const TODO_TAG = 'TODO(react-table-v7-migrate):'

/** Shared state for one file's transform. */
export class Ctx {
  notes: Note[] = []
  /** Needs that apply to every table in the file (registrations, harmless features). */
  shared: Need[] = []
  bindings: Binding[] = []
  /** Column-definition keys moved into `meta`, so `column.<key>` reads become meta reads. */
  metaKeys = new Set<string>()
  v9Imports = new Set<string>()
  compatImports = new Set<string>()
  userFilterTypes = new Set<string>()
  userSortTypes = new Set<string>()
  commented = new WeakSet<Node>()
  source = ''
  /** TS: `hooks.visibleColumns` functions to type as ColumnDef<features, any>[] at the end. */
  columnArrayFns: Node[] = []

  constructor(public readonly ts: boolean) {}

  need(n: Need | Need[] | undefined) {
    if (!n) return
    for (const x of Array.isArray(n) ? n : [n]) this.shared.push(x)
  }

  bind(scope: Node, name: string, kind: Kind, table?: string) {
    if (this.bindings.some((x) => x.scope === scope && x.name === name)) return
    this.bindings.push({ scope, name, kind, table })
  }

  note(level: 'todo' | 'info', message: string, at: Node | null, statementPath?: Path | null) {
    const line = at?.loc?.start?.line ?? 0
    if (this.notes.some((n) => n.line === line && n.message === message)) return
    this.notes.push({ line, level, message })
    if (level === 'todo' && statementPath) {
      const stmt = nearestStatement(statementPath)
      if (stmt) addComment(stmt, `${TODO_TAG} ${message}`)
    }
  }
}

/** Walk up to the closest statement (or class member / program body item) to hang a comment on. */
export function nearestStatement(path: Path | null): Node | null {
  let p = path
  while (p) {
    const t = p.node?.type ?? ''
    if (/Statement$|Declaration$/.test(t) && t !== 'BlockStatement' && !/^TS/.test(t)) return p.node
    if (t === 'ClassProperty' || t === 'ObjectProperty') {
      // keep climbing: a comment on an object property inside JSX is easy to miss
    }
    p = p.parentPath
  }
  return null
}
