/**
 * Units of Measure (UOM)
 * Strictly conforms to NetCHB spec/data_type.xsd (unitOfMeasureType)
 */

export interface UnitOfMeasure {
  code: string;
  name: string;
  aliases: string[];
}

export const UNITS_OF_MEASURE: Record<string, UnitOfMeasure> = {
  DOZ: { code: 'DOZ', name: 'Dozen', aliases: ['DOZ.', 'DOZEN', 'DOZENS', 'DZ'] },
  KG: { code: 'KG', name: 'Kilograms', aliases: ['KGS', 'KILO', 'KILOGRAM', 'KG.'] },
  NO: { code: 'NO', name: 'Number / Units', aliases: ['NUM', 'NUMBER', 'EA', 'EACH'] },
  PCS: { code: 'PCS', name: 'Pieces', aliases: ['PC', 'PIECE', 'PIECES'] },
  CTN: { code: 'CTN', name: 'Cartons', aliases: ['CARTON', 'CARTONS', 'BOX', 'BOXES'] },
  PRS: { code: 'PRS', name: 'Pairs', aliases: ['PAIR', 'PAIRS', 'PR'] },
  M: { code: 'M', name: 'Meters', aliases: ['METER', 'METRES', 'MTR'] },
  M2: { code: 'M2', name: 'Square Meters', aliases: ['SQM', 'SQ.M'] },
  M3: { code: 'M3', name: 'Cubic Meters', aliases: ['CBM', 'CU.M'] },
  L: { code: 'L', name: 'Liters', aliases: ['LITER', 'LITRE', 'LTR'] },
};

/**
 * Normalizes any UOM string to a valid NetCHB unitOfMeasureType
 */
export function normalizeUom(input?:string|null):string|null {
 if(!input)return null;
 const clean=input.trim().toUpperCase();
 return Object.entries(UNITS_OF_MEASURE).find(([k,v])=>k===clean||v.aliases.includes(clean))?.[0]??null;
}
