import React,{useState} from 'react';
import {RawExtractedShipment} from '@sefer/shared';
import {EvidenceSelection,LocalDocument,matchDocument} from '../review-workspace';
export function EvidencePanel({shipment,selection,files,onAttach}:{shipment:RawExtractedShipment;selection:EvidenceSelection|null;files:LocalDocument[];onAttach:(files:File[])=>void}){
 const [manualDoc,setManualDoc]=useState('');const [page,setPage]=useState(1);
 const docId=manualDoc||selection?.source.doc||shipment.documents[0]?.id;
 const doc=shipment.documents.find(d=>d.id===docId);const local=doc?matchDocument(doc,files):undefined;
 const shownPage=manualDoc?page:selection?.source.page??1;
 return <aside className="evidence-panel card" aria-label="Document evidence">
   <div><span className="eyebrow">SOURCE EVIDENCE</span><h2>{selection?.label??'Your shipment documents'}</h2><p>Select “View source” on a field to inspect its evidence.</p></div>
   {selection&&<blockquote><strong>Extracted supporting text</strong><p>{selection.source.snippet||'No supporting snippet was recorded.'}</p><small>{shipment.documents.find(d=>d.id===selection.source.doc)?.name??'Source document not recorded'} · {selection.source.page?'Page '+selection.source.page:'Page unknown'}</small></blockquote>}
   <label>Document<select value={docId??''} onChange={e=>{setManualDoc(e.target.value);setPage(1);}}>{shipment.documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <label>PDF page<input type="number" min={1} step={1} value={shownPage} onChange={e=>{setManualDoc(docId);setPage(Math.max(1,Math.floor(Number(e.target.value)||1)));}}/></label>
   {local?<><small>{doc?.sha256?'File hash matches the extraction.':'Matched by unique filename; compare the document contents.'} Page navigation depends on your browser PDF viewer.</small><a href={local.url+'#page='+shownPage} target="_blank" rel="noreferrer">Open PDF in a new tab</a><iframe key={local.url+shownPage} title={'Source PDF: '+doc?.name} src={local.url+'#page='+shownPage} /></>:<div className="empty-state"><h3>PDF preview unavailable</h3><p>{files.length>0?'No attached PDF uniquely matches this document. Reattach the original file. ':''}Saved reviews contain values and decisions, not PDFs. Attach the original documents to view them here. This does not run extraction.</p></div>}
   <label className="attach-files">Attach original PDFs<input type="file" accept=".pdf" multiple onChange={e=>{onAttach(Array.from(e.target.files??[]));e.target.value='';}}/></label>
 </aside>;
}
