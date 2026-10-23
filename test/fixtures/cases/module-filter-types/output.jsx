import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  filterFn_includesString,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import { fromV7FilterTypes } from '@amjadiqbal/react-table-v7-migrate/compat';

const v7DefaultColumn = {
  filterFn: 'includesString'
};

function startsWith(rows, ids, value) {
  return rows.filter((row) => ids.some((id) => String(row.getValue(id)).startsWith(value)));
}

const filterTypes = { startsWith }

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),

  filterFns: {
    includesString: filterFn_includesString,
    ...fromV7FilterTypes(filterTypes)
  }
});

export function Table({ columns, data }) {
  const table = useTable({
    features,
    columns,
    data,
    defaultColumn: v7DefaultColumn
  })
  const rows = table.getRowModel().rows;
  return <span>{rows.length}</span>
}

export const columns = [{ header: 'Name', accessorKey: 'name', filterFn: 'startsWith' }]
