// Small helpers for the parts of react-table v7 that have no exact TanStack Table v9 equivalent.
// The codemod imports them only when a file needs them; each can be replaced by native v9 code later.
import { useCallback, useRef } from 'react'

/** The parts of a v9 row these helpers read. */
interface V9Row {
  getValue: (columnId: string) => unknown
  [key: string]: any
}

type FilterFn = ((row: V9Row, columnId: string, filterValue: any, addMeta?: (meta: any) => void) => boolean) & {
  autoRemove?: (value: any) => boolean
  resolveFilterValue?: (value: any) => any
}

type SortFn = (rowA: V9Row, rowB: V9Row, columnId: string) => number

/** A v7 row view of a v9 row: everything the v9 row has, plus v7's `values` object. */
export function toV7Row<R extends V9Row>(row: R): R & { values: Record<string, unknown> } {
  const view = Object.create(row)
  Object.defineProperty(view, 'values', {
    get: () =>
      new Proxy({} as Record<string, unknown>, {
        get: (_target, key) => (typeof key === 'string' ? row.getValue(key) : undefined),
      }),
  })
  return view
}

/**
 * Wrap a v7 custom filter type (`(rows, columnIds, filterValue) => rows`) as a v9 filter fn
 * (`(row, columnId, filterValue) => boolean`). The v7 function is called once per row, with that
 * row (as a v7-style row with `values`) in an array of one. `autoRemove` is kept.
 *
 * Filters that look at all rows at once (ranking, "top N") do not work row by row; rewrite those
 * as a native v9 filter fn.
 */
export function fromV7FilterType(
  fn: ((rows: any[], columnIds: string[], filterValue: any) => any[]) & { autoRemove?: (value: any) => boolean },
): FilterFn {
  const wrapped: FilterFn = (row, columnId, filterValue) => fn([toV7Row(row)], [columnId], filterValue).length > 0
  if (fn.autoRemove) wrapped.autoRemove = fn.autoRemove
  return wrapped
}

/** `fromV7FilterType` over every entry of a v7 `filterTypes` object. */
export function fromV7FilterTypes(types: Record<string, Parameters<typeof fromV7FilterType>[0]>): Record<string, FilterFn> {
  return Object.fromEntries(Object.entries(types).map(([k, f]) => [k, fromV7FilterType(f)]))
}

/**
 * Wrap a v7 custom sort type (`(rowA, rowB, columnId, desc) => number`) as a v9 sort fn. v9 does not
 * pass `desc`; it applies the direction itself, as v7 did, so most sort types never read it.
 */
export function fromV7SortType(fn: (rowA: any, rowB: any, columnId: string, desc?: boolean) => number): SortFn {
  return (rowA, rowB, columnId) => fn(toV7Row(rowA), toV7Row(rowB), columnId, undefined)
}

/** `fromV7SortType` over every entry of a v7 `sortTypes` object. */
export function fromV7SortTypes(types: Record<string, Parameters<typeof fromV7SortType>[0]>): Record<string, SortFn> {
  return Object.fromEntries(Object.entries(types).map(([k, f]) => [k, fromV7SortType(f)]))
}

/**
 * v7's `includes` filter: `rowValue.includes(filterValue)` with a single filter value (a substring
 * of a string, or an item of an array). v9's `arrIncludes` expects an array of filter values instead.
 */
export const filterFn_v7Includes: FilterFn = Object.assign(
  (row: V9Row, columnId: string, filterValue: any) => {
    const value = row.getValue(columnId) as any
    return value != null && typeof value.includes === 'function' && value.includes(filterValue)
  },
  { autoRemove: (value: any) => !value || !value.length },
)

/** v7's `number` sort: strips everything but digits and dots, then compares as numbers. */
export const sortFn_v7Number: SortFn = (rowA, rowB, columnId) => {
  const strip = (v: unknown) => Number(String(v).replace(/[^0-9.]/gi, ''))
  const a = strip(rowA.getValue(columnId))
  const b = strip(rowB.getValue(columnId))
  return a === b ? 0 : a > b ? 1 : -1
}

/**
 * v7's `useAsyncDebounce`: returns a debounced function whose calls resolve with the result of the
 * last call once `wait` ms have passed without another call.
 */
export function useAsyncDebounce<F extends (...args: any[]) => any>(
  fn: F,
  wait = 0,
): (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> {
  type R = Awaited<ReturnType<F>>
  const state = useRef<{
    fn?: F
    timeout?: ReturnType<typeof setTimeout>
    promise?: Promise<R>
    resolve?: (value: R) => void
    reject?: (reason: unknown) => void
  }>({})
  state.current.fn = fn

  return useCallback(
    (...args: Parameters<F>): Promise<R> => {
      const s = state.current
      if (!s.promise) {
        s.promise = new Promise<R>((resolve, reject) => {
          s.resolve = resolve
          s.reject = reject
        })
      }
      if (s.timeout) clearTimeout(s.timeout)
      s.timeout = setTimeout(async () => {
        const { resolve, reject } = s
        s.promise = undefined
        s.timeout = undefined
        try {
          resolve?.(await s.fn!(...args))
        } catch (err) {
          reject?.(err)
        }
      }, wait)
      return s.promise
    },
    [wait],
  )
}
