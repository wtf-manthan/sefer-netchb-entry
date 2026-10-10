import {ScheduleDPortEntry,getScheduleDPort,listAllScheduleDPorts} from './schedule-d';
export type PortRole='processing-port'|'entry-port'|'unlading-port';
export type CamelPortRole='processingPort'|'entryPort'|'unladingPort';
export const SUPPORTED_PORT_ROLES:readonly PortRole[]=['processing-port','entry-port','unlading-port'];
export function normalizePortRole(role?:string|null):PortRole|null {
  const value=role?.toLowerCase().replace(/[_\s-]/g,'').replace(/port$/,'');
  return value==='processing'||value==='entry'||value==='unlading'?`${value}-port`:null;
}
export const isPortRoleSupported=(role?:string|null)=>normalizePortRole(role)!==null;
export const getPortTargetField=(role?:string|null)=>normalizePortRole(role)?`header.${normalizePortRole(role)}`:'header.port';
export const validatePortCodeFormat=(code?:string|null)=>typeof code==='string'&&/^\d{4}$/.test(code.trim());
export const normalizePortSearchText=(s:string)=>s.toLowerCase().replace(/[.,/()'\"-]/g,' ').replace(/\bst\b/g,'saint').replace(/\s+/g,' ').trim();
export interface PortSearchResult {candidates:ScheduleDPortEntry[];matchingMethod:'exact_code'|'normalized_name'|'hierarchical_search'|'fallback_format';isAmbiguous:boolean}
export function searchScheduleDPorts(query:string,options?:{stateHint?:string}):PortSearchResult {
  const empty:PortSearchResult={candidates:[],matchingMethod:'fallback_format',isAmbiguous:false};
  if(!query?.trim())return empty;
  const raw=query.trim(),hint=options?.stateHint?.trim().toUpperCase();
  if(/^\d+$/.test(raw)){
    const p=getScheduleDPort(raw);
    return {candidates:p&&(!hint||p.state===hint)?[p]:[],matchingMethod:'exact_code',isAmbiguous:false};
  }
  const suffix=raw.match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  const states=new Set(listAllScheduleDPorts().map(p=>p.state).filter(Boolean));
  const parsedState=suffix&&states.has(suffix[2].toUpperCase())?suffix[2].toUpperCase():undefined;
  if(hint&&parsedState&&hint!==parsedState)return empty;
  const state=hint??parsedState;
  const q=normalizePortSearchText(parsedState?suffix![1]:raw);
  const eligible=listAllScheduleDPorts().filter(p=>!state||p.state===state);
  const exact=eligible.filter(p=>normalizePortSearchText(p.name)===q||normalizePortSearchText(p.sourceLabel??'')===normalizePortSearchText(raw));
  if(exact.length)return {candidates:exact,matchingMethod:'normalized_name',isAmbiguous:exact.length>1};
  // No IATA/terminal aliases without a separate verified source; never exact from a substring.
  const partial=q.length>=4?eligible.filter(p=>normalizePortSearchText(p.name).includes(q)):[];
  return {candidates:partial,matchingMethod:'hierarchical_search',isAmbiguous:partial.length>0};
}
export const formatPortLabel=(p:ScheduleDPortEntry)=>p.sourceLabel??[p.name,p.state].filter(Boolean).join(', ');
