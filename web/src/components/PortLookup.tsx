import React,{useEffect,useRef,useState} from 'react';
import {RawExtractedShipment,BrokerDecisions,PortTarget,PortLookupRequest,LookupResult,computeSha256,applyObservationCorrections} from '@sefer/shared';
export function PortLookup({target,shipment,decisions,onChange}:{target:PortTarget;shipment:RawExtractedShipment;decisions:BrokerDecisions;onChange:(d:BrokerDecisions)=>void}){
  const [query,setQuery]=useState(''),[hint,setHint]=useState(''),[lookup,setLookup]=useState<{request:PortLookupRequest;result:LookupResult;evidenceFingerprint:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0);
  const effective=applyObservationCorrections(shipment,decisions.observationCorrections);
  const location=effective.bills.length===1?(target==='foreignPortCode'?effective.bills[0].loadingPort:target==='unladingPortCode'?effective.bills[0].dischargePort:null):null;
  const observed=location?(location.city.value!==null?location.city:location.name):null;

  const evidence=computeSha256(JSON.stringify(applyObservationCorrections(shipment,decisions.observationCorrections)));
  useEffect(()=>{generation.current++;setLookup(null);setBusy(false);},[evidence]);
  useEffect(()=>()=>{generation.current++;},[]);
  const search=async()=>{const id=++generation.current;setBusy(true);setError('');setLookup(null);
    try {const request={target,query,...(hint.trim()?target==='foreignPortCode'?{country:hint.trim()}:{stateHint:hint.trim().toUpperCase()}: {})};
      const r=await fetch('/api/reference/port',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipmentData:shipment,brokerDecisions:decisions,request})});
      const data=await r.json();if(!r.ok)throw new Error(data.error??'Reference lookup is unavailable.');if(id===generation.current)setLookup(data);
    }catch(e){if(id===generation.current)setError((e as Error).message);}finally{if(id===generation.current)setBusy(false);}
  };
  useEffect(()=>{
    if(!observed?.value)return;
    const suggested=observed.value,id=++generation.current;
    setQuery(suggested);setHint('');setBusy(true);setError('');setLookup(null);
    const controller=new AbortController();
    const request:PortLookupRequest={target,query:suggested};
    fetch('/api/reference/port',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipmentData:shipment,brokerDecisions:decisions,request}),signal:controller.signal})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??'Port suggestions unavailable.');if(id===generation.current)setLookup(data);})
      .catch(e=>{if(!controller.signal.aborted&&id===generation.current)setError(e.message);})
      .finally(()=>{if(id===generation.current)setBusy(false);});
    return()=>controller.abort();
  },[evidence,target]);
  const changeQuery=(value:string,isHint=false)=>{generation.current++;setBusy(false);setLookup(null);isHint?setHint(value):setQuery(value);};
  return <details open={!!observed?.value}><summary>Look up official port code</summary>{observed?.value&&<p className="lookup-inference">Unconfirmed document location: {observed.value}. {location?.name.value!==observed.value?"City-level lookup; original port: "+location?.name.value:""} Verify country and port role. <small>{observed.source.snippet}</small></p>}<p>Enter the port name from your document and check that it matches this field's role before accepting a code.</p>
    <label>Port name or code<input value={query} onChange={e=>changeQuery(e.target.value)}/></label>
    <label>{target==='foreignPortCode'?'Country name (optional)':'State abbreviation (optional)'}<input value={hint} onChange={e=>changeQuery(e.target.value,true)}/></label>
    <button className="btn btn-secondary" disabled={busy||!query.trim()} onClick={search}>{busy?'Looking up…':'Find ports'}</button>
    {error&&<p role="alert" className="error">{error}</p>}
    {lookup&&<div><p>{lookup.result.rationale}</p><small><a href={lookup.result.source.url} target="_blank" rel="noreferrer">Reference source</a> · {lookup.result.source.datasetVersion}</small>
      {lookup.result.candidates.map(c=><div className="lookup-candidate" key={c.code}><strong>{c.code} — {c.label}</strong><p>Inferred suggestion — verify against shipment documents.</p>
        <button className="btn btn-secondary" disabled={lookup.evidenceFingerprint!==evidence} onClick={()=>onChange({...decisions,customsFiling:{...decisions.customsFiling,[target]:c.code,referenceDataConfirmed:false},portSelections:{...decisions.portSelections,[target]:{request:lookup.request,candidateCode:c.code,evidenceFingerprint:lookup.evidenceFingerprint,lookupFingerprint:lookup.result.fingerprint}}})}>Verify and use {c.code}</button></div>)}
    </div>}
    {decisions.portSelections[target]&&<small>Reference selection recorded. It will be rechecked on generation and export.</small>}
  </details>;
}
