export interface HtsCandidate {htsno:string;rawHtsNo:string;description:string;generalDutyRate:string|null;specialDutyRate:string|null;unitsOfQuantity:string[]}
const cache=new Map<string,{created:number;value:{query:string;source:string;retrievedAt:string;candidates:HtsCandidate[]}}>();
export async function lookupHtsCode(query:string) {
  const key=query.trim();if(!key||key.length>100)throw new Error('Invalid query');
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.created<3600000)return {...cached.value,cached:true};
  const source='https://hts.usitc.gov/reststop/search?keyword='+encodeURIComponent(key);
  const res=await fetch(source,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error('HTS lookup failed');
  const data:unknown=await res.json();
  if(!Array.isArray(data))throw new Error('Invalid lookup response');
  const candidates:HtsCandidate[]=[];
  for(const row of data) {
    if(!row||typeof row.htsno!=='string')throw new Error('Invalid HTS row');
    const rawHtsNo=row.htsno.replace(/[.\s]/g,'');
    if(!/^\d{10}$/.test(rawHtsNo))continue;
    if(typeof row.description!=='string')throw new Error('Invalid HTS description');
    candidates.push({htsno:row.htsno,rawHtsNo,description:row.description,
      generalDutyRate:typeof row.general==='string'&&row.general?row.general:null,
      specialDutyRate:typeof row.special==='string'&&row.special?row.special:null,
      unitsOfQuantity:Array.isArray(row.units)&&row.units.every((u:unknown)=>typeof u==='string')?row.units:[]});
  }
  // Preserve absent rates. Do not guess inheritance from unrelated search headings.
  const value={query:key,source,retrievedAt:new Date().toISOString(),candidates};
  if(cache.size>=100)cache.delete(cache.keys().next().value!);
  cache.set(key,{created:Date.now(),value});
  return {...value,cached:false};
}
