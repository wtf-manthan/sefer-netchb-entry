import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fixture,field} from './fixtures';
import {filingSuggestions,acceptFilingSuggestion,emptyDecisions,RawExtractedShipmentSchema,applyObservationCorrections,BrokerDecisionsSchema} from '@sefer/shared';
import {generateEntry} from '../src/builder/entry-service';
import {OpenItemsDrawer} from '../../web/src/components/OpenItemsDrawer';

test('legacy shipments acquire missing observations without fabricated prefill',()=>{
 const {shipment}=fixture();
 const old=JSON.parse(JSON.stringify(shipment));delete old.bills[0].loadingPort;delete old.bills[0].containerized;delete old.invoices[0].lines[0].manufacturer;
 const parsed=RawExtractedShipmentSchema.parse(old);
 assert.equal(parsed.bills[0].containerized.status,'missing');assert.equal(parsed.bills[0].loadingPort.city.value,null);
 assert.equal(parsed.invoices[0].lines[0].manufacturer.name.value,null);assert.deepEqual(filingSuggestions(parsed),[]);
});
test('roles stay distinct and suggestions require acceptance; name alone cannot settle consignee',async()=>{
 const {shipment}=fixture();shipment.invoices[0].buyer.name=field('Buyer A');shipment.invoices[0].shipTo.name=field('Warehouse B');shipment.bills[0].consignee.name=field('Agent C');
 const suggestions=filingSuggestions(shipment);assert.deepEqual(suggestions.map(s=>s.value),['Buyer A','Warehouse B','Agent C']);
 const empty=emptyDecisions();assert.equal(empty.customsFiling.ultimateConsignee,undefined);
 const choices=acceptFilingSuggestion(empty,suggestions[0]);assert.equal(choices.customsFiling.ultimateConsignee?.name,'Buyer A');assert.equal(empty.customsFiling.ultimateConsignee,undefined);
 const result=await generateEntry(shipment,choices);assert.ok(result.findings.some(f=>f.code==='MISSING_FILING'&&f.entityId==='ultimateConsignee'));
 const html=renderToStaticMarkup(React.createElement(OpenItemsDrawer,{shipment,originalShipment:shipment,decisions:empty,findings:[],onUpdateDecisions:()=>{}}));
 assert.match(html,/Unconfirmed suggestion/);assert.match(html,/Verify and use suggestion/);assert.match(html,/Warehouse B/);
});
test('ocean mode needs explicit consistent containerization; air gets no vessel suggestion',()=>{
 const {shipment}=fixture();shipment.modeOfTransport=field('ocean');
 assert.equal(filingSuggestions(shipment).length,0);shipment.bills[0].containerized=field(true);
 assert.equal(filingSuggestions(shipment)[0].value,'11');shipment.modeOfTransport=field('air');assert.equal(filingSuggestions(shipment).length,0);
 shipment.modeOfTransport=field('ocean');shipment.bills.push({...shipment.bills[0],id:'bill-b',containerized:field(false)});assert.equal(filingSuggestions(shipment).length,0);
});
test('charges and assists depend on explicit observations, never incoterm or other lines',()=>{
 const {shipment}=fixture(),i=shipment.invoices[0],l=i.lines[0];i.incoterms=field('CIF');l.assistAmount=field(100);
 assert.equal(filingSuggestions(shipment).length,0);i.lineChargesIncluded=field(false);l.assistAppliesToLine=field(true);
 i.lines.push({...l,id:'unlinked',assistAppliesToLine:{value:null,status:'missing',source:{doc:null,page:null,snippet:null},confidence:0}});
 const suggestions=filingSuggestions(shipment);assert.equal(suggestions.length,2);assert.equal(suggestions[0].value,'LINE_VALUES_EXCLUDE_CHARGES');assert.equal(suggestions[1].target,'lineDecisions.line-z.assistAmount');
});
test('changed evidence invalidates an accepted suggestion before XML resolution',async()=>{
 const {shipment,decisions}=fixture();shipment.modeOfTransport=field('ocean');shipment.bills[0].containerized=field(true);
 const accepted=acceptFilingSuggestion(decisions,filingSuggestions(shipment)[0]);
 assert.equal((await generateEntry(shipment,accepted)).resolved.mode,'11');
 shipment.bills[0].containerized=field(false);const stale=await generateEntry(shipment,accepted);
 assert.ok(stale.findings.some(f=>f.code==='STALE_SUGGESTION'));assert.notEqual(stale.resolved.mode,'11');assert.equal(stale.readyToTransmit,false);
 accepted.customsFiling.modeOfTransport='10';assert.equal((await generateEntry(shipment,accepted)).resolved.mode,'10');
});
test('incomplete draft omits missing typed values and explains blockers without claiming readiness',async()=>{
 const {shipment}=fixture();const result=await generateEntry(shipment,emptyDecisions());
 assert.equal(result.xml,null);assert.equal(result.readyToTransmit,false);assert.equal(result.draftSchemaValid,false);
 assert.match(result.draftXml!,/DRAFT - NOT READY TO TRANSMIT/);assert.match(result.draftXml!,/Provide importerEin/);
 assert.doesNotMatch(result.draftXml!,/<entry-port>/);assert.doesNotMatch(result.draftXml!,/<value>0\.00<\/value>/);assert.ok(result.draftSchemaErrors.length>0);
});
test('acceptance rejects arbitrary and prototype mutation paths',()=>{
 const {shipment}=fixture();shipment.modeOfTransport=field('ocean');shipment.bills[0].containerized=field(true);const s=filingSuggestions(shipment)[0];
 for(const target of ['customsFiling.__proto__','lineDecisions.constructor.assistAmount','acknowledgements.any'])assert.throws(()=>acceptFilingSuggestion(emptyDecisions(),{...s,target}));
});
test('a local numeric factory identifier cannot silently become a customs MID',async()=>{
 const {shipment,decisions}=fixture();shipment.invoices[0].lines[0].manufacturerId=field('987654321');
 const result=await generateEntry(shipment,decisions);assert.equal(result.resolved.invoices[0].lines[0].mid,null);assert.ok(result.findings.some(f=>f.code==='MISSING_MID'));
 const corrections=BrokerDecisionsSchema.parse({observationCorrections:{'invoices.0.lines.0.manufacturerId':{value:null,source:{doc:'doc-a',page:1,snippet:'Local tax number 987654321'},note:'Not a customs manufacturer identifier'}}}).observationCorrections;
 const corrected=applyObservationCorrections(shipment,corrections);assert.equal(corrected.invoices[0].lines[0].manufacturerId.status,'missing');assert.equal(shipment.invoices[0].lines[0].manufacturerId.value,'987654321');
});
