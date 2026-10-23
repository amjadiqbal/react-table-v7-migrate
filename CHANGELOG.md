# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-23

### Added

- `react-table-v7-migrate` CLI (`npx @amjadiqbal/react-table-v7-migrate [--dry] [--print] [--json] <paths>`) and
  `transformSource()`: rewrites react-table v7 code to TanStack Table v9.
  - `useTable` with `useSortBy`, `useFilters`, `useGlobalFilter`, `usePagination`, `useRowSelect`, `useExpanded`,
    `useColumnOrder` → `useTable({ features })` with a generated `tableFeatures({...})`.
  - The destructured instance, `state`, `initialState` and table options; the header/row/cell render loops and
    their prop getters; column definitions; renderer props; built-in filter and sort types; TypeScript types.
  - v7 defaults that differ in v9 are written out (ascending-first sort, case-sensitive alphanumeric sort, the
    built-in text filter, `row.subRows`, any row can expand, no Shift range-select).
  - TODO comments and a report for everything it does not migrate (grouping, resizing, layout hooks, row state,
    state reducers, prop-getter functions, and more; see the README).
  - In TypeScript projects, column-only files are linked to the features type of the table file they import.
- `/compat`: `useAsyncDebounce`, `fromV7FilterType(s)`, `fromV7SortType(s)`, `filterFn_v7Includes`,
  `sortFn_v7Number`, `toV7Row`.

### Tested

- react-table 7.8.0 → @tanstack/react-table 9.3.1 on React 19.3.1, Node 26.7.
- 13 react-table v7.8.0 example apps: original vs migrated output rendered side by side in jsdom, same
  interactions, same tables (documented differences only).
- 11 focused cases plus the kitchen-sink example (snapshot, report, idempotent); the TypeScript case compiles
  with `tsc --strict`.
- A real Next.js + TypeScript app (alfianandinugraha/next-tabley) migrated and checked in a browser against
  its untouched v7 page. Dry runs on five more public v7 apps.
