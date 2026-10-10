import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fixture,field} from './fixtures';
import {OpenItemsDrawer} from '../../web/src/components/OpenItemsDrawer';
import {ExtractedFieldsView} from '../../web/src/components/ExtractedFieldsView';
import {XmlPreviewPanel} from '../../web/src/components/XmlPreviewPanel';
import {StructuredFinding} from '@sefer/shared';
test('field issue appears once, values are populated and port/HTS actions are exposed',()=>{
  const {shipment,decisions}=fixture();const finding:StructuredFinding={id:'hts',code:'MISSING_HTS',lineId:'line-z',severity:'BLOCKER',status:'open',blocking:true,message:'Unique classification problem',evidence:[]};
  const html=renderToStaticMarkup(React.createElement(OpenItemsDrawer,{shipment,originalShipment:shipment,decisions,findings:[finding],onUpdateDecisions:()=>{}}));
  assert.equal(html.split('Unique classification problem').length-1,1);
  assert.match(html,/value="1234567890"/);assert.match(html,/Look up official port code/);assert.match(html,/Find ten-digit HTS candidates/);
});
test('inferred observation is visibly labelled and has explicit source verification',()=>{
  const {shipment,decisions}=fixture();shipment.modeOfTransport={...field('ocean'),status:'inferred'};
  const finding:StructuredFinding={id:'mode-review',code:'EVIDENCE_REVIEW',entityId:'shipment.modeOfTransport',severity:'VERIFY',status:'open',blocking:true,message:'Review mode evidence',evidence:[]};
  const html=renderToStaticMarkup(React.createElement(ExtractedFieldsView,{shipment,decisions,findings:[finding],onUpdateDecisions:()=>{}}));
  assert.match(html,/inferred-field/);assert.match(html,/Verify against source/);assert.match(html,/Review mode evidence/);
});
test('checked export is disabled with blockers while report and draft remain distinct',()=>{
  const html=renderToStaticMarkup(React.createElement(XmlPreviewPanel,{xml:'<draft/>',schemaValid:true,schemaErrors:[],readyToTransmit:false,blockersCount:2,disabled:false,onExport:()=>{}}));
  assert.match(html,/<button[^>]*disabled=""[^>]*>Download checked XML/);assert.match(html,/Download draft/);assert.match(html,/Download open-items report/);assert.match(html,/2 open blockers/);
});
