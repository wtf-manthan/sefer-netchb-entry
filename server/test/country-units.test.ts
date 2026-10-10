import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {COUNTRY_OPTIONS,normalizeCountryCode,isCountryCode,STATISTICAL_UNITS,BrokerDecisionsSchema} from '@sefer/shared';
import {fixture,field} from './fixtures';
import {generateEntry} from '../src/builder/entry-service';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {OpenItemsDrawer} from '../../web/src/components/OpenItemsDrawer';
test('sourced country coverage and conservative name normalization',()=>{
 assert.equal(COUNTRY_OPTIONS.length,249);assert.equal(new Set(COUNTRY_OPTIONS.map(c=>c.alpha2)).size,249);
 for(const [name,code] of [['Brazil','BR'],['Kenya','KE'],['Poland','PL'],['Viet Nam','VN'],['Vietnam','VN'],['USA','US'],['TW','TW']])assert.equal(normalizeCountryCode(name),code);
 for(const name of ['Korea','Congo','Virgin Islands','Atlantis','ZZ','constructor','__proto__'])assert.equal(normalizeCountryCode(name),null);
 assert.equal(isCountryCode('br'),false);
});
test('statistical units exactly match checked-in XSD with source integrity',()=>{
 const xml=readFileSync('spec/data_type.xsd','utf8');
 const block=xml.match(/<xsd:simpleType name="unitOfMeasureType">([\s\S]*?)<\/xsd:simpleType>/)?.[1];assert.ok(block);
 const codes=[...block.matchAll(/<xsd:enumeration value="([^"]+)"/g)].map(m=>m[1]).sort();
 assert.deepEqual(STATISTICAL_UNITS,codes);assert.equal(codes.length,82);
 const data=JSON.parse(readFileSync('shared/src/reference/data/statistical-units.json','utf8'));
 assert.equal(createHash('sha256').update(readFileSync('spec/data_type.xsd')).digest('hex'),data.sourceSha256);
});
test('filing decisions reject unknown countries and schema-invalid statistical units',()=>{
 const {decisions}=fixture();
 for(const code of ['ZZ','zz','Brazil']){decisions.lineDecisions['line-z'].countryOfOrigin=code;assert.equal(BrokerDecisionsSchema.safeParse(decisions).success,false);}
 decisions.lineDecisions['line-z'].countryOfOrigin='BR';
 for(const unit of ['ZZZZ','kg','pieces']){decisions.lineDecisions['line-z'].reportingQuantities=[{quantity:2,unit}];assert.equal(BrokerDecisionsSchema.safeParse(decisions).success,false);}
 decisions.lineDecisions['line-z'].reportingQuantities=[{quantity:2,unit:'KG'}];assert.equal(BrokerDecisionsSchema.safeParse(decisions).success,true);
 decisions.invoiceDecisions['inv-a'].countryOfExport='ZZ';assert.equal(BrokerDecisionsSchema.safeParse(decisions).success,false);
});
test('reviewed country overrides produce schema-valid XML without changing source observations',async()=>{
 const {shipment,decisions}=fixture();shipment.invoices[0].countryOfExport=field('Unknown');shipment.invoices[0].countryOfOrigin=field('Unknown');shipment.invoices[0].lines[0].description=field('Synthetic furniture');
 const original=JSON.stringify(shipment);decisions.invoiceDecisions['inv-a'].countryOfExport='PL';decisions.lineDecisions['line-z'].countryOfOrigin='BR';
 const result=await generateEntry(shipment,decisions);assert.equal(result.schemaValid,true);assert.equal(result.readyToTransmit,true);assert.equal(result.resolved.invoices[0].countryExport,'PL');assert.equal(result.resolved.invoices[0].lines[0].origin,'BR');assert.equal(JSON.stringify(shipment),original);
});
test('review form includes sourced country choices and schema unit selectors',()=>{
 const {shipment,decisions}=fixture();const html=renderToStaticMarkup(React.createElement(OpenItemsDrawer,{shipment,originalShipment:shipment,decisions,findings:[],onUpdateDecisions:()=>{}}));
 assert.match(html,/Country of export/);assert.match(html,/BR.*Brazil/);assert.match(html,/<option[^>]*>KG<\/option>/);assert.match(html,/not automatically converted/);
});

test('country snapshot hashes match provenance manifest',()=>{
 const manifest=JSON.parse(readFileSync('shared/src/reference/data/countries-manifest.json','utf8'));
 for(const [path,expected] of [['shared/src/reference/data/countries.json',manifest.checksumSha256],['server/data/reference/countries/unsd-m49.html',manifest.sourceSha256],['server/data/reference/countries/iana-regions.txt',manifest.supplementSha256]])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),expected);
});
