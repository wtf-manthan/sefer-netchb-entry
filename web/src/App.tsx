import React, {useEffect,useState,useRef} from 'react';
import {RawExtractedShipment,RawExtractedShipmentSchema,BrokerDecisions,BrokerDecisionsSchema,StructuredFinding,emptyDecisions,applyObservationCorrections} from '@sefer/shared';
import {Header} from './components/Header';
import {UploadSection} from './components/UploadSection';
import {ExtractedFieldsView} from './components/ExtractedFieldsView';
import {OpenItemsDrawer} from './components/OpenItemsDrawer';
import {XmlPreviewPanel} from './components/XmlPreviewPanel';
import {EvidencePanel} from './components/EvidencePanel';
import {REVIEW_SECTIONS,ReviewSection,EvidenceSelection,LocalDocument,uniqueFindings,findingSection} from './review-workspace';
interface Result {xml:string|null;draftXml:string|null;draftSchemaValid:boolean;draftSchemaErrors:string[];schemaValid:boolean;schemaErrors:string[];readyToTransmit:boolean;blockersCount:number;findings:StructuredFinding[]}
export default function App(){
  const [retry,setRetry]=useState(0),[uploadBusy,setUploadBusy]=useState(false);
  const [step,setStep]=useState<'upload'|'review'|'export'>('upload');
  const [section,setSection]=useState<ReviewSection>('Shipment');
  const [mobilePane,setMobilePane]=useState<'fields'|'evidence'>('fields');
  const [selection,setSelection]=useState<EvidenceSelection|null>(null);
  const [files,setFiles]=useState<LocalDocument[]>([]);
  const fileRef=useRef<LocalDocument[]>([]),attachmentRun=useRef(0);
  const clearFiles=()=>{attachmentRun.current++;fileRef.current.forEach(f=>URL.revokeObjectURL(f.url));fileRef.current=[];setFiles([]);setSelection(null);};
  useEffect(()=>()=>{attachmentRun.current++;fileRef.current.forEach(f=>URL.revokeObjectURL(f.url));},[]);
  const attach=async(inputs:File[])=>{
    const run=++attachmentRun.current;
    try {
      if(inputs.some(f=>!f.name.toLowerCase().endsWith('.pdf'))||inputs.reduce((sum,f)=>sum+f.size,0)>100*1024*1024)throw new Error('Choose PDFs totaling at most 100 MB.');
      const prepared=await Promise.all(inputs.map(async f=>({file:f,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('')})));
      if(run!==attachmentRun.current)return;
      fileRef.current.forEach(f=>URL.revokeObjectURL(f.url));
      fileRef.current=prepared.map(f=>({name:f.file.name,sha256:f.sha256,url:URL.createObjectURL(f.file)}));setFiles(fileRef.current);
    }catch(e){if(run===attachmentRun.current)setError((e as Error).message);}
  };
  const [shipment,setShipment]=useState<RawExtractedShipment|null>(null);
  const [decisions,setDecisions]=useState<BrokerDecisions>(emptyDecisions);
  const [result,setResult]=useState<Result|null>(null),[error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[building,setBuilding]=useState(false),[demoEnabled,setDemoEnabled]=useState(false);
  const [notice,setNotice]=useState('');
  const [resultKey,setResultKey]=useState(''),[exporting,setExporting]=useState(false);
  const requestKey=JSON.stringify({shipmentData:shipment,brokerDecisions:decisions});
  const latestKey=useRef(requestKey);latestKey.current=requestKey;
  const parsed=BrokerDecisionsSchema.safeParse(decisions);
  const validationIssues=parsed.success?[]:parsed.error.issues.map(i=>({path:i.path.join('.'),message:i.message}));
  const current=resultKey===requestKey&&parsed.success;
  useEffect(()=>{const c=new AbortController();fetch('/api/health',{signal:c.signal}).then(r=>r.json()).then(d=>setDemoEnabled(d.demoEnabled===true)).catch(()=>{});return()=>c.abort();},[]);
  useEffect(()=>{
    if(!shipment)return;
    if(!BrokerDecisionsSchema.safeParse(decisions).success){setBuilding(false);return;}
    const controller=new AbortController();setBuilding(true);setError(null);
    const timer=setTimeout(async()=>{
      try {
        const r=await fetch('/api/entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipmentData:shipment,brokerDecisions:decisions}),signal:controller.signal});
        const data=await r.json();if(!r.ok)throw new Error(data.error+(data.issues?' — '+data.issues.map((i:any)=>i.path.join('.')+': '+i.message).join('; '):''));
        if(!controller.signal.aborted){setResult(data);setResultKey(requestKey);}
      }catch(e){if(!controller.signal.aborted){setError((e as Error).message);setResult(null);}}
      finally{if(!controller.signal.aborted)setBuilding(false);}
    },200);
    return()=>{controller.abort();clearTimeout(timer);};
  },[shipment,decisions,retry]);
  const reset=()=>{clearFiles();setStep('upload');setShipment(null);setDecisions(emptyDecisions());setResult(null);setError(null);setNotice('');};
  const load=async(uploadId?:string):Promise<boolean>=>{
    clearFiles();setBusy(true);setShipment(null);setDecisions(emptyDecisions());setResult(null);setError(null);setNotice('');
    try {
      const r=await fetch(uploadId?'/api/uploads/'+uploadId+'/extract':'/api/demo',{method:'POST'});
      const data=await r.json();if(!r.ok)throw new Error(data.error);
      setNotice(data.notice??'');setShipment(data.extractedData);setStep('review');setSection('Shipment');return true;
    }catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
  };
  const effective=shipment?applyObservationCorrections(shipment,decisions.observationCorrections):null;
  const download=(contents:string,name:string,type:string)=>{const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const exportEntry=async(kind:'ready'|'draft'|'review')=>{
    setExporting(true);setError(null);
    const exportKey=requestKey;
    try {const r=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipmentData:shipment,brokerDecisions:decisions,kind})});const data=await r.json();if(!r.ok)throw new Error(data.error);
      if(latestKey.current!==exportKey)throw new Error('Review changed during export. Check the latest values and export again.');
      download(kind==='review'?JSON.stringify(data.reviewReport,null,2):data.xml,kind==='review'?'shipment-review.json':data.fileName,kind==='review'?'application/json':'application/xml');setNotice('Download prepared. Your review remains available.');
    }catch(e){setError((e as Error).message);}finally{setExporting(false);}
  };
  const restore=async(file?:File)=>{if(!file)return;try{
    if(file.size>5*1024*1024)throw new Error('Review file must be under 5 MB.');
    const saved=JSON.parse(await file.text());if(saved.reviewVersion!==1)throw new Error('Unsupported review file.');
    const s=RawExtractedShipmentSchema.parse(saved.shipmentData),d=BrokerDecisionsSchema.parse(saved.brokerDecisions);applyObservationCorrections(s,d.observationCorrections);
    clearFiles();setStep('review');setSection('Shipment');setResult(null);setShipment(s);setDecisions(d);setNotice('Restored local review. Checks and reference selections are being revalidated.');setError(null);
  }catch{setError('Could not restore this review. Use a valid saved review JSON under 5 MB.');}};
  const findings=uniqueFindings(result?.findings??[]);
  const open=findings.filter(f=>f.status==='open');
  const save=()=>download(JSON.stringify({reviewVersion:1,shipmentData:shipment,brokerDecisions:decisions},null,2),'shipment-review-session.json','application/json');
  return <div className="app-container">
    <Header schemaValid={current?result?.schemaValid??null:null} schemaErrorCount={current?result?.schemaErrors.length??0:0} readyToTransmit={current?result?.readyToTransmit??null:null} blockersCount={result?.blockersCount??0} isProcessing={busy||building}/>
    <main className="main-content">
      <nav className="workflow-nav" aria-label="Shipment workflow">{(['upload','review','export'] as const).map((value,i)=><button key={value} aria-current={step===value?'step':undefined} disabled={busy||uploadBusy||exporting||(value!=='upload'&&!shipment)} onClick={()=>setStep(value)}><span>{i+1}</span>{value==='upload'?'Upload documents':value==='review'?'Review & resolve':'XML export'}</button>)}</nav>
      <div className="session-toolbar"><p>{shipment?`${shipment.documents.length} documents · ${shipment.invoices.length} invoices · ${shipment.invoices.reduce((n,i)=>n+i.lines.length,0)} goods lines`:'Prepare an entry from your shipment documents.'}</p><div className="actions">{shipment&&<button className="btn btn-secondary" disabled={!parsed.success||exporting} onClick={save}>Save review to resume later</button>}<label className="resume-control">Resume review<input type="file" accept=".json" disabled={busy||uploadBusy||exporting} onChange={e=>{void restore(e.target.files?.[0]);e.target.value='';}}/></label></div></div>
      {notice&&<p className="notice" role="status">{notice}</p>}{error&&<p role="alert" className="error notice">{error}</p>}
      {step==='upload'&&<div className="upload-layout"><div><span className="eyebrow">START WITH THE SOURCE</span><h2>Turn shipment documents into a reviewable entry.</h2><p>Upload the invoice, packing list and bill of lading. Review the extracted evidence, resolve missing filing details, then export XML.</p>{shipment&&<p className="notice">Uploading another set replaces the current review. Save it first if you want to return to it.</p>}</div><UploadSection onActivity={setUploadBusy} onReset={reset} onExtract={load} onSourceFiles={attach} onLoadSample={()=>load()} isLoading={busy} demoEnabled={demoEnabled}/></div>}
      {shipment&&step!=='upload'&&<>
        <div className="review-status" role="status" aria-live="polite">{validationIssues.length?`Complete ${validationIssues.length} invalid field values before checks can run.`:!current?(building?'Checking current edits…':'Checks unavailable. Retry to validate this review.'):`${open.length} open checks · ${result?.blockersCount??0} blockers`} {exporting&&'Preparing download…'}{!current&&!building&&!validationIssues.length&&<button className="btn btn-secondary" onClick={()=>setRetry(r=>r+1)}>Retry checks</button>}</div>
        
        {step==='review'?<>
          <nav className="review-nav" aria-label="Review sections">{REVIEW_SECTIONS.map(name=><button key={name} aria-current={section===name?'page':undefined} onClick={()=>{setSection(name);setMobilePane('fields');}}>{name}<span className="count">{open.filter(f=>findingSection(f,shipment??undefined)===name).length}</span></button>)}</nav>
          <div className="mobile-pane-nav"><button aria-pressed={mobilePane==='fields'} onClick={()=>setMobilePane('fields')}>Fields & decisions</button><button aria-pressed={mobilePane==='evidence'} onClick={()=>setMobilePane('evidence')}>Document evidence</button></div>
          <div className={'review-workspace pane-'+mobilePane}>
            <div className="review-fields" key={section}><div className="section-heading"><h2>{section}</h2><span className="count">{open.filter(f=>findingSection(f,shipment??undefined)===section).length} open checks</span></div>
              <OpenItemsDrawer shipment={effective!} originalShipment={shipment} section={section} findings={findings} decisions={decisions} validationIssues={validationIssues} onUpdateDecisions={setDecisions} onViewSource={value=>{setSelection(value);setMobilePane('evidence');}}/>
              {section!=='Other checks'&&<ExtractedFieldsView shipment={shipment} section={section} findings={findings} decisions={decisions} onUpdateDecisions={setDecisions} onViewSource={value=>{setSelection(value);setMobilePane('evidence');}}/>}
              <div className="actions"><button className="btn btn-secondary" disabled={REVIEW_SECTIONS.indexOf(section)===0} onClick={()=>setSection(REVIEW_SECTIONS[REVIEW_SECTIONS.indexOf(section)-1])}>Previous section</button><button className="btn btn-primary" onClick={()=>{const next=REVIEW_SECTIONS[REVIEW_SECTIONS.indexOf(section)+1];next?setSection(next):setStep('export');}}>{section==='Other checks'?'Review export':'Next section'}</button></div>
            </div>
            <EvidencePanel key={selection?.label??'documents'} shipment={shipment} selection={selection} files={files} onAttach={attach}/>
          </div>
        </>:<section className="export-page"><div className="section-heading"><div><span className="eyebrow">REVIEW BEFORE FILING</span><h2>Your entry exports</h2></div><button className="btn btn-secondary" onClick={()=>setStep('review')}>Back to review</button></div>{open.length>0&&<div className="card"><h3>Continue resolving</h3><div className="actions">{REVIEW_SECTIONS.filter(name=>open.some(f=>findingSection(f,shipment??undefined)===name)).map(name=><button className="btn btn-secondary" key={name} onClick={()=>{setSection(name);setStep('review');}}>{name} · {open.filter(f=>findingSection(f,shipment??undefined)===name).length} open</button>)}</div></div>}
          <XmlPreviewPanel xml={current?result?.xml??result?.draftXml??'':''} schemaValid={current?result?.schemaValid??null:null} schemaErrors={current?result?.schemaErrors??[]:[]} readyToTransmit={current&&result?.readyToTransmit===true} blockersCount={result?.blockersCount??0} disabled={!current||exporting} onExport={exportEntry}/>
        </section>}
      </>}
    </main>
  </div>;
}
