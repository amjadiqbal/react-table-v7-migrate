import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  flexRender,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

const features = tableFeatures({
  rowPaginationFeature,
  columnVisibilityFeature,
  paginatedRowModel: createPaginatedRowModel()
});

function Pager({ instance }) {
  return <button onClick={() => instance.nextPage()}>next</button>
}

export function Grid({ columns, data }) {
  const instance = useTable({
    features,
    columns,
    data
  })
  const page = instance.getRowModel().rows;
  // TODO(react-table-v7-migrate): `instance` is a v9 table now; code that receives it must use the v9 API
  return (
    <>
      <p>Page {instance.state.pagination.pageIndex + 1} of {instance.getPageCount()}</p>
      <table>
        <tbody>
          {page.map((row) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pager instance={instance} />
    </>
  );
}
