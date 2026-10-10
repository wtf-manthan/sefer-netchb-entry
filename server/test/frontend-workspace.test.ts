import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fixture,field} from './fixtures';
import {StructuredFinding} from '@sefer/shared';
import {findingSection,reviewFindingTarget,matchDocument,uniqueFindings,observationSection} from '../../web/src/review-workspace';
import {EvidencePanel} from '../../web/src/components/EvidencePanel';
import {OpenItemsDrawer} from '../../web/src/components/OpenItemsDrawer';
import {ExtractedFieldsView} from '../../web/src/components/ExtractedFieldsView';
const finding=(code:string,entityId:string):StructuredFinding=>({id:code+entityId,code,entityId,severity:'BLOCKER',status:'open',blocking:true,evidence:[],message:'Resolve this test field'});
test('each actionable finding routes to the same section as its field',()=>{
 const {shipment}=fixture();
 for(const [code,id,section,path] of [
  ['RELATED_PARTY','shipment','Parties','customsFiling.relatedParty'],
  ['GROSS_WEIGHT','shipment','Transport','customsFiling.grossWeightKg'],
  ['MISSING_EXPORT_DATE','inv-a','Invoices','invoices.0.exportDate'],
  ['CURRENCY_CONVERSION','inv-a','Invoices','invoiceDecisions.inv-a.exchangeRateToUsd'],
  ['INVALID_CONTAINER','container-1','Transport','containerOverrides.container-1'],
 ]){const f=finding(code,id);assert.equal(findingSection(f,shipment),section);assert.equal(reviewFindingTarget(f,shipment),path);}
 assert.equal(observationSection('invoices.0.seller.name'),'Parties');assert.equal(observationSection('invoices.0.lines.0.quantity'),'Goods');
 assert.equal(findingSection(finding('TRANSPORT_CONFLICT','shipment'),shipment),'Other checks');
});
test('repeated finding ids collapse, but distinct problems remain visible',()=>{
 const a=finding('MISSING_HTS','line-z'),b=finding('REPORTING_QUANTITIES','line-z');assert.equal(uniqueFindings([a,a,b]).length,2);
});
test('PDF matching requires hash when present and refuses ambiguous filenames',()=>{
 const doc={id:'a',name:'invoice.pdf',kind:'invoice' as const,sha256:'hash'};
 const file={name:'invoice.pdf',url:'blob:test',sha256:'wrong'};
 assert.equal(matchDocument(doc,[file]),undefined);assert.equal(matchDocument(doc,[{...file,sha256:'hash'}])?.url,'blob:test');
 const {sha256,...legacy}=doc;assert.equal(matchDocument(legacy,[file,file]),undefined);assert.equal(matchDocument(legacy,[file])?.url,'blob:test');
});
test('saved reviews expose missing PDF explanation and preserve evidence text',()=>{
 const {shipment}=fixture();const html=renderToStaticMarkup(React.createElement(EvidencePanel,{shipment,files:[],selection:{label:'Quantity',source:{doc:'doc-a',page:2,snippet:'10 chairs'}},onAttach:()=>{}}));
 assert.match(html,/10 chairs/);assert.match(html,/PDF preview unavailable/);assert.match(html,/does not run extraction/);assert.doesNotMatch(html,/<iframe/);
});
test('invoice and goods decisions are rendered in separate sections',()=>{
 const {shipment,decisions}=fixture();const props={shipment,originalShipment:shipment,decisions,findings:[],onUpdateDecisions:()=>{}};
 const invoices=renderToStaticMarkup(React.createElement(OpenItemsDrawer,{...props,section:'Invoices'}));
 const goods=renderToStaticMarkup(React.createElement(OpenItemsDrawer,{...props,section:'Goods'}));
 assert.match(invoices,/Country of export/);assert.doesNotMatch(invoices,/Find ten-digit HTS candidates/);
 assert.match(goods,/Find ten-digit HTS candidates/);assert.doesNotMatch(goods,/Country of export/);
});
test('source blockers cannot be dismissed using a verification acknowledgement',()=>{
 const {shipment,decisions}=fixture();const f=finding('MISSING_EXPORT_DATE','inv-a');
 const html=renderToStaticMarkup(React.createElement(ExtractedFieldsView,{shipment,decisions,section:'Invoices',findings:[f],onUpdateDecisions:()=>{}}));
 assert.match(html,/Resolve this test field/);assert.doesNotMatch(html,/Verify against source/);
 shipment.invoices[0].freight=field(0);assert.match(html,/>0<\/p>/);
});
