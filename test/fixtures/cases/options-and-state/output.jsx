import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),

  filterFns: {
    includesString: filterFn_includesString
  },

  sortFns: {
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
  }
});

const v7DefaultColumn = {
  filterFn: 'includesString',
  sortFn: 'alphanumericCaseSensitive'
};

export function Table({ columns, data, pageCount, skipReset }) {
  const table = useTable({
    features,
    columns,
    data,
    manualPagination: true,
    manualSorting: true,
    pageCount,
    autoResetPageIndex: !skipReset,
    enableMultiSort: false,
    enableSortingRemoval: false,
    getRowId: (row) => row.uuid,

    initialState: {
      sorting: [{ id: 'age', desc: true }],
      columnFilters: [{ id: 'status', value: 'single' }],
      globalFilter: 'an',
      rowSelection: { a1: true },
      expanded: { a1: true },
      columnVisibility: {
        'secret': false,
        'internal': false
      },
      pagination: {
        pageIndex: 2,
        pageSize: 10
      },
    },

    getSubRows: row => row.subRows,
    sortDescFirst: false,
    globalFilterFn: 'includesString',
    enableRowRangeSelection: false,
    getRowCanExpand: () => true,
    defaultColumn: v7DefaultColumn
  })
  const rows = table.getPrePaginatedRowModel().rows;
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const sortBy = table.state.sorting;
  const filters = table.state.columnFilters;
  const globalFilter = table.state.globalFilter;
  const selectedRowIds = table.state.rowSelection;
  const expanded = table.state.expanded;
  const hiddenColumns = Object.keys(table.state.columnVisibility).filter(id => table.state.columnVisibility[id] === false);
  const setGlobalFilter = table.setGlobalFilter;
  const gotoPage = table.setPageIndex;
  const setPageSize = table.setPageSize;
  const setSortBy = table.setSorting;
  const setAllFilters = table.setColumnFilters;
  const setFilter = (columnId, value) => table.getColumn(columnId)?.setFilterValue(value);
  const toggleAllRowsSelected = table.toggleAllRowsSelected;
  const isAllRowsSelected = table.getIsAllRowsSelected();
  const toggleHideColumn = (columnId, value) => table.getColumn(columnId)?.toggleVisibility(value === undefined ? undefined : !value);
  const allColumns = table.getAllLeafColumns();
  return (
    <div>
      <pre>{JSON.stringify({ pageIndex, pageSize, sortBy, filters, globalFilter, selectedRowIds, expanded, hiddenColumns })}</pre>
      <button onClick={() => gotoPage(0)}>first</button>
      <button onClick={() => setPageSize(50)}>50</button>
      <button onClick={() => setSortBy([])}>unsort</button>
      <button onClick={() => setAllFilters([])}>clear</button>
      <button onClick={() => setFilter('status', 'single')}>single</button>
      <button onClick={() => setGlobalFilter(undefined)}>clear search</button>
      <button onClick={() => toggleAllRowsSelected(!isAllRowsSelected)}>all</button>
      <button onClick={() => toggleHideColumn('age', true)}>hide age</button>
      <span>{rows.length} rows, {allColumns.length} columns</span>
    </div>
  )
}
