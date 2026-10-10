/**
 * ISO 4217 Currency Codes & US State Codes & Special Program Indicators (SPI)
 */

export interface CurrencyCode {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: Record<string, CurrencyCode> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  VND: { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
};

export function normalizeCurrency(input?:string|null):string|null { const code=input?.trim().toUpperCase();return code&&code in CURRENCIES?code:null; }

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'Virgin Islands',
};

