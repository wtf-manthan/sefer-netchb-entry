import fs from 'node:fs';
import path from 'node:path';
import { validateXML } from 'xmllint-wasm';

interface TestResult {
  fixture: string;
  expected: 'VALID' | 'INVALID';
  valid: boolean;
  errors: string[];
  rawError?: string;
}

async function runValidationExperiment() {
  console.log('===============================================================');
  console.log('Task T2: XSD Validation Harness Experiment');
  console.log('Validator: xmllint-wasm (compiled libxml2 v2.13 via WebAssembly)');
  console.log('===============================================================\n');

  const specDir = path.resolve(process.cwd(), 'spec');
  const entryXsdPath = path.join(specDir, 'entry.xsd');
  const dataTypeXsdPath = path.join(specDir, 'data_type.xsd');

  const entryXsdContent = fs.readFileSync(entryXsdPath, 'utf8');
  const dataTypeXsdContent = fs.readFileSync(dataTypeXsdPath, 'utf8');

  const fixturesDir = path.resolve(process.cwd(), 'experiments/xsd-validation/fixtures');
  const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.xml')).sort();

  const results: TestResult[] = [];

  for (const file of fixtureFiles) {
    const fixturePath = path.join(fixturesDir, file);
    const xmlContent = fs.readFileSync(fixturePath, 'utf8');
    const expected = file.startsWith('00-valid') ? 'VALID' : 'INVALID';

    try {
      const validationResult = await validateXML({
        xml: [{
          fileName: file,
          contents: xmlContent,
        }],
        schema: [{
          fileName: 'entry.xsd',
          contents: entryXsdContent,
        }],
        preload: [{
          fileName: 'data_type.xsd',
          contents: dataTypeXsdContent,
        }],
      });

      const outcome = validationResult.valid ? 'VALID' : 'INVALID';
      const isPass = outcome === expected;
      if (!isPass) process.exitCode = 1;

      results.push({
        fixture: file,
        expected,
        valid: validationResult.valid,
        errors: validationResult.errors.map(e => e.message || String(e)),
        rawError: validationResult.rawOutput,
      });

      console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${file}`);
      console.log(`  Expected: ${expected} | Result: ${outcome}`);
      if (!validationResult.valid) {
        console.log(`  Errors detected:`);
        if (validationResult.errors && validationResult.errors.length > 0) {
          for (const err of validationResult.errors) {
            console.log(`    → Line ${err.line || '?'}: ${err.message}`);
          }
        } else if (validationResult.rawError) {
          console.log(`    → ${validationResult.rawError.trim()}`);
        }
      }
      console.log('');
    } catch (err: any) {
      process.exitCode = 1;
      console.error(`[ERROR] Execution failed for ${file}:`, err.message);
    }
  }

  // Summary Table
  console.log('---------------------------------------------------------------');
  console.log('Summary of Test Results:');
  console.log('---------------------------------------------------------------');
  for (const r of results) {
    const pass = (r.valid ? 'VALID' : 'INVALID') === r.expected;
    console.log(`${r.fixture.padEnd(45)} | Expected: ${r.expected.padEnd(7)} | Caught: ${(r.valid ? 'VALID' : 'INVALID').padEnd(7)} | ${pass ? 'CORRECT' : 'FAILED'}`);
  }
}

runValidationExperiment().catch(err => { console.error(err); process.exitCode = 1; });
