import React,{useEffect,useRef,useState} from 'react';
export function HtsLookup({initialQuery,onSelect}:{initialQuery:string;onSelect:(code:string)=>void}){
  const [query,setQuery]=useState(initialQuery),[rows,setRows]=useState<{htsno:string;rawHtsNo:string;description:string;unitsOfQuantity:string[]}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
  const search=async()=>{const id=++generation.current;setBusy(true);setRows([]);setError('');try{
    const r=await fetch('/api/hts/lookup?query='+encodeURIComponent(query));const data=await r.json();if(!r.ok)throw new Error(data.error);if(id===generation.current){setRows(data.candidates);if(!data.candidates.length)setError('No ten-digit candidates returned. Refine the description or enter a reviewed code.');}
  }catch(e){if(id===generation.current)setError((e as Error).message);}finally{if(id===generation.current)setBusy(false);}};
  return <details><summary>Find ten-digit HTS candidates</summary><p>Review material, use, construction, origin and other distinguishing facts. A six-digit heading does not uniquely determine a US classification. No duty rate or quantity conversion is applied.</p>
    <label>Heading or goods description<input value={query} onChange={e=>{generation.current++;setRows([]);setBusy(false);setQuery(e.target.value);}}/></label>
    <button className="btn btn-secondary" disabled={busy||!query.trim()} onClick={search}>{busy?'Searching USITC…':'Search USITC'}</button>{error&&<p role="alert">{error}</p>}
    {rows.map(row=><div className="lookup-candidate" key={row.rawHtsNo}><strong>{row.htsno}</strong><p>{row.description}</p><small>Listed units: {row.unitsOfQuantity.join(', ')||'not supplied; verify hierarchy'}</small><a href={'https://hts.usitc.gov/search?query='+encodeURIComponent(row.htsno)} target="_blank" rel="noreferrer">Review USITC source</a><button className="btn btn-secondary" onClick={()=>onSelect(row.rawHtsNo)}>Use reviewed classification</button></div>)}
  </details>;
}
