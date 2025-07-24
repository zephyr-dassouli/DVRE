/**
 * DAL-Clean - Essential Active Learning Extension
 * Minimal, focused DAL functionality integrated with DVRE Core
 */

// Core components
export { DALComponent, default as DALComponentDefault } from './DALComponent';
export { DALWidget, default as DALWidgetDefault } from './DALWidget';

// Types
export * from './types';

// Main activation function (for JupyterLab extension)
export const activate = () => {
  console.log('DAL-Clean extension activated');
  // TODO: Add JupyterLab extension activation logic
}; 