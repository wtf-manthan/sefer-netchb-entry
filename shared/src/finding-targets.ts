import {StructuredFinding} from './types/findings';
/** One display location per finding. Unmapped checks stay in the general checklist. */
export function findingTarget(f:StructuredFinding):string|undefined {
  if(f.code==='EVIDENCE_REVIEW')return f.entityId?.replace(/^shipment\./,'');
  if(f.code==='MISSING_FILING'||f.code==='STALE_PORT_SELECTION')return 'customsFiling.'+f.entityId;
  const filing:Record<string,string>={UNSUPPORTED_MODE:'modeOfTransport',UNSUPPORTED_ENTRY:'entryType',RELATED_PARTY:'relatedParty',REFERENCE_REVIEW:'referenceDataConfirmed'};
  if(filing[f.code])return 'customsFiling.'+filing[f.code];
  const line:Record<string,string>={MISSING_HTS:'htsCode',MISSING_MID:'manufacturerId',MISSING_ORIGIN:'countryOfOrigin',ORIGIN_CONFLICT:'countryOfOrigin',REPORTING_QUANTITIES:'reportingQuantities',VALUE_CHOICE:'mathChoice',QUANTITY_CONFLICT:'quantityChoice',SAMPLE_VALUE:'sampleValue',ASSIST_VALUE:'assistAmount'};
  if(f.lineId&&line[f.code])return `lineDecisions.${f.lineId}.${line[f.code]}`;
  if(f.invoiceId&&f.code==='VALUATION_BASIS')return `invoiceDecisions.${f.invoiceId}.valuationBasis`;
  if(f.code==='MISSING_EXPORT_COUNTRY')return `invoiceDecisions.${f.invoiceId??f.entityId}.countryOfExport`;
  return undefined;
}
