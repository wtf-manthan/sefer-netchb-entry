import records from './data/countries.json';
export interface CountryCode { alpha2: string; alpha3?: string; name: string; aliases?: string[] }
export const COUNTRY_OPTIONS: readonly CountryCode[] = records;
export const COUNTRIES: Record<string, CountryCode> = Object.fromEntries(records.map(c => [c.alpha2,c]));
export function isCountryCode(value:string):boolean { return Object.hasOwn(COUNTRIES,value); }
const key=(value:string)=>value.normalize('NFKC').toUpperCase().replace(/[.\s]/g,'');
// These unqualified names cannot safely distinguish the intended territory.
const ambiguous=new Set(['KOREA','CONGO','VIRGINISLANDS']);
export function normalizeCountryCode(input?:string|null):string|null {
  if(!input)return null;
  const clean=key(input);
  if(ambiguous.has(clean))return null;
  if(isCountryCode(clean))return clean;
  const matches=records.filter(c=>[c.name,('alpha3' in c?c.alpha3:''),...('aliases' in c?c.aliases:[])].some(n=>n&&key(n)===clean));
  return matches.length===1?matches[0].alpha2:null;
}
