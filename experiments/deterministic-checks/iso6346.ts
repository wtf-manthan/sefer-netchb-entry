/**
 * ISO 6346 Container Number Validation & Check Digit Algorithm
 * 
 * Standard: 4 letters (3-letter owner code + 1 equipment identifier 'U', 'J', 'Z'),
 * followed by 6 serial digits and 1 check digit.
 * 
 * Letter values: A=10, B=12 ... Z=38 (multiples of 11 are skipped: 11, 22, 33).
 * Weights: 2^0, 2^1, ... 2^9.
 * Check digit = (Sum % 11) % 10.
 */

import { Finding } from './types';

// Character value mapping per ISO 6346:1995
const ISO_6346_LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
};

/**
 * Calculates the ISO 6346 check digit for a 10-character container prefix (4 letters + 6 digits).
 * Returns number 0-9, or null if the input format is invalid.
 */
export function calculateIso6346CheckDigit(containerPrefix: string): number | null {
  const cleaned = containerPrefix.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== 10) {
    return null;
  }

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = cleaned[i];
    let value: number;

    if (char >= '0' && char <= '9') {
      value = parseInt(char, 10);
    } else if (char in ISO_6346_LETTER_VALUES) {
      value = ISO_6346_LETTER_VALUES[char];
    } else {
      return null;
    }

    const weight = Math.pow(2, i);
    sum += value * weight;
  }

  const remainder = sum % 11;
  return remainder % 10;
}

/**
 * Validates an 11-character container number against ISO 6346.
 */
export function validateContainerNumber(containerNo: string): {
  isValid: boolean;
  expectedCheckDigit: number | null;
  actualCheckDigit: number | null;
  normalized: string;
} {
  const cleaned = containerNo.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== 11) {
    return {
      isValid: false,
      expectedCheckDigit: null,
      actualCheckDigit: null,
      normalized: cleaned
    };
  }

  const prefix = cleaned.slice(0, 10);
  const actualCheckDigit = parseInt(cleaned[10], 10);
  const expectedCheckDigit = calculateIso6346CheckDigit(prefix);

  const isValid = expectedCheckDigit !== null && expectedCheckDigit === actualCheckDigit;

  return {
    isValid,
    expectedCheckDigit,
    actualCheckDigit,
    normalized: cleaned
  };
}

/**
 * Checks container number strikethrough and check digit correctness.
 * Emits Finding F05 if correction / check digit validation occurs.
 */
export function checkContainerNumber(
  containerFinal: string,
  struckThroughPrinted?: string
): Finding | null {
  const validation = validateContainerNumber(containerFinal);

  if (struckThroughPrinted) {
    const printedValidation = validateContainerNumber(struckThroughPrinted);
    return {
      code: 'F05',
      severity: 'VERIFY',
      topic: 'container number handwritten correction',
      message: `Container number printed ${struckThroughPrinted} was struck through and hand-corrected to ${containerFinal}. ` +
               `Computed check digit for prefix ${containerFinal.slice(0, 10)} is ${validation.expectedCheckDigit}. ` +
               `Corrected number passes ISO 6346 check digit (${validation.isValid ? 'VALID' : 'INVALID'}), ` +
               `while printed number ${struckThroughPrinted} ${printedValidation.isValid ? 'passes' : 'FAILS (check digit ' + printedValidation.expectedCheckDigit + ' vs ' + printedValidation.actualCheckDigit + ')'}.`,
      evidence: `printed ${struckThroughPrinted} struck through, handwritten ${containerFinal}; check digit of ${containerFinal.slice(0, 10)} is ${validation.expectedCheckDigit}`,
      documents: ['bill_of_lading']
    };
  }

  if (!validation.isValid) {
    return {
      code: 'F05_ERR',
      severity: 'BLOCKER',
      topic: 'invalid container check digit',
      message: `Container number ${containerFinal} fails ISO 6346 check digit. Expected ${validation.expectedCheckDigit}, found ${validation.actualCheckDigit}.`,
      evidence: `container ${containerFinal} check digit mismatch`,
      documents: ['bill_of_lading']
    };
  }

  return null;
}
