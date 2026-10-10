import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,field} from './fixtures';
import {resolveShipment} from '../src/checks';
test('commercial unit case/aliases reconcile without changing extracted observations',()=>{
 const {shipment,decisions}=fixture(),inv=shipment.invoices[0],line=inv.lines[0];line.unit=field('PCS');
 shipment.packingLists=[{id:'pack-a',documentId:'doc-a',rows:[{id:'row-a',invoiceId:inv.id,lineId:line.id,style:field('WIDGET'),description:field('Test widget'),quantity:field(8),unit:field('Pcs'),packages:field(1),grossWeightKg:field(100)}]}];
 const before=JSON.stringify(shipment),result=resolveShipment(shipment,decisions);
 assert.equal(result.findings.filter(f=>f.code==='UNIT_CONFLICT').length,0);
 assert.deepEqual(result.findings.find(f=>f.code==='QUANTITY_CONFLICT')?.candidates,{invoiced:10,packed:8});assert.equal(JSON.stringify(shipment),before);
 shipment.packingLists[0].rows[0].unit=field('DOZ');assert.ok(resolveShipment(shipment,decisions).findings.some(f=>f.code==='UNIT_CONFLICT'));
 line.unit=field('unknown');shipment.packingLists[0].rows[0].unit=field('unknown');assert.ok(resolveShipment(shipment,decisions).findings.some(f=>f.code==='UNIT_CONFLICT'));
});
test('country aliases resolve outside extraction; unknown export country blocks instead of guessing',()=>{
 const {shipment,decisions}=fixture(),inv=shipment.invoices[0];inv.countryOfOrigin=field('United States');inv.lines[0].countryOfOrigin=field('US');inv.countryOfExport=field('Vietnam');
 const before=JSON.stringify(shipment),r=resolveShipment(shipment,decisions);assert.equal(r.resolved.invoices[0].countryExport,'VN');assert.equal(r.resolved.invoices[0].lines[0].origin,'US');assert.equal(r.findings.some(f=>f.code==='ORIGIN_CONFLICT'),false);assert.equal(JSON.stringify(shipment),before);
 inv.countryOfExport=field('Atlantis');const invalid=resolveShipment(shipment,decisions);assert.equal(invalid.resolved.invoices[0].countryExport,null);assert.ok(invalid.findings.some(f=>f.code==='MISSING_EXPORT_COUNTRY'));
});
