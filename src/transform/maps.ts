// Every v7 → v9 mapping the codemod knows, in one place. `T` is the v9 table expression,
// `X` the object a member is read from. Entries return code strings that are parsed back into AST.

/** A v9 feature, row model slot or fn the generated `tableFeatures({...})` call needs. */
export type Need =
  | { kind: 'feature'; name: string }
  | { kind: 'rowModel'; slot: string; factory: string }
  | { kind: 'filterFn'; key: string; v9: string }
  | { kind: 'sortFn'; key: string; v9: string }
  | { kind: 'compat'; name: string }
  | { kind: 'v9import'; name: string }
  | { kind: 'option'; name: string }

const feature = (name: string): Need => ({ kind: 'feature', name })
const rowModel = (slot: string, factory: string): Need => ({ kind: 'rowModel', slot, factory })

export const FEATURE_ORDER = [
  'columnFilteringFeature',
  'globalFilteringFeature',
  'columnFacetingFeature',
  'rowSortingFeature',
  'rowExpandingFeature',
  'rowPaginationFeature',
  'rowSelectionFeature',
  'columnVisibilityFeature',
  'columnOrderingFeature',
  'columnSizingFeature',
]

export const ROW_MODEL_ORDER = [
  'filteredRowModel',
  'facetedRowModel',
  'sortedRowModel',
  'expandedRowModel',
  'paginatedRowModel',
]

/** Plugin hooks the codemod migrates, and what each one turns on. */
export const PLUGINS: Record<string, Need[]> = {
  useSortBy: [feature('rowSortingFeature'), rowModel('sortedRowModel', 'createSortedRowModel'), { kind: 'option', name: 'sortDescFirst' }],
  useFilters: [feature('columnFilteringFeature'), rowModel('filteredRowModel', 'createFilteredRowModel'), { kind: 'option', name: 'defaultFilterFn' }],
  useGlobalFilter: [feature('globalFilteringFeature'), rowModel('filteredRowModel', 'createFilteredRowModel'), { kind: 'option', name: 'globalFilterFn' }],
  usePagination: [feature('rowPaginationFeature'), rowModel('paginatedRowModel', 'createPaginatedRowModel')],
  useRowSelect: [feature('rowSelectionFeature'), { kind: 'option', name: 'enableRowRangeSelection' }],
  useExpanded: [feature('rowExpandingFeature'), rowModel('expandedRowModel', 'createExpandedRowModel'), { kind: 'option', name: 'getRowCanExpand' }],
  useColumnOrder: [feature('columnOrderingFeature')],
}

/** Plugin hooks the codemod does not migrate. The hook is removed and a TODO explains why. */
export const UNSUPPORTED_PLUGINS: Record<string, string> = {
  useGroupBy: 'useGroupBy (grouping/aggregation) is not migrated: add columnGroupingFeature, rowAggregationFeature and groupedRowModel by hand (see the v9 grouping guide)',
  useResizeColumns: 'useResizeColumns is not migrated: add columnSizingFeature + columnResizingFeature and use header.getResizeHandler() (see the v9 column-resizing guide)',
  useBlockLayout: 'useBlockLayout only set CSS widths; v9 has no layout plugins. Set widths from header.getSize() / cell.column.getSize() yourself',
  useFlexLayout: 'useFlexLayout only set CSS flex widths; v9 has no layout plugins. Set widths from header.getSize() / cell.column.getSize() yourself',
  useAbsoluteLayout: 'useAbsoluteLayout only set CSS positions; v9 has no layout plugins. Use header.getStart() / getSize() yourself',
  useGridLayout: 'useGridLayout only set CSS grid styles; v9 has no layout plugins',
  useRowState: 'useRowState has no v9 equivalent: keep per-row UI state in your own React state keyed by row.id',
  _UNSTABLE_usePivotColumns: 'pivoting has no v9 equivalent',
}

/** Table option keys: v7 → v9. `null` drops the key with a note. */
export const OPTION_RENAMES: Record<string, string> = {
  manualSortBy: 'manualSorting',
  manualFilters: 'manualFiltering',
  manualGlobalFilter: 'manualFiltering',
  autoResetPage: 'autoResetPageIndex',
  selectSubRows: 'enableSubRowSelection',
}

export const OPTION_NEGATIONS: Record<string, string> = {
  disableMultiSort: 'enableMultiSort',
  disableSortRemove: 'enableSortingRemoval',
  disableMultiRemove: 'enableMultiRemove',
  disableSortBy: 'enableSorting',
  disableFilters: 'enableColumnFilters',
  disableGlobalFilter: 'enableGlobalFilter',
}

export const OPTION_KEEP = new Set([
  'columns', 'data', 'defaultColumn', 'getSubRows', 'getRowId', 'manualPagination', 'pageCount',
  'autoResetExpanded', 'maxMultiSortColCount', 'isMultiSortEvent', 'sortDescFirst', 'paginateExpandedRows',
])

/** v7 auto-reset options v9 does not have (v9 never resets these when data changes). */
export const OPTION_DROPPED_AUTORESET = new Set([
  'autoResetSortBy', 'autoResetFilters', 'autoResetGlobalFilter', 'autoResetSelectedRows',
  'autoResetHiddenColumns', 'autoResetResize', 'autoResetGroupBy', 'autoResetRowState',
])

/** Options the codemod cannot map; kept out of the call with a TODO. */
export const OPTION_TODO: Record<string, string> = {
  stateReducer: 'stateReducer has no v9 equivalent: use controlled state (`state` + `on<Slice>Change`) or the `atoms` option',
  useControlledState: 'useControlledState has no v9 equivalent: pass controlled slices with `state` + `on<Slice>Change`',
  orderByFn: 'orderByFn has no v9 equivalent: write a custom sortFn',
  globalFilter: 'a custom global filter: wrap a v7 rows-level function with fromV7FilterType() and pass it as globalFilterFn',
  expandSubRows: 'expandSubRows has no v9 equivalent: v9 always shows an expanded row\'s sub rows',
  manualExpandedKey: 'manualExpandedKey has no v9 equivalent: use getRowCanExpand: (row) => !!row.original.<key>',
  manualRowSelectedKey: 'manualRowSelectedKey has no v9 equivalent: use enableRowSelection: (row) => ...',
  getResetPageDeps: 'getResetPageDeps has no v9 equivalent',
  initialRowStateAccessor: 'useRowState is not migrated',
  initialCellStateAccessor: 'useRowState is not migrated',
}

/** v7 state keys (also initialState keys) → v9 state expressions. */
export const STATE_READ: Record<string, (T: string) => string> = {
  pageIndex: (T) => `${T}.state.pagination.pageIndex`,
  pageSize: (T) => `${T}.state.pagination.pageSize`,
  sortBy: (T) => `${T}.state.sorting`,
  filters: (T) => `${T}.state.columnFilters`,
  globalFilter: (T) => `${T}.state.globalFilter`,
  selectedRowIds: (T) => `${T}.state.rowSelection`,
  expanded: (T) => `${T}.state.expanded`,
  hiddenColumns: (T) => `Object.keys(${T}.state.columnVisibility).filter((id) => ${T}.state.columnVisibility[id] === false)`,
  columnOrder: (T) => `${T}.state.columnOrder`,
}

export const STATE_NEEDS: Record<string, Need[]> = {
  hiddenColumns: [feature('columnVisibilityFeature')],
  columnOrder: [feature('columnOrderingFeature')],
}

/** v7 table-instance properties → v9. A function value means "rewrite calls"; strings are plain reads. */
export interface InstanceEntry {
  /** Expression that replaces a bare read of the name. */
  read: (T: string) => string
  /** Prop getters: the v7 default props, as an object-literal body (without braces). */
  props?: (T: string) => string
  needs?: Need[]
  /** Pagination-aware: `rows` reads the pre-paginated model when usePagination is on. */
  paginationAware?: (T: string) => string
  /** References are dropped (prepareRow calls, getTableProps spreads). */
  drop?: boolean
}

const visibility = [feature('columnVisibilityFeature')]

export const INSTANCE: Record<string, InstanceEntry> = {
  headerGroups: { read: (T) => `${T}.getHeaderGroups()` },
  footerGroups: { read: (T) => `${T}.getFooterGroups()` },
  rows: { read: (T) => `${T}.getRowModel().rows`, paginationAware: (T) => `${T}.getPrePaginatedRowModel().rows` },
  page: { read: (T) => `${T}.getRowModel().rows` },
  flatRows: { read: (T) => `${T}.getCoreRowModel().flatRows` },
  prepareRow: { read: () => `() => {}`, drop: true },
  getTableProps: { read: () => `(props) => ({ ...props })`, drop: true },
  getTableBodyProps: { read: () => `(props) => ({ ...props })`, drop: true },
  allColumns: { read: (T) => `${T}.getAllLeafColumns()` },
  visibleColumns: { read: (T) => `${T}.getVisibleLeafColumns()` },
  flatHeaders: { read: (T) => `${T}.getFlatHeaders()` },
  columns: { read: (T) => `${T}.getAllColumns()` },
  data: { read: (T) => `${T}.options.data` },
  state: { read: (T) => `${T}.state` },
  canPreviousPage: { read: (T) => `${T}.getCanPreviousPage()` },
  canNextPage: { read: (T) => `${T}.getCanNextPage()` },
  pageOptions: { read: (T) => `${T}.getPageOptions()` },
  pageCount: { read: (T) => `${T}.getPageCount()` },
  gotoPage: { read: (T) => `${T}.setPageIndex` },
  nextPage: { read: (T) => `${T}.nextPage` },
  previousPage: { read: (T) => `${T}.previousPage` },
  setPageSize: { read: (T) => `${T}.setPageSize` },
  setGlobalFilter: { read: (T) => `${T}.setGlobalFilter` },
  preGlobalFilteredRows: { read: (T) => `${T}.getPreFilteredRowModel().rows` },
  globalFilteredRows: { read: (T) => `${T}.getFilteredRowModel().rows` },
  setFilter: { read: (T) => `(columnId, value) => ${T}.getColumn(columnId)?.setFilterValue(value)` },
  setAllFilters: { read: (T) => `${T}.setColumnFilters` },
  preFilteredRows: { read: (T) => `${T}.getPreFilteredRowModel().rows` },
  filteredRows: { read: (T) => `${T}.getFilteredRowModel().rows` },
  setSortBy: { read: (T) => `${T}.setSorting` },
  toggleSortBy: { read: (T) => `(columnId, desc, multi) => ${T}.getColumn(columnId)?.toggleSorting(desc, multi)` },
  preSortedRows: { read: (T) => `${T}.getPreSortedRowModel().rows` },
  sortedRows: { read: (T) => `${T}.getSortedRowModel().rows` },
  // v7 collected these from the table's current rows (not collapsed sub rows, not other pages' rows
  // when paginating... except that `rows` is pre-pagination), not from every row
  selectedFlatRows: {
    read: (T) => `${T}.getRowModel().rows.filter((row) => row.getIsSelected())`,
    paginationAware: (T) => `${T}.getPrePaginatedRowModel().rows.filter((row) => row.getIsSelected())`,
  },
  isAllRowsSelected: { read: (T) => `${T}.getIsAllRowsSelected()` },
  isAllPageRowsSelected: { read: (T) => `${T}.getIsAllPageRowsSelected()` },
  toggleRowSelected: { read: (T) => `(rowId, value) => ${T}.getRow(rowId).toggleSelected(value)` },
  toggleAllRowsSelected: { read: (T) => `${T}.toggleAllRowsSelected` },
  toggleAllPageRowsSelected: { read: (T) => `${T}.toggleAllPageRowsSelected` },
  getToggleAllRowsSelectedProps: {
    read: (T) => `(props) => ({ ${INSTANCE_PROPS.getToggleAllRowsSelectedProps(T)}, ...props })`,
    props: (T) => INSTANCE_PROPS.getToggleAllRowsSelectedProps(T),
  },
  getToggleAllPageRowsSelectedProps: {
    read: (T) => `(props) => ({ ${INSTANCE_PROPS.getToggleAllPageRowsSelectedProps(T)}, ...props })`,
    props: (T) => INSTANCE_PROPS.getToggleAllPageRowsSelectedProps(T),
  },
  isAllRowsExpanded: { read: (T) => `${T}.getIsAllRowsExpanded()` },
  toggleAllRowsExpanded: { read: (T) => `${T}.toggleAllRowsExpanded` },
  getToggleAllRowsExpandedProps: {
    read: (T) => `(props) => ({ ${INSTANCE_PROPS.getToggleAllRowsExpandedProps(T)}, ...props })`,
    props: (T) => INSTANCE_PROPS.getToggleAllRowsExpandedProps(T),
  },
  expandedRows: { read: (T) => `${T}.getExpandedRowModel().rows` },
  expandedDepth: { read: (T) => `${T}.getExpandedDepth()` },
  toggleRowExpanded: { read: (T) => `(rowId, value) => ${T}.getRow(rowId).toggleExpanded(value)` },
  toggleHideColumn: {
    read: (T) => `(columnId, value) => ${T}.getColumn(columnId)?.toggleVisibility(value === undefined ? undefined : !value)`,
    needs: visibility,
  },
  toggleHideAllColumns: {
    read: (T) => `(value) => ${T}.toggleAllColumnsVisible(value === undefined ? undefined : !value)`,
    needs: visibility,
  },
  getToggleHideAllColumnsProps: {
    read: (T) => `(props) => ({ ${INSTANCE_PROPS.getToggleHideAllColumnsProps(T)}, ...props })`,
    props: (T) => INSTANCE_PROPS.getToggleHideAllColumnsProps(T),
    needs: visibility,
  },
  setHiddenColumns: {
    read: (T) => `(ids) => ${T}.setColumnVisibility(Object.fromEntries(ids.map((id) => [id, false])))`,
    needs: visibility,
  },
  setColumnOrder: { read: (T) => `${T}.setColumnOrder`, needs: [feature('columnOrderingFeature')] },
  totalColumnsWidth: { read: (T) => `${T}.getTotalSize()`, needs: [feature('columnSizingFeature')] },
}

const INSTANCE_PROPS = {
  getToggleAllRowsSelectedProps: (T: string) =>
    `onChange: ${T}.getToggleAllRowsSelectedHandler(), checked: ${T}.getIsAllRowsSelected(), indeterminate: ${T}.getIsSomeRowsSelected() && !${T}.getIsAllRowsSelected(), title: 'Toggle All Rows Selected', style: { cursor: 'pointer' }`,
  getToggleAllPageRowsSelectedProps: (T: string) =>
    `onChange: ${T}.getToggleAllPageRowsSelectedHandler(), checked: ${T}.getIsAllPageRowsSelected(), indeterminate: ${T}.getIsSomePageRowsSelected() && !${T}.getIsAllPageRowsSelected(), title: 'Toggle All Current Page Rows Selected', style: { cursor: 'pointer' }`,
  getToggleAllRowsExpandedProps: (T: string) =>
    `onClick: ${T}.getToggleAllRowsExpandedHandler(), title: 'Toggle All Rows Expanded', style: { cursor: 'pointer' }`,
  getToggleHideAllColumnsProps: (T: string) =>
    `onChange: ${T}.getToggleAllColumnsVisibilityHandler(), checked: ${T}.getIsAllColumnsVisible(), indeterminate: !${T}.getIsAllColumnsVisible() && ${T}.getIsSomeColumnsVisible(), title: 'Toggle All Columns Hidden', style: { cursor: 'pointer' }`,
}

/** Members of the render-time objects. `X` is the v9 object expression (row, cell, header, column). */
export interface MemberEntry {
  /** A plain read: `X.isSelected` → `X.getIsSelected()`. */
  read?: (X: string) => string
  /** A method call: `X.toggleRowSelected(a)` → `X.toggleSelected(a)`; receives printed args. */
  call?: (X: string, args: string[]) => string
  /** Prop getters: object-literal body of the v7 default props (key handled separately). */
  props?: (X: string) => string
  /** JSX key for element prop getters (getRowProps, getCellProps, ...). */
  key?: (X: string) => string
  /** Extra JSX attributes for element prop getters (colSpan). */
  attrs?: (X: string) => Record<string, string>
  needs?: Need[]
  todo?: string
}

const sortFeature = [feature('rowSortingFeature')]
const filterFeature = [feature('columnFilteringFeature')]
const facetFeature = [feature('columnFacetingFeature'), rowModel('facetedRowModel', 'createFacetedRowModel')]

/** Members a v9 Column has (also reached as `header.column.X`). */
export const COLUMN: Record<string, MemberEntry> = {
  isSorted: { read: (X) => `!!${X}.getIsSorted()`, needs: sortFeature },
  isSortedDesc: { read: (X) => `${X}.getIsSorted() === 'desc'`, needs: sortFeature },
  sortedIndex: { read: (X) => `${X}.getSortIndex()`, needs: sortFeature },
  canSort: { read: (X) => `${X}.getCanSort()`, needs: sortFeature },
  toggleSortBy: { call: (X, a) => `${X}.toggleSorting(${a.join(', ')})`, needs: sortFeature },
  clearSortBy: { call: (X) => `${X}.clearSorting()`, needs: sortFeature },
  getSortByToggleProps: {
    props: (X) => `onClick: ${X}.getToggleSortingHandler(), style: { cursor: ${X}.getCanSort() ? 'pointer' : undefined }, title: ${X}.getCanSort() ? 'Toggle SortBy' : undefined`,
    needs: sortFeature,
  },
  canFilter: { read: (X) => `${X}.getCanFilter()`, needs: filterFeature },
  filterValue: { read: (X) => `${X}.getFilterValue()`, needs: filterFeature },
  setFilter: { call: (X, a) => `${X}.setFilterValue(${a.join(', ')})`, read: (X) => `(value) => ${X}.setFilterValue(value)`, needs: filterFeature },
  preFilteredRows: { read: (X) => `${X}.getFacetedRowModel().rows`, needs: facetFeature },
  filteredRows: { read: (X) => `${X}.getFacetedRowModel().rows`, needs: facetFeature },
  isVisible: { read: (X) => `${X}.getIsVisible()`, needs: visibility },
  toggleHidden: { call: (X, a) => (a.length ? `${X}.toggleVisibility(!(${a[0]}))` : `${X}.toggleVisibility()`), needs: visibility },
  getToggleHiddenProps: {
    props: (X) => `onChange: ${X}.getToggleVisibilityHandler(), checked: ${X}.getIsVisible(), title: 'Toggle Column Visible', style: { cursor: 'pointer' }`,
    needs: visibility,
  },
  id: { read: (X) => `${X}.id` },
  depth: { read: (X) => `${X}.depth` },
  parent: { read: (X) => `${X}.parent` },
  columns: { read: (X) => `${X}.columns` },
  Header: { read: (X) => `${X}.columnDef.header` },
  Footer: { read: (X) => `${X}.columnDef.footer` },
  Cell: { read: (X) => `${X}.columnDef.cell` },
  Filter: { read: (X) => `${X}.columnDef.meta?.Filter` },
  accessor: { read: (X) => `${X}.accessorFn` },
  width: { read: (X) => `${X}.getSize()`, needs: [feature('columnSizingFeature')] },
  totalWidth: { read: (X) => `${X}.getSize()`, needs: [feature('columnSizingFeature')] },
  canGroupBy: { read: (X) => `${X}.getCanGroup()`, todo: 'grouping (useGroupBy) is not migrated' },
  isGrouped: { read: (X) => `${X}.getIsGrouped()`, todo: 'grouping (useGroupBy) is not migrated' },
  canResize: { read: (X) => `${X}.getCanResize()`, todo: 'column resizing (useResizeColumns) is not migrated' },
}

/** Members only a v9 Header has; anything else is read through `header.column`. */
export const HEADER: Record<string, MemberEntry> = {
  getHeaderProps: { key: (X) => `${X}.id`, attrs: (X) => ({ colSpan: `${X}.colSpan` }) },
  getFooterProps: { key: (X) => `${X}.id`, attrs: (X) => ({ colSpan: `${X}.colSpan` }) },
  headers: { read: (X) => `${X}.subHeaders` },
  totalWidth: { read: (X) => `${X}.getSize()`, needs: [feature('columnSizingFeature')] },
  isPlaceholder: { read: (X) => `${X}.isPlaceholder` },
  placeholderOf: { read: (X) => `${X}.placeholderId`, todo: 'placeholderOf has no exact v9 equivalent; check header.isPlaceholder / header.column' },
  getResizerProps: { todo: 'column resizing (useResizeColumns) is not migrated: use header.getResizeHandler()' },
  isResizing: { todo: 'column resizing (useResizeColumns) is not migrated: use header.column.getIsResizing()' },
  getGroupByToggleProps: { props: (X) => `onClick: ${X}.column.getToggleGroupingHandler()`, todo: 'grouping (useGroupBy) is not migrated' },
}

export const ROW: Record<string, MemberEntry> = {
  getRowProps: { key: (X) => `${X}.id` },
  cells: { read: (X) => `${X}.getVisibleCells()` },
  allCells: { read: (X) => `${X}.getAllCells()` },
  isSelected: { read: (X) => `${X}.getIsSelected()`, needs: [feature('rowSelectionFeature')] },
  isSomeSelected: { read: (X) => `${X}.getIsSomeSelected()`, needs: [feature('rowSelectionFeature')] },
  toggleRowSelected: { call: (X, a) => `${X}.toggleSelected(${a.join(', ')})`, read: (X) => `(value) => ${X}.toggleSelected(value)`, needs: [feature('rowSelectionFeature')] },
  getToggleRowSelectedProps: {
    props: (X) => `onChange: ${X}.getToggleSelectedHandler(), checked: ${X}.getIsSelected(), indeterminate: ${X}.getIsSomeSelected(), title: 'Toggle Row Selected', style: { cursor: 'pointer' }`,
    needs: [feature('rowSelectionFeature')],
  },
  isExpanded: { read: (X) => `${X}.getIsExpanded()`, needs: [feature('rowExpandingFeature')] },
  // v7: canExpand meant "has sub rows", yet any row could be expanded (sub components). The codemod
  // sets getRowCanExpand: () => true so v9 lets every row expand, and reads canExpand from sub rows.
  canExpand: { read: (X) => `!!${X}.subRows?.length`, needs: [feature('rowExpandingFeature')] },
  toggleRowExpanded: { call: (X, a) => `${X}.toggleExpanded(${a.join(', ')})`, read: (X) => `(value) => ${X}.toggleExpanded(value)`, needs: [feature('rowExpandingFeature')] },
  getToggleRowExpandedProps: {
    props: (X) => `onClick: ${X}.getToggleExpandedHandler(), title: 'Toggle Row Expanded', style: { cursor: 'pointer' }`,
    needs: [feature('rowExpandingFeature')],
  },
  isGrouped: { read: (X) => `${X}.getIsGrouped()`, todo: 'grouping (useGroupBy) is not migrated' },
  state: { todo: 'useRowState is not migrated: keep per-row UI state in your own React state keyed by row.id' },
  setState: { todo: 'useRowState is not migrated: keep per-row UI state in your own React state keyed by row.id' },
}

export const CELL: Record<string, MemberEntry> = {
  getCellProps: { key: (X) => `${X}.id` },
  value: { read: (X) => `${X}.getValue()` },
  isGrouped: { read: (X) => `${X}.getIsGrouped()`, todo: 'grouping (useGroupBy) is not migrated' },
  isAggregated: { read: (X) => `${X}.getIsAggregated()`, todo: 'grouping (useGroupBy) is not migrated' },
  isPlaceholder: { read: (X) => `${X}.getIsPlaceholder()`, todo: 'grouping (useGroupBy) is not migrated' },
  state: { todo: 'useRowState is not migrated' },
  setState: { todo: 'useRowState is not migrated' },
}

export const HEADER_GROUP: Record<string, MemberEntry> = {
  getHeaderGroupProps: { key: (X) => `${X}.id` },
  getFooterGroupProps: { key: (X) => `${X}.id` },
}

/** `X.render('Header')` etc. per object kind. */
export const RENDER: Record<string, Record<string, (X: string) => string>> = {
  header: {
    Header: (X) => `${X}.isPlaceholder ? null : flexRender(${X}.column.columnDef.header, ${X}.getContext())`,
    Footer: (X) => `${X}.isPlaceholder ? null : flexRender(${X}.column.columnDef.footer, ${X}.getContext())`,
    Filter: (X) => `flexRender(${X}.column.columnDef.meta?.Filter, ${X}.getContext())`,
  },
  cell: {
    Cell: (X) => `flexRender(${X}.column.columnDef.cell, ${X}.getContext())`,
    Aggregated: (X) => `flexRender(${X}.column.columnDef.aggregatedCell, ${X}.getContext())`,
  },
}

/** v7 built-in filter types → v9 filter fns, or a compat helper where v9 has no exact match. */
export const FILTER_TYPES: Record<string, { v9: string; compat?: boolean }> = {
  text: { v9: 'includesString' },
  exactText: { v9: 'equalsString' },
  exactTextCase: { v9: 'equalsStringSensitive' },
  includes: { v9: 'v7Includes', compat: true },
  includesAll: { v9: 'arrIncludesAll' },
  includesSome: { v9: 'arrIncludesSome' },
  includesValue: { v9: 'arrHas' },
  exact: { v9: 'equals' },
  equals: { v9: 'weakEquals' },
  between: { v9: 'inNumberRange' },
}

/** v7 built-in sort types → v9 sort fns. v7's alphanumeric is case-sensitive. */
export const SORT_TYPES: Record<string, { v9: string; compat?: boolean }> = {
  alphanumeric: { v9: 'alphanumericCaseSensitive' },
  datetime: { v9: 'datetime' },
  basic: { v9: 'basic' },
  string: { v9: 'text' },
  number: { v9: 'v7Number', compat: true },
}

/** v7 column-definition keys. */
export const COLUMN_RENAMES: Record<string, string> = {
  Header: 'header',
  Cell: 'cell',
  Footer: 'footer',
  Aggregated: 'aggregatedCell',
  sortInverted: 'invertSorting',
  width: 'size',
  minWidth: 'minSize',
  maxWidth: 'maxSize',
  aggregate: 'aggregationFn',
}

export const COLUMN_NEGATIONS: Record<string, string> = {
  disableSortBy: 'enableSorting',
  disableFilters: 'enableColumnFilter',
  disableGlobalFilter: 'enableGlobalFilter',
  disableGroupBy: 'enableGrouping',
  disableResizing: 'enableResizing',
}

export const COLUMN_KEEP = new Set(['id', 'columns', 'sortDescFirst', 'sortUndefined', 'meta'])

/** Keys that mark an object literal as a v7 column definition. */
export const COLUMN_MARKERS = new Set(['Header', 'accessor', 'Cell', 'Footer'])
