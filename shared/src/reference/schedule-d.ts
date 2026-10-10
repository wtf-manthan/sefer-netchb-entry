import ports from './data/schedule-d.json';
import metadata from './data/schedule-d-manifest.json';
import {computeSha256} from './fingerprint';
export interface ScheduleDPortEntry {code:string;name:string;districtCode:string;districtName:string;state:string;sourceLabel?:string;aliases?:string[]}
export const SCHEDULE_D_METADATA=metadata;
export const SCHEDULE_D_VALID=computeSha256(JSON.stringify(ports,null,2)+'\n')===metadata.checksumSha256 && Object.keys(ports).length===metadata.recordCount;
export const SCHEDULE_D_PORTS:Readonly<Record<string,Readonly<ScheduleDPortEntry>>>=Object.freeze(Object.fromEntries(Object.entries(ports).map(([k,v])=>[k,Object.freeze(v)])));
export function getScheduleDPort(code:string):ScheduleDPortEntry|null {
  if(!SCHEDULE_D_VALID || !/^\d{4}$/.test(code?.trim()))return null;
  const p=SCHEDULE_D_PORTS[code.trim()];return p?{...p}:null;
}
export function listAllScheduleDPorts():ScheduleDPortEntry[]{return SCHEDULE_D_VALID?Object.values(SCHEDULE_D_PORTS).map(p=>({...p})):[];}
export function isScheduleDPortCode(code:string):boolean{return getScheduleDPort(code)!==null;}
export function getScheduleDDistrictPorts(code:string):ScheduleDPortEntry[]{return listAllScheduleDPorts().filter(p=>p.districtCode===code.trim());}
