import React,{useState} from 'react';
import {RawExtractedShipment,BrokerDecisions,BrokerDecisionsSchema,applyObservationCorrections,StructuredFinding,findingTarget} from '@sefer/shared';
import {ReviewSection,observationSection,observationLabel,EvidenceSelection,reviewFindingTarget} from '../review-workspace';
export function ExtractedFieldsView({shipment,decisions,onUpdateDecisions,findings=[],section,onViewSource}:{shipment:RawExtractedShipment;decisions:BrokerDecisions;onUpdateDecisions:(d:BrokerDecisions)=>void;findings?:StructuredFinding[];section?:ReviewSection;onViewSource?:(selection:EvidenceSelection)=>void}){
  const [editing,setEditing]=useState<string|null>(null);
  const rows:{path:string;field:any}[]=[];
  function walk(value:any,path:string){if(!value||typeof value!=='object')return;if('status' in value&&'source' in value){rows.push({path,field:value});return;}Object.entries(value).forEach(([key,v])=>walk(v,path?path+'.'+key:key));}
  walk(shipment,'');
  function save(path:string,correction:BrokerDecisions['observationCorrections'][string]|undefined){
    const corrections={...decisions.observationCorrections};if(correction)corrections[path]=correction;else delete corrections[path];
    const validated=BrokerDecisionsSchema.parse({observationCorrections:corrections}).observationCorrections;
    const next={...decisions,observationCorrections:validated,acknowledgements:{},customsFiling:{...decisions.customsFiling,referenceDataConfirmed:false}};
    applyObservationCorrections(shipment,next.observationCorrections);onUpdateDecisions(next);setEditing(null);
  }
  const visible=rows.filter(r=>!section||observationSection(r.path)===section);
  const [filter,setFilter]=useState('');
  const sourceChecks=findings.filter(f=>f.status==='open'&&visible.some(r=>reviewFindingTarget(f,shipment)===r.path)).length;
  return <details className="observations" open={sourceChecks>0}><summary>Document observations ({visible.length} fields) <span className="count">{sourceChecks} open checks</span></summary><div className="section-heading"><div><h2>Document observations</h2><p>Review the source before verifying. Corrections preserve the original value.</p></div><label>Find a field<input type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Description, quantity, country…"/></label></div>
    <div className="observation-list">{visible.filter(r=>(observationLabel(r.path,shipment)+' '+String(r.field.value??'')).toLowerCase().includes(filter.toLowerCase())).map(({path,field:f})=>{
      const c=decisions.observationCorrections[path],source=c?.source??f.source;
      const checks=findings.filter(x=>reviewFindingTarget(x,shipment)===path),open=checks.filter(x=>x.status==='open');
      const value=c?c.value:f.value,label=observationLabel(path,shipment);
      const status=c?'Corrected':open.length?(open.some(x=>x.severity!=='VERIFY')?'Needs resolution':'Needs verification'):checks.length?'Verified':f.status==='inferred'?'Inferred':f.status==='missing'?'Missing':'Extracted';
      return <article key={path} className={'observation '+((f.status==='inferred'||open.length)&&!c?'inferred-field':'')}>
        <div className="field-heading"><h3>{label}</h3><span className={'tag tag-'+(status==='Verified'?'extracted':open.length?'inferred':f.status)}>{status}</span></div>
        <p className="field-value">{value===null?'Not provided':Array.isArray(value)?value.join('; '):String(value)}</p>
        {c&&<small>Original: {JSON.stringify(f.value)} · Correction reason: {c.note}</small>}
        {open.map(x=><div key={x.id}><p className="field-issue">{x.code==='EVIDENCE_REVIEW'&&x.message.startsWith('Review ' + path)?'Compare this value with its source, then verify or correct it.':x.message}</p>{x.severity==='VERIFY'&&<button className="btn btn-secondary" onClick={()=>onUpdateDecisions({...decisions,acknowledgements:{...decisions.acknowledgements,[x.id]:'Reviewed against the displayed source evidence.'}})}>Verify against source</button>}</div>)}
        <small>{shipment.documents.find(d=>d.id===source.doc)?.name??'No source'}{source.page?' · Page '+source.page:''}</small>
        <div className="actions"><button className="btn btn-secondary" onClick={()=>onViewSource?.({label,source})}>View source</button><button className="btn btn-secondary" onClick={()=>setEditing(editing===path?null:path)}>Correct field</button>{c&&<button className="btn btn-secondary" onClick={()=>save(path,undefined)}>Restore original</button>}</div>
        {editing===path&&<CorrectionEditor key={path} path={path} field={f} correction={c} shipment={shipment} onSave={v=>save(path,v)} onCancel={()=>setEditing(null)}/>}
      </article>;
    })}</div>{visible.length===0&&<p className="empty-state">No source observations in this section. Review the filing decisions below.</p>}
  </details>;
}
function CorrectionEditor({path,field,correction,shipment,onSave,onCancel}:{path:string;field:any;correction:BrokerDecisions['observationCorrections'][string]|undefined;shipment:RawExtractedShipment;onSave:(v:BrokerDecisions['observationCorrections'][string])=>void;onCancel:()=>void}){
  const key=path.split('.').at(-1)!;
  const numeric=['quantity','unitPrice','amountAsPrinted','customsValue','assistAmount','totalAmount','freight','insurance','packages','grossWeightKg'].includes(key);
  const boolean=['foc','containerized','assistAppliesToLine','lineChargesIncluded'].includes(key);
  const current=correction?correction.value:field.value;
  const [markMissing,setMarkMissing]=useState(correction?.value===null);
  const [value,setValue]=useState(current===null?'':Array.isArray(current)?current.join('\n'):String(current));
  const source=correction?.source??field.source;
  const [doc,setDoc]=useState(source.doc??''),[page,setPage]=useState(String(source.page??'')),[snippet,setSnippet]=useState(source.snippet??''),[note,setNote]=useState(correction?.note??''),[error,setError]=useState('');
  const submit=()=>{try{if(!markMissing&&!value.trim())throw new Error('Provide a value.');onSave({value:markMissing?null:numeric?Number(value):boolean?value==='true':key==='remarks'?value.split('\n'):value,source:{doc,page:Number(page),snippet},note});}catch{setError('Check the value type, document, positive page number, evidence text and a reason of at least 3 characters.');}};
  return <div className="correction-editor"><label className="check-label"><input type="checkbox" checked={markMissing} onChange={e=>setMarkMissing(e.target.checked)}/> Mark as missing or unsupported by the document</label><label>Corrected value{boolean?<select value={value} onChange={e=>setValue(e.target.value)}><option value="">Choose</option><option value="true">Yes</option><option value="false">No</option></select>:<textarea value={value} onChange={e=>setValue(e.target.value)} placeholder={key==='remarks'?'One remark per line':numeric?'Number':'Text'}/>}</label>
    <label>Source document<select value={doc} onChange={e=>setDoc(e.target.value)}><option value="">Choose document</option>{shipment.documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Page<input type="number" min="1" value={page} onChange={e=>setPage(e.target.value)}/></label><label>Supporting text<textarea value={snippet} onChange={e=>setSnippet(e.target.value)}/></label>
    <label>Reason for correction<input value={note} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}
    <div className="actions"><button className="btn btn-primary" onClick={submit}>Save correction</button><button className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
  </div>;
}
