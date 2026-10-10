/**
 * USITC HTS Lookup Service (Task T6)
 * 
 * Interacts with the official US International Trade Commission (USITC) HTS REST API
 * (https://hts.usitc.gov/reststop/search?keyword=...) to expand 6-digit HS codes
 * into candidate 10-digit HTS codes with statistical suffixes, units of measure, and duty rates.
 */

export interface HtsCandidate {
  htsno: string;               // e.g. "6109.10.00.12"
  rawHtsNo: string;            // without dots e.g. "6109100012"
  description: string;         // e.g. "Men's (338)"
  generalDutyRate: string;     // e.g. "16.5%"
  specialDutyRate: string;     // e.g. "Free (AU,BH,...)"
  unitsOfQuantity: string[];   // e.g. ["doz.", "kg"]
  indent: number;
}

export interface HtsLookupResult {
  hs6: string;
  baseHeading: string;
  headingDescription: string;
  generalDutyRate: string;
  candidates: HtsCandidate[];
}

/**
 * Searches USITC HTS REST API for a given 6-digit HS code (e.g. "6109.10").
 */
export async function lookupHts6(hs6: string): Promise<HtsLookupResult> {
  const cleanCode = hs6.trim();
  const url = `https://hts.usitc.gov/reststop/search?keyword=${encodeURIComponent(cleanCode)}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'NetCHB-Entry-Pipeline/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`USITC HTS API responded with status ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as any[];

  let headingDescription = '';
  let generalDutyRate = '';
  let baseHeading = '';
  const candidates: HtsCandidate[] = [];

  for (const item of data) {
    const htsno = item.htsno || '';
    const digitsOnly = htsno.replace(/\D/g, '');

    // 8-digit heading level (e.g. 6109.10.00)
    if (digitsOnly.length === 8 && !baseHeading) {
      baseHeading = htsno;
      headingDescription = item.description || '';
      generalDutyRate = item.general || '';
    }

    // 10-digit statistical level (e.g. 6109.10.00.04, 6109.10.00.12)
    if (digitsOnly.length === 10) {
      candidates.push({
        htsno,
        rawHtsNo: digitsOnly,
        description: item.description || '',
        generalDutyRate: item.general || generalDutyRate,
        specialDutyRate: item.special || '',
        unitsOfQuantity: Array.isArray(item.units) ? item.units : [],
        indent: parseInt(item.indent || '0', 10),
      });
    }
  }

  return {
    hs6: cleanCode,
    baseHeading: baseHeading || cleanCode,
    headingDescription,
    generalDutyRate,
    candidates,
  };
}
