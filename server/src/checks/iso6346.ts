const values: Record<string,number> = {A:10,B:12,C:13,D:14,E:15,F:16,G:17,H:18,I:19,J:20,K:21,L:23,M:24,N:25,O:26,P:27,Q:28,R:29,S:30,T:31,U:32,V:34,W:35,X:36,Y:37,Z:38};
export function calculateIso6346CheckDigit(prefix: string): number | null {
  const p=prefix.replace(/[\s-]/g,'').toUpperCase();
  if(!/^[A-Z]{3}[UJZ]\d{6}$/.test(p))return null;
  return p.split('').reduce((sum,c,i)=>sum+(values[c]??Number(c))*2**i,0)%11%10;
}
export function validateContainerNumber(value:string) {
  const normalized=value.replace(/[\s-]/g,'').toUpperCase();
  const expectedCheckDigit=calculateIso6346CheckDigit(normalized.slice(0,10));
  return {normalized,expectedCheckDigit,isValid:/^[A-Z]{3}[UJZ]\d{7}$/.test(normalized)&&expectedCheckDigit!==null&&Number(normalized[10])===expectedCheckDigit};
}
