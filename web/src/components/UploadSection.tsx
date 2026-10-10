import React,{useRef,useState,useEffect} from 'react';
export interface StagedUpload {uploadId:string;expiresAt:string;files:{name:string;size:number}[]}
export function UploadSection({onExtract,onLoadSample,isLoading,demoEnabled,onReset,onSourceFiles,onActivity}:{onExtract:(id:string)=>Promise<boolean>;onLoadSample:()=>void;isLoading:boolean;demoEnabled:boolean;onReset:()=>void;onSourceFiles?:(files:File[])=>Promise<void>;onActivity?:(busy:boolean)=>void}){
  const [files,setFiles]=useState<File[]>([]),[staged,setStaged]=useState<StagedUpload|null>(null);
  const [uploading,setUploading]=useState(false),[progress,setProgress]=useState<number|null>(null),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null),locked=useRef(false);
  const busy=uploading||isLoading;
  useEffect(()=>{onActivity?.(busy);return()=>onActivity?.(false);},[busy,onActivity]);
  async function upload(){
    if(locked.current||!files.length)return;locked.current=true;
    onReset();setUploading(true);setProgress(0);setError('');
    const body=new FormData();files.forEach(f=>body.append('documents',f));
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/uploads');xhr.timeout=120000;
    xhr.upload.onprogress=e=>setProgress(e.lengthComputable?Math.round(100*e.loaded/e.total):null);
    const finish=()=>{locked.current=false;setUploading(false);};
    xhr.onload=()=>{try {const data=JSON.parse(xhr.responseText);if(xhr.status<200||xhr.status>=300)throw new Error(data.error??'Upload failed.');setStaged(data);}catch(e){setError((e as Error).message);}finally{finish();}};
    xhr.onerror=()=>{setError('Upload failed. Check your connection and try again.');finish();};
    xhr.ontimeout=()=>{setError('Upload timed out. Try again.');finish();};
    xhr.send(body);
  }
  async function back(){
    if(!staged||locked.current)return;locked.current=true;setUploading(true);setError('');
    try {const r=await fetch('/api/uploads/'+staged.uploadId,{method:'DELETE'});if(!r.ok)throw new Error('Could not discard the upload. Please try again.');setStaged(null);setFiles([]);setProgress(null);if(input.current)input.current.value='';onReset();}
    catch(e){setError((e as Error).message);}finally{locked.current=false;setUploading(false);}
  }
  async function extract(){if(!staged||locked.current)return;locked.current=true;try{if(await onExtract(staged.uploadId)){await onSourceFiles?.(files);setStaged(null);setFiles([]);if(input.current)input.current.value='';}}finally{locked.current=false;}}
  return <section className="card"><h2>Shipment documents</h2>
    <p>Upload PDFs, check the file list, then choose Extract to start document analysis.</p>
    {!staged&&<><input aria-label="Shipment PDFs" ref={input} type="file" multiple accept=".pdf" disabled={busy} onChange={e=>{setFiles(Array.from(e.target.files??[]));setError('');}}/>
      <ul>{files.map((f,i)=><li key={i}>{f.name} ({Math.ceil(f.size/1024)} KB)</li>)}</ul>
      <button className="btn btn-primary" disabled={busy||!files.length} onClick={upload}>Upload documents</button></>}
    {uploading&&<div role="status"><p>{progress===100?'Upload transferred. Validating documents…':'Uploading documents… '+(progress===null?'':progress+'%')}</p><progress aria-label="Document upload progress" max={100} value={progress??undefined}/></div>}
    {staged&&!isLoading&&<div><h3>Documents uploaded</h3><ul>{staged.files.map((f,i)=><li key={i}>{f.name} ({Math.ceil(f.size/1024)} KB)</li>)}</ul>
      <p>No extraction has started. This upload expires at {new Date(staged.expiresAt).toLocaleTimeString()}.</p>
      <div className="actions"><button className="btn btn-primary" disabled={busy} onClick={extract}>Extract</button><button className="btn btn-secondary" disabled={busy} onClick={back}>Go back</button></div></div>}
    {isLoading&&<div role="status"><p>Extracting document data… This may take a few minutes.</p><progress aria-label="Extracting document data"/></div>}
    {error&&<p role="alert" className="error">{error}</p>}
    {demoEnabled&&<button className="btn btn-secondary" disabled={busy||!!staged} onClick={onLoadSample}>Load unverified demo fixture</button>}
  </section>;
}
