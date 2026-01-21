declare module 'ag-grid-community' {
  // Minimal ambient typings to silence editor/TS errors in Storybook environment.
  // These are intentionally permissive (any) — replace with proper types if you install full typings.
  export type ColDef = any;
  export type GridReadyEvent = any;
  export type GridApi = any;
  export type ColumnApi = any;
  export type FirstDataRenderedEvent = any;
  export type GridOptions = any;
  export const RowNode: any;
  const _default: any;
  export default _default;
}

declare module 'ag-grid-react' {
  // Provide a permissive module declaration so imports resolve in TypeScript.
  import type { ComponentType } from 'react';
  export const AgGridReact: any;
  const _default: any;
  export default _default;
}
