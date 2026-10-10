/**
 * End-to-End Test for USITC HTS Lookup (Task T6)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { lookupHts6 } from './lookup';

describe('T6 Code Lists & HTS: USITC Lookup End-to-End', () => {
  it('expands 6-digit HS 6109.10 to candidate 10-digit HTS codes with units and duty rates', async () => {
    const result = await lookupHts6('6109.10');

    console.log(`Lookup result for HS 6109.10:`);
    console.log(`- Base Heading: ${result.baseHeading} (${result.headingDescription})`);
    console.log(`- General Duty Rate: ${result.generalDutyRate}`);
    console.log(`- Total 10-digit candidates: ${result.candidates.length}`);

    // Verify heading data
    assert.strictEqual(result.hs6, '6109.10');
    assert.strictEqual(result.baseHeading, '6109.10.00');
    assert.strictEqual(result.generalDutyRate, '16.5%');

    // Verify candidate list
    assert.ok(result.candidates.length > 0, 'Candidates array should not be empty');

    // Inspect first candidate: 6109.10.00.04 (All white t-shirts)
    const whiteTee = result.candidates.find(c => c.htsno.includes('6109.10.00.04'));
    assert.ok(whiteTee, 'Should contain candidate 6109.10.00.04');
    assert.ok(whiteTee?.description.includes('T-shirts, all white'));
    assert.ok(whiteTee?.unitsOfQuantity.includes('doz.'));
    assert.ok(whiteTee?.unitsOfQuantity.includes('kg'));

    // Inspect Men's candidate: 6109.10.00.12
    const mensTee = result.candidates.find(c => c.htsno.includes('6109.10.00.12'));
    assert.ok(mensTee, 'Should contain candidate 6109.10.00.12');
    assert.ok(mensTee?.description.includes("Men's"));

    // Verify that every candidate has non-empty 10-digit raw number
    for (const candidate of result.candidates) {
      assert.strictEqual(candidate.rawHtsNo.length, 10);
      assert.ok(candidate.unitsOfQuantity.length > 0);
    }
  });
});
