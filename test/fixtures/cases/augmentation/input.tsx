import { UseSortByColumnOptions, UseSortByColumnProps } from 'react-table'

declare module 'react-table' {
  export interface ColumnInterface<D extends object = {}> extends UseSortByColumnOptions<D> {}
  export interface ColumnInstance<D extends object = {}> extends UseSortByColumnProps<D> {}
}
