import data from './data/statistical-units.json';
/** Schema vocabulary only: does not establish the units required by an HTS classification. */
export const STATISTICAL_UNITS: readonly string[] = data.codes;
export const isStatisticalUnit=(value:string):boolean=>STATISTICAL_UNITS.includes(value);
