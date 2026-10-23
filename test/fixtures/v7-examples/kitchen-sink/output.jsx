import React from 'react'

import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_inNumberRange,
  filterFn_includesString,
  filterFn_weakEquals,
  flexRender,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import { filterFn_v7Includes, fromV7FilterType, fromV7FilterTypes } from '@amjadiqbal/react-table-v7-migrate/compat';
import { matchSorter } from 'match-sorter'

import makeData from '../makeData.js'

// react-table v7's defaults on every column: its built-in 'text' filter and its case-sensitive alphanumeric sort
const v7DefaultColumn = {
  filterFn: 'includesString',
  sortFn: 'alphanumericCaseSensitive'
};

const Styles = ({ children }) => <div>{children}</div>

// Create an editable cell renderer
const EditableCell = ({
  getValue,
  row: { index },
  column: { id },
  table
}) => {
  const initialValue = getValue();
  const updateMyData = table.options.meta?.updateMyData;
  const editable = table.options.meta?.editable;
  // We need to keep and update the state of the cell normally
  const [value, setValue] = React.useState(initialValue)

  const onChange = e => {
    setValue(e.target.value)
  }

  // We'll only update the external data when the input is blurred
  const onBlur = () => {
    updateMyData(index, id, value)
  }

  // If the initialValue is changed externall, sync it up with our state
  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  if (!editable) {
    return `${initialValue}`
  }

  return <input value={value} onChange={onChange} onBlur={onBlur} />
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

// Be sure to pass our updateMyData and the skipReset option
function Table({ columns, data, updateMyData, skipReset }) {
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
      // And also our default editable cell
      cell: EditableCell,
      meta: {
        Filter: DefaultColumnFilter
      },
    }),
    []
  )

  const columnsWithHooks = React.useMemo(() => (columns => {
    return [
      {
        id: 'selection',
        // The header can use the table's getToggleAllRowsSelectedProps method
        // to render a checkbox
        header: ({ table }) => {
          const getToggleAllRowsSelectedProps = props => ({
            onChange: table.getToggleAllRowsSelectedHandler(),
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected(),
            title: 'Toggle All Rows Selected',

            style: {
              cursor: 'pointer'
            },

            ...props
          });

          return (
            <div>
              <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
            </div>
          );
        },
        // The cell can use the individual row's getToggleRowSelectedProps method
        // to the render a checkbox
        cell: ({ row }) => (
          <div>
            <IndeterminateCheckbox
              onChange={row.getToggleSelectedHandler()}
              checked={row.getIsSelected()}
              indeterminate={row.getIsSomeSelected()}
              title='Toggle Row Selected'
              style={{
                cursor: 'pointer'
              }} />
          </div>
        ),
        meta: {
          // Make this column a groupByBoundary. This ensures that groupBy columns
          // are placed after it
          groupByBoundary: true
        },
      },
      ...columns,
    ];
  })(columns), [columns]);

  const features = React.useMemo(() => tableFeatures({
    columnFilteringFeature,
    columnFacetingFeature,
    rowSortingFeature,
    rowExpandingFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    columnVisibilityFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    sortedRowModel: createSortedRowModel(),
    expandedRowModel: createExpandedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),

    filterFns: {
      weakEquals: filterFn_weakEquals,
      inNumberRange: filterFn_inNumberRange,
      v7Includes: filterFn_v7Includes,
      includesString: filterFn_includesString,
      ...fromV7FilterTypes(filterTypes)
    },

    sortFns: {
      alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
    }
  }), [filterTypes]);

  // Use the state and functions returned from useTable to build your UI
  // TODO(react-table-v7-migrate): useGroupBy (grouping/aggregation) is not migrated: add columnGroupingFeature, rowAggregationFeature and groupedRowModel by hand (see the v9 grouping guide)
  // TODO(react-table-v7-migrate): state.groupBy has no v9 mapping
  const table = useTable({
    features,
    columns: columnsWithHooks,
    data,

    defaultColumn: {
      ...v7DefaultColumn,
      ...defaultColumn
    },

    // We also need to pass this so the page doesn't change
    // when we edit the data.
    autoResetPageIndex: !skipReset,

    enableMultiSort: false,

    meta: {
      // updateMyData isn't part of the API, but
      // anything we put into these options will
      // automatically be available on the instance.
      // That way we can call this function from our
      // cell renderer!
      updateMyData
    },

    getSubRows: row => row.subRows,
    sortDescFirst: false,
    enableRowRangeSelection: false,
    getRowCanExpand: () => true
  });

  const headerGroups = table.getHeaderGroups();
  const page = table.getRowModel().rows;
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();
  const pageOptions = table.getPageOptions();
  const pageCount = table.getPageCount();
  const gotoPage = table.setPageIndex;
  const nextPage = table.nextPage;
  const previousPage = table.previousPage;
  const setPageSize = table.setPageSize;
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const sortBy = table.state.sorting;
  const groupBy = table.state.groupBy;
  const expanded = table.state.expanded;
  const filters = table.state.columnFilters;
  const selectedRowIds = table.state.rowSelection;

  // Render the UI for your table
  return (
    <>
      <table>
        <thead>
          {headerGroups.map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} colSpan={header.colSpan}>
                  <div>
                    {header.column.getCanGroup() ? (
                      // If the column can be grouped, let's add a toggle
                      <span onClick={header.column.getToggleGroupingHandler()}>
                        {header.column.getIsGrouped() ? '🛑 ' : '👊 '}
                      </span>
                    ) : null}
                    <span
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        cursor: header.column.getCanSort() ? 'pointer' : undefined
                      }}
                      title={header.column.getCanSort() ? 'Toggle SortBy' : undefined}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {/* Add a sort direction indicator */}
                      {!!header.column.getIsSorted()
                        ? header.column.getIsSorted() === 'desc'
                          ? ' 🔽'
                          : ' 🔼'
                        : ''}
                    </span>
                  </div>
                  {/* Render the columns filter UI */}
                  <div>{header.column.getCanFilter() ? flexRender(header.column.columnDef.meta?.Filter, header.getContext()) : null}</div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {page.map(row => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  // TODO(react-table-v7-migrate): `cell.isPlaceholder`: grouping (useGroupBy) is not migrated
                  // TODO(react-table-v7-migrate): `cell.isAggregated`: grouping (useGroupBy) is not migrated
                  // TODO(react-table-v7-migrate): `cell.isGrouped`: grouping (useGroupBy) is not migrated
                  return (
                    <td key={cell.id}>
                      {cell.getIsGrouped() ? (
                        // If it's a grouped cell, add an expander and row count
                        <>
                          <span
                            onClick={row.getToggleExpandedHandler()}
                            title='Toggle Row Expanded'
                            style={{
                              cursor: 'pointer'
                            }}>
                            {row.getIsExpanded() ? '👇' : '👉'}
                          </span>{' '}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())} (
                          {row.subRows.length})
                        </>
                      ) : cell.getIsAggregated() ? (
                        flexRender(cell.column.columnDef.aggregatedCell, cell.getContext())
                      ) : cell.getIsPlaceholder() ? null : ( // For cells with repeated values, render null
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/*
        Pagination can be built however you'd like.
        This is just a very basic UI implementation:
      */}
      <div className="pagination">
        <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
          {'<<'}
        </button>{' '}
        <button onClick={() => previousPage()} disabled={!canPreviousPage}>
          {'<'}
        </button>{' '}
        <button onClick={() => nextPage()} disabled={!canNextPage}>
          {'>'}
        </button>{' '}
        <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
          {'>>'}
        </button>{' '}
        <span>
          Page{' '}
          <strong>
            {pageIndex + 1} of {pageOptions.length}
          </strong>{' '}
        </span>
        <span>
          | Go to page:{' '}
          <input
            type="number"
            defaultValue={pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              gotoPage(page)
            }}
            style={{ width: '100px' }}
          />
        </span>{' '}
        <select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value))
          }}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
      <pre>
        <code>
          {JSON.stringify(
            {
              pageIndex,
              pageSize,
              pageCount,
              canNextPage,
              canPreviousPage,
              sortBy,
              groupBy,
              expanded: expanded,
              filters,
              selectedRowIds: selectedRowIds,
            },
            null,
            2
          )}
        </code>
      </pre>
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

// This is a custom aggregator that
// takes in an array of leaf values and
// returns the rounded median
function roundedMedian(leafValues) {
  let min = leafValues[0] || 0
  let max = leafValues[0] || 0

  leafValues.forEach(value => {
    min = Math.min(min, value)
    max = Math.max(max, value)
  })

  return Math.round((min + max) / 2)
}

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef()
    const resolvedRef = ref || defaultRef

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate
    }, [resolvedRef, indeterminate])

    return (
      <>
        <input type="checkbox" ref={resolvedRef} {...rest} />
      </>
    )
  }
)

function App() {
  // TODO(react-table-v7-migrate): aggregate → aggregationFn, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): Aggregated → aggregatedCell, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): aggregate → aggregationFn, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): Aggregated → aggregatedCell, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): aggregate → aggregationFn, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): Aggregated → aggregatedCell, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): aggregate → aggregationFn, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): Aggregated → aggregatedCell, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): aggregate → aggregationFn, but grouping (useGroupBy) is not migrated
  // TODO(react-table-v7-migrate): Aggregated → aggregatedCell, but grouping (useGroupBy) is not migrated
  const columns = React.useMemo(
    () => [
      {
        header: 'Name',
        columns: [
          {
            header: 'First Name',
            accessorKey: 'firstName',
            // Use a two-stage aggregator here to first
            // count the total rows being aggregated,
            // then sum any of those counts if they are
            // aggregated further
            aggregationFn: 'count',
            aggregatedCell: ({ getValue }) => {
              const value = getValue();
              return `${value} Names`;
            },
          },
          {
            header: 'Last Name',
            accessorKey: 'lastName',
            filterFn: 'fuzzyText',
            // Use another two-stage aggregator here to
            // first count the UNIQUE values from the rows
            // being aggregated, then sum those counts if
            // they are aggregated further
            aggregationFn: 'uniqueCount',
            aggregatedCell: ({ getValue }) => {
              const value = getValue();
              return `${value} Unique Names`;
            },
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
            // Aggregate the average age of visitors
            aggregationFn: 'average',
            aggregatedCell: ({ getValue }) => {
              const value = getValue();
              return `${value} (avg)`;
            },
            meta: {
              Filter: SliderColumnFilter
            },
          },
          {
            header: 'Visits',
            accessorKey: 'visits',
            filterFn: 'inNumberRange',
            // Aggregate the sum of all visits
            aggregationFn: 'sum',
            aggregatedCell: ({ getValue }) => {
              const value = getValue();
              return `${value} (total)`;
            },
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
            // Use our custom roundedMedian aggregator
            aggregationFn: roundedMedian,
            aggregatedCell: ({ getValue }) => {
              const value = getValue();
              return `${value} (med)`;
            },
            meta: {
              Filter: SliderColumnFilter
            },
          },
        ],
      },
    ],
    []
  );

  const [data, setData] = React.useState(() => makeData(300))
  const [originalData] = React.useState(data)

  // We need to keep the table from resetting the pageIndex when we
  // Update data. So we can keep track of that flag with a ref.
  const skipResetRef = React.useRef(false)

  // When our cell renderer calls updateMyData, we'll use
  // the rowIndex, columnId and new value to update the
  // original data
  const updateMyData = (rowIndex, columnId, value) => {
    // We also turn on the flag to not reset the page
    skipResetRef.current = true
    setData(old =>
      old.map((row, index) => {
        if (index === rowIndex) {
          return {
            ...row,
            [columnId]: value,
          }
        }
        return row
      })
    )
  }

  // After data changes, we turn the flag back off
  // so that if data actually changes when we're not
  // editing it, the page is reset
  React.useEffect(() => {
    skipResetRef.current = false
  }, [data])

  // Let's add a data resetter/randomizer to help
  // illustrate that flow...
  const resetData = () => {
    // Don't reset the page when we do this
    skipResetRef.current = true
    setData(originalData)
  }

  return (
    <Styles>
      <button onClick={resetData}>Reset Data</button>
      <Table
        columns={columns}
        data={data}
        updateMyData={updateMyData}
        skipReset={skipResetRef.current}
      />
    </Styles>
  )
}

export default App
