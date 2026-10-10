/**
 * XML Schema Validator using xmllint-wasm
 * Preloads entry.xsd and data_type.xsd into virtual file system and runs full libxml2 validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateXML } from 'xmllint-wasm';
import { config } from '../config';

export interface XmlValidationReport {
  valid: boolean;
  errors: string[];
}

export class NetChbXmlValidator {
  private entryXsdContent: string;
  private dataTypeXsdContent: string;

  constructor() {
    const entryXsdPath = path.resolve(config.specDir, 'entry.xsd');
    const dataTypeXsdPath = path.resolve(config.specDir, 'data_type.xsd');

    this.entryXsdContent = fs.readFileSync(entryXsdPath, 'utf8');
    this.dataTypeXsdContent = fs.readFileSync(dataTypeXsdPath, 'utf8');
  }

  public async validate(xmlString: string): Promise<XmlValidationReport> {
    try {
      const result = await validateXML({
        xml: [
          {
            fileName: 'entry.xml',
            contents: xmlString,
          },
        ],
        schema: [
          {
            fileName: 'entry.xsd',
            contents: this.entryXsdContent,
          },
        ],
        preload: [
          {
            fileName: 'data_type.xsd',
            contents: this.dataTypeXsdContent,
          },
        ],
      });

      return {
        valid: result.valid,
        errors: result.errors.map(e => (typeof e === 'string' ? e : e.message || String(e))),
      };
    } catch (err: any) {
      return {
        valid: false,
        errors: [err.message || String(err)],
      };
    }
  }
}
