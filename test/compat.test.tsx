// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  filterFn_v7Includes,
  fromV7FilterType,
  fromV7FilterTypes,
  fromV7SortType,
  fromV7SortTypes,
  sortFn_v7Number,
  toV7Row,
  useAsyncDebounce,
} from '../src/compat.js'

const row = (values: Record<string, unknown>, extra: Record<string, unknown> = {}): any => ({
  ...extra,
  getValue: (id: string) => values[id],
})

describe('toV7Row', () => {
  it('adds a v7 `values` object and keeps the v9 row API', () => {
    const r = toV7Row(row({ a: 1, b: 'x' }, { id: '3', original: { a: 1 } }))
    expect(r.values.a).toBe(1)
    expect(r.values['b']).toBe('x')
    expect(r.id).toBe('3')
    expect(r.original).toEqual({ a: 1 })
    expect(r.getValue('a')).toBe(1)
  })
})

describe('fromV7FilterType', () => {
  const startsWith = Object.assign(
    (rows: any[], ids: string[], value: string) => rows.filter((r) => ids.some((id) => String(r.values[id]).startsWith(value))),
    { autoRemove: (v: unknown) => !v },
  )
  it('runs a v7 rows-level filter on one v9 row at a time', () => {
    const fn = fromV7FilterType(startsWith)
    expect(fn(row({ name: 'alpha' }), 'name', 'al')).toBe(true)
    expect(fn(row({ name: 'beta' }), 'name', 'al')).toBe(false)
  })
  it('keeps autoRemove', () => {
    expect(fromV7FilterType(startsWith).autoRemove?.('')).toBe(true)
    expect(fromV7FilterType(startsWith).autoRemove?.('a')).toBe(false)
  })
  it('wraps every entry of a filterTypes object', () => {
    const fns = fromV7FilterTypes({ startsWith })
    expect(fns.startsWith(row({ n: 'abc' }), 'n', 'a')).toBe(true)
  })
})

describe('fromV7SortType', () => {
  const byLength = (a: any, b: any, id: string) => a.values[id].length - b.values[id].length
  it('passes v7-style rows (with values) to a v7 sort type', () => {
    const fn = fromV7SortType(byLength)
    expect(fn(row({ s: 'aaa' }), row({ s: 'a' }), 's')).toBe(2)
    expect(fromV7SortTypes({ byLength }).byLength(row({ s: 'a' }), row({ s: 'aa' }), 's')).toBe(-1)
  })
})

describe("v7's built-ins without an exact v9 match", () => {
  it("filterFn_v7Includes: v7 'includes' (substring or array item, one filter value)", () => {
    expect(filterFn_v7Includes(row({ s: 'relationship' }), 's', 'ship')).toBe(true)
    expect(filterFn_v7Includes(row({ s: ['a', 'b'] }), 's', 'b')).toBe(true)
    expect(filterFn_v7Includes(row({ s: ['a', 'b'] }), 's', 'c')).toBe(false)
    expect(filterFn_v7Includes(row({ s: null }), 's', 'c')).toBe(false)
    expect(filterFn_v7Includes.autoRemove?.('')).toBe(true)
    expect(filterFn_v7Includes.autoRemove?.([])).toBe(true)
  })
  it("sortFn_v7Number: v7 'number' (digits and dots only)", () => {
    expect(sortFn_v7Number(row({ p: '$1,200' }), row({ p: '$300' }), 'p')).toBe(1)
    expect(sortFn_v7Number(row({ p: '10' }), row({ p: '10.0' }), 'p')).toBe(0)
    expect(sortFn_v7Number(row({ p: 2 }), row({ p: 11 }), 'p')).toBe(-1)
  })
})

describe('useAsyncDebounce', () => {
  it('calls once with the last arguments after the wait and resolves every pending call', async () => {
    vi.useFakeTimers()
    const spy = vi.fn((v: string) => v.toUpperCase())
    const { result } = renderHook(() => useAsyncDebounce(spy, 200))
    let p1!: Promise<string>, p2!: Promise<string>
    act(() => {
      p1 = result.current('a')
      p2 = result.current('ab')
    })
    expect(spy).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('ab')
    await expect(p1).resolves.toBe('AB')
    await expect(p2).resolves.toBe('AB')
    vi.useRealTimers()
  })
})
