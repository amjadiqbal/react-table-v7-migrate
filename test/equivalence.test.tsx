// @vitest-environment jsdom
// Renders each v7 example with react-table 7.8.0 (input.jsx) and its codemod output with
// @tanstack/react-table 9 (output.jsx), both on React 19, runs the same interactions on both,
// and compares what the user sees: every table cell's text and every <pre> state dump.
// react-table 7.8.0's build calls a global regeneratorRuntime (its useAsyncDebounce is an async function
// compiled by Babel); apps got it from their own Babel setup. Provide it for the v7 side only.
import 'regenerator-runtime/runtime'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

interface Script {
  steps: Step[]
  /** Compare only these body columns (sort-key columns), for documented tie-order differences. */
  keyColumns?: number[]
  /** Why the <pre> state dumps are not compared (the v9 state shape differs by design). */
  ignorePre?: string
  /** Why <select> options are compared as sets. */
  optionsAsSets?: string
}

function snapshot(root: HTMLElement, script: Script = { steps: [] }) {
  const cellText = (c: Element) => {
    if (!script.optionsAsSets) return text(c)
    const clone = c.cloneNode(true) as Element
    clone.querySelectorAll('select').forEach((sel) => {
      sel.textContent = [...sel.querySelectorAll('option')].map((o) => text(o)).sort().join(',')
    })
    return text(clone)
  }
  const tables = [...root.querySelectorAll('table')].map((t) =>
    // a <tr> without cells shows nothing (v9 returns one empty header group when every column is hidden)
    [...t.querySelectorAll('tr')].filter((tr) => tr.querySelector('th,td')).map((tr) => {
      const cells = [...tr.querySelectorAll('th,td')]
      if (script.keyColumns && tr.querySelector('td')) return script.keyColumns.map((i) => cellText(cells[i])).join(' | ')
      return cells.map((c) => cellText(c)).join(' | ')
    }),
  )
  const inputs = [...root.querySelectorAll('input')].map((i) => (i.type === 'checkbox' ? `${i.checked ? 'x' : 'o'}${i.indeterminate ? '-' : ''}` : i.value))
  const rest = [...root.querySelectorAll(script.ignorePre ? 'div > span, div > button, p' : 'pre, div > span, div > button, p')]
    .filter((e) => !(script.ignorePre && e.closest('pre')))
    .map((e) => text(e))
  return { tables, inputs, rest }
}

type Step = { label: string; run: (root: HTMLElement) => void | Promise<void> }

const th = (root: HTMLElement, label: string) => {
  const cell = [...root.querySelectorAll('th')].find((c) => text(c).startsWith(label))
  if (!cell) throw new Error(`no header "${label}"`)
  return cell
}
const button = (root: HTMLElement, label: string) => {
  const b = [...root.querySelectorAll('button')].find((x) => text(x) === label)
  if (!b) throw new Error(`no button "${label}"`)
  return b
}
const checkboxes = (root: HTMLElement) => [...root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

const click = (label: string, find: (r: HTMLElement) => Element): Step => ({ label, run: (r) => void fireEvent.click(find(r)) })
const clickHeader = (h: string, opts: { shiftKey?: boolean } = {}): Step => ({ label: `click header ${h}${opts.shiftKey ? ' (shift)' : ''}`, run: (r) => void fireEvent.click(th(r, h), opts) })
const clickButton = (b: string): Step => click(`click ${b}`, (r) => button(r, b))
const clickCheckbox = (i: number): Step => click(`checkbox ${i}`, (r) => checkboxes(r)[i])
const typeIn = (placeholder: RegExp, value: string, settle = 0): Step => ({
  label: `type "${value}" into ${placeholder}`,
  run: async (r) => {
    const input = [...r.querySelectorAll('input')].find((i) => placeholder.test(i.placeholder))
    if (!input) throw new Error(`no input ${placeholder}`)
    fireEvent.change(input, { target: { value } })
    if (settle) await wait(settle)
  },
})
const selectNth = (n: number, value: string): Step => ({
  label: `select ${value} in select ${n}`,
  run: (r) => void fireEvent.change(r.querySelectorAll('select')[n], { target: { value } }),
})
const clickSpan = (label: string, index = 0): Step => click(`click span ${label} #${index}`, (r) => [...r.querySelectorAll('span')].filter((s) => text(s) === label)[index])

const SCRIPTS: Record<string, Step[] | Script> = {
  basic: [],
  sorting: {
    // v7 broke ties in a descending sort by reversed row index, v9 by row index (README: "Sorting").
    // The sort-key columns must still match row for row.
    keyColumns: [2],
    steps: [clickHeader('Age'), clickHeader('Age'), clickHeader('Age')],
  },
  'sorting (multi)': {
    keyColumns: [0, 3],
    steps: [clickHeader('First Name'), clickHeader('Visits', { shiftKey: true }), clickHeader('First Name', { shiftKey: true })],
  },
  'sorting (status)': { keyColumns: [4], steps: [clickHeader('Status'), clickHeader('Status')] },
  filtering: {
    // column.preFilteredRows → column.getFacetedRowModel().rows: same rows, but v7's order depended on
    // the order filters were added (README: "Filtering"), so a select's options are compared as sets.
    optionsAsSets: 'faceted rows order',
    steps: [
    typeIn(/^Search \d+ records/, 'a'),
    typeIn(/records\.\.\.$/, 'li', 250),
    selectNth(0, 'single'),
    typeIn(/^Min/, '20'),
    typeIn(/^Max/, '80'),
    typeIn(/^Search \d+ records/, ''),
    ],
  },
  pagination: [clickButton('>'), clickButton('>'), clickButton('>>'), clickButton('<'), selectNth(0, '20'), clickButton('<<')],
  'pagination-controlled': [{ label: 'load', run: () => wait(1200) }, clickButton('>'), { label: 'load', run: () => wait(1200) }, selectNth(0, '20'), { label: 'load', run: () => wait(1200) }],
  'row-selection': [clickCheckbox(1), clickCheckbox(3), clickCheckbox(0), clickCheckbox(0)],
  'row-selection-and-pagination': [clickCheckbox(1), clickButton('>'), clickCheckbox(2), clickCheckbox(0), clickButton('<')],
  expanding: {
    // v9's toggleAllRowsExpanded() stores `expanded: true`; v7 stored every row id
    ignorePre: 'expanded state shape',
    steps: [clickSpan('👉', 1), clickSpan('👉', 2), clickSpan('👉', 0), clickSpan('👇', 0)],
  },
  footers: [],
  'column-hiding': {
    // the example dumps the whole state: v9 has columnVisibility where v7 had hiddenColumns
    ignorePre: 'whole-state dump',
    steps: [clickCheckbox(1), clickCheckbox(3), clickCheckbox(0), clickCheckbox(0)],
  },
  'editable-data': [
    {
      label: 'edit a cell',
      run: (r) => {
        const input = r.querySelectorAll<HTMLInputElement>('tbody input')[2]
        fireEvent.change(input, { target: { value: 'Zulu' } })
        fireEvent.blur(input)
      },
    },
    clickButton('>'),
    clickButton('<'),
  ],
  'sub-components': [clickSpan('👉', 0), clickSpan('👉', 2)],
}

const examples = import.meta.glob('./fixtures/v7-examples/*/{input,output}.jsx')

describe('v7 example vs migrated v9 output (React 19)', () => {
  for (const [title, entry] of Object.entries(SCRIPTS)) {
    if (title.startsWith('_')) continue
    const name = title.replace(/ \(.*\)$/, '')
    const script: Script = Array.isArray(entry) ? { steps: entry } : entry
    const { steps } = script
    it(title, async () => {
      const load = async (file: string) => ((await examples[`./fixtures/v7-examples/${name}/${file}.jsx`]()) as { default: ComponentType }).default
      const [V7, V9] = await Promise.all([load('input'), load('output')])
      const a = render(createElement(V7))
      const v7 = a.container
      const b = render(createElement(V9))
      const v9 = b.container
      await wait(0)
      expect(snapshot(v9, script), 'initial render').toEqual(snapshot(v7, script))
      for (const step of steps) {
        await act(async () => {
          await step.run(v7)
        })
        await act(async () => {
          await step.run(v9)
        })
        expect(snapshot(v9, script), step.label).toEqual(snapshot(v7, script))
      }
    })
  }
})
