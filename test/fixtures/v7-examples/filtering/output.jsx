import React from 'react'

import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFilteredRowModel,
  filterFn_inNumberRange,
  filterFn_includesString,
  filterFn_weakEquals,
  flexRender,
  globalFilteringFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import { filterFn_v7Includes, fromV7FilterType, fromV7FilterTypes, useAsyncDebounce } from '@amjadiqbal/react-table-v7-migrate/compat';
// A great library for fuzzy filtering/sorting items
import { matchSorter } from 'match-sorter'

import makeData from '../makeData.js'

const v7DefaultColumn = {
  filterFn: 'includesString'
};

const Styles = ({ children }) => <div>{children}</div>

// Define a default UI for filtering
function GlobalFilter({
  preGlobalFilteredRows,
  globalFilter,
  setGlobalFilter,
}) {
  const count = preGlobalFilteredRows.length
  const [value, setValue] = React.useState(globalFilter)
  const onChange = useAsyncDebounce(value => {
    setGlobalFilter(value || undefined)
  }, 200)

  return (
    <span>
      Search:{' '}
      <input
        value={value || ""}
        onChange={e => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={`${count} records...`}
        style={{
          fontSize: '1.1rem',
          border: '0',
        }}
      />
    </span>
  )
}

// Define a default UI for filtering
function DefaultColumnFilter({
  column,
}) {
  const filterValue = column.getFilterValue();
  const preFilteredRows = column.getFacetedRowModel().rows;
  const setFilter = value => column.setFilterValue(value);
  const count = preFilteredRows.length

  return (
    <input
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
      }}
      placeholder={`Search ${count} records...`}
    />
  )
}

// This is a custom filter UI for selecting
// a unique option from a list
function SelectColumnFilter({
  column,
}) {
  const filterValue = column.getFilterValue();
  const setFilter = value => column.setFilterValue(value);
  const preFilteredRows = column.getFacetedRowModel().rows;
  const id = column.id;
  // Calculate the options for filtering
  // using the preFilteredRows
  const options = React.useMemo(() => {
    const options = new Set()
    preFilteredRows.forEach(row => {
      options.add(row.getValue(id))
    })
    return [...options.values()]
  }, [id, preFilteredRows])

  // Render a multi-select box
  return (
    <select
      value={filterValue}
      onChange={e => {
        setFilter(e.target.value || undefined)
      }}
    >
      <option value="">All</option>
      {options.map((option, i) => (
        <option key={i} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

// This is a custom filter UI that uses a
// slider to set the filter value between a column's
// min and max values
function SliderColumnFilter({
  column,
}) {
  const filterValue = column.getFilterValue();
  const setFilter = value => column.setFilterValue(value);
  const preFilteredRows = column.getFacetedRowModel().rows;
  const id = column.id;
  // Calculate the min and max
  // using the preFilteredRows

  const [min, max] = React.useMemo(() => {
    let min = preFilteredRows.length ? preFilteredRows[0].getValue(id) : 0
    let max = preFilteredRows.length ? preFilteredRows[0].getValue(id) : 0
    preFilteredRows.forEach(row => {
      min = Math.min(row.getValue(id), min)
      max = Math.max(row.getValue(id), max)
    })
    return [min, max]
  }, [id, preFilteredRows])

  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        value={filterValue || min}
        onChange={e => {
          setFilter(parseInt(e.target.value, 10))
        }}
      />
      <button onClick={() => setFilter(undefined)}>Off</button>
    </>
  )
}

// This is a custom UI for our 'between' or number range
// filter. It uses two number boxes and filters rows to
// ones that have values between the two
function NumberRangeColumnFilter({
  column,
}) {
  const filterValue = column.getFilterValue() ?? [];
  const preFilteredRows = column.getFacetedRowModel().rows;
  const setFilter = value => column.setFilterValue(value);
  const id = column.id;
  const [min, max] = React.useMemo(() => {
    let min = preFilteredRows.length ? preFilteredRows[0].getValue(id) : 0
    let max = preFilteredRows.length ? preFilteredRows[0].getValue(id) : 0
    preFilteredRows.forEach(row => {
      min = Math.min(row.getValue(id), min)
      max = Math.max(row.getValue(id), max)
    })
    return [min, max]
  }, [id, preFilteredRows])

  return (
    <div
      style={{
        display: 'flex',
      }}
    >
      <input
        value={filterValue[0] || ''}
        type="number"
        onChange={e => {
          const val = e.target.value
          setFilter((old = []) => [val ? parseInt(val, 10) : undefined, old[1]])
        }}
        placeholder={`Min (${min})`}
        style={{
          width: '70px',
          marginRight: '0.5rem',
        }}
      />
      to
      <input
        value={filterValue[1] || ''}
        type="number"
        onChange={e => {
          const val = e.target.value
          setFilter((old = []) => [old[0], val ? parseInt(val, 10) : undefined])
        }}
        placeholder={`Max (${max})`}
        style={{
          width: '70px',
          marginLeft: '0.5rem',
        }}
      />
    </div>
  )
}

function fuzzyTextFilterFn(rows, id, filterValue) {
  return matchSorter(rows, filterValue, { keys: [row => row.getValue(id)] });
}

// Let the table remove the filter if the string is empty
fuzzyTextFilterFn.autoRemove = val => !val

// Our table component
function Table({ columns, data }) {
  const filterTypes = React.useMemo(
    () => ({
      // Add a new fuzzyTextFilterFn filter type.
      fuzzyText: fuzzyTextFilterFn,
      // Or, override the default text filter to use
      // "startWith"
      text: (rows, id, filterValue) => {
        return rows.filter(row => {
          const rowValue = row.getValue(id)
          return rowValue !== undefined
            ? String(rowValue)
                .toLowerCase()
                .startsWith(String(filterValue).toLowerCase())
            : true
        });
      },
    }),
    []
  )

  const defaultColumn = React.useMemo(
    () => ({
      meta: {
        Filter: DefaultColumnFilter
      },
    }),
    []
  )

  const features = React.useMemo(() => tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    columnFacetingFeature,
    columnVisibilityFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),

    filterFns: {
      weakEquals: filterFn_weakEquals,
      inNumberRange: filterFn_inNumberRange,
      v7Includes: filterFn_v7Includes,
      includesString: filterFn_includesString,
      ...fromV7FilterTypes(filterTypes)
    }
  }), [filterTypes]);

  const table = useTable({
    features,
    columns,
    data,

    // Be sure to pass the defaultColumn option
    defaultColumn: {
      ...v7DefaultColumn,
      ...defaultColumn
    },

    globalFilterFn: 'includesString'
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const preGlobalFilteredRows = table.getPreFilteredRowModel().rows;
  const setGlobalFilter = table.setGlobalFilter;

  // We don't want to render all of the rows for this example, so cap
  // it for this use case
  const firstPageRows = rows.slice(0, 10)

  return (
    <>
      <table>
        <thead>
          {headerGroups.map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {/* Render the columns filter UI */}
                  <div>{header.column.getCanFilter() ? flexRender(header.column.columnDef.meta?.Filter, header.getContext()) : null}</div>
                </th>
              ))}
            </tr>
          ))}
          <tr>
            <th
              colSpan={visibleColumns.length}
              style={{
                textAlign: 'left',
              }}
            >
              <GlobalFilter
                preGlobalFilteredRows={preGlobalFilteredRows}
                globalFilter={table.state.globalFilter}
                setGlobalFilter={setGlobalFilter}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {firstPageRows.map((row, i) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <br />
      <div>Showing the first 20 results of {rows.length} rows</div>
      <div>
        <pre>
          <code>{JSON.stringify(table.state.columnFilters, null, 2)}</code>
        </pre>
      </div>
    </>
  );
}

// Define a custom filter filter function!
function filterGreaterThan(rows, id, filterValue) {
  return rows.filter(row => {
    const rowValue = row.getValue(id)
    return rowValue >= filterValue
  });
}

// This is an autoRemove method on the filter function that
// when given the new filter value and returns true, the filter
// will be automatically removed. Normally this is just an undefined
// check, but here, we want to remove the filter if it's not a number
filterGreaterThan.autoRemove = val => typeof val !== 'number'

function App() {
  const columns = React.useMemo(
    () => [
      {
        header: 'Name',
        columns: [
          {
            header: 'First Name',
            accessorKey: 'firstName',
          },
          {
            header: 'Last Name',
            accessorKey: 'lastName',
            filterFn: 'fuzzyText',
          },
        ],
      },
      {
        header: 'Info',
        columns: [
          {
            header: 'Age',
            accessorKey: 'age',
            filterFn: 'weakEquals',
            meta: {
              Filter: SliderColumnFilter
            },
          },
          {
            header: 'Visits',
            accessorKey: 'visits',
            filterFn: 'inNumberRange',
            meta: {
              Filter: NumberRangeColumnFilter
            },
          },
          {
            header: 'Status',
            accessorKey: 'status',
            filterFn: 'v7Includes',
            meta: {
              Filter: SelectColumnFilter
            },
          },
          {
            header: 'Profile Progress',
            accessorKey: 'progress',
            filterFn: fromV7FilterType(filterGreaterThan),
            meta: {
              Filter: SliderColumnFilter
            },
          },
        ],
      },
    ],
    []
  )

  const data = React.useMemo(() => makeData(300), [])

  return (
    <Styles>
      <Table columns={columns} data={data} />
    </Styles>
  )
}

export default App
