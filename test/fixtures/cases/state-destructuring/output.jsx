import {
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

const features = tableFeatures({
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),

  filterFns: {
    includesString: filterFn_includesString
  },

  sortFns: {
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
  }
});

const v7DefaultColumn = {
  sortFn: 'alphanumericCaseSensitive'
};

export function Table({ columns, data }) {
  const tableInstance = useTable({
    features,
    columns,
    data,

    initialState: { pagination: {
      pageIndex: 0,
      pageSize: 25
    } },

    sortDescFirst: false,
    globalFilterFn: 'includesString',
    defaultColumn: v7DefaultColumn
  })
  const headerGroups = tableInstance.getHeaderGroups();
  const page = tableInstance.getRowModel().rows;
  const setGlobalFilter = tableInstance.setGlobalFilter;
  const globalFilter = tableInstance.state.globalFilter, pageIndex = tableInstance.state.pagination.pageIndex, pageSize = tableInstance.state.pagination.pageSize ?? 10, sortBy = tableInstance.state.sorting;
  const current = tableInstance.state.pagination.pageIndex
  return (
    <div>
      <input value={globalFilter || ''} onChange={(e) => setGlobalFilter(e.target.value)} />
      <span>{pageIndex}/{current}/{pageSize}/{sortBy.length}</span>
      {headerGroups.map((hg) => <div key={hg.id}>{hg.headers.map((c) => <b key={c.id} colSpan={c.colSpan}>{c.isPlaceholder ? null : flexRender(c.column.columnDef.header, c.getContext())}</b>)}</div>)}
      {page.map((row) => {
        return <p key={row.id}>{row.getVisibleCells().map((cell) => <i key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</i>)}</p>;
      })}
    </div>
  );
}
