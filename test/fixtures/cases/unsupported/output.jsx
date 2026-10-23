import {
  columnVisibilityFeature,
  createExpandedRowModel,
  flexRender,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

const features = tableFeatures({
  rowExpandingFeature,
  columnVisibilityFeature,
  expandedRowModel: createExpandedRowModel()
});

export function Table({ columns, data }) {
  // TODO(react-table-v7-migrate): useGroupBy (grouping/aggregation) is not migrated: add columnGroupingFeature, rowAggregationFeature and groupedRowModel by hand (see the v9 grouping guide)
  // TODO(react-table-v7-migrate): useBlockLayout only set CSS widths; v9 has no layout plugins. Set widths from header.getSize() / cell.column.getSize() yourself
  // TODO(react-table-v7-migrate): useResizeColumns is not migrated: add columnSizingFeature + columnResizingFeature and use header.getResizeHandler() (see the v9 column-resizing guide)
  // TODO(react-table-v7-migrate): plugin hook code `hooks.useInstance.push((instance) => instance)` is not migrated (only hooks.visibleColumns.push is)
  // TODO(react-table-v7-migrate): stateReducer has no v9 equivalent: use controlled state (`state` + `on<Slice>Change`) or the `atoms` option
  // TODO(react-table-v7-migrate): useControlledState has no v9 equivalent: pass controlled slices with `state` + `on<Slice>Change`
  const table = useTable({
    features,
    columns,
    data,
    getSubRows: row => row.subRows,
    getRowCanExpand: () => true
  });
  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  return (
    <div>
      {headerGroups.map((hg) => (
        <div key={hg.id}>
          {hg.headers.map((header) => (
            <div key={header.id} colSpan={header.colSpan}>
              {header.column.getCanGroup() ? <span onClick={header.column.getToggleGroupingHandler()}>group</span> : null}
              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              <div {...header.getResizerProps()} />
            </div>
          ))}
        </div>
      ))}
      {rows.map((row) => {
        return (
          <div key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id}>
                {cell.getIsGrouped() ? flexRender(cell.column.columnDef.cell, cell.getContext()) : cell.getIsAggregated() ? flexRender(cell.column.columnDef.aggregatedCell, cell.getContext()) : flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export const getter = makePropGetter
