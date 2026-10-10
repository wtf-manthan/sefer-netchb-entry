// Decimal multiplication rounded half up to integer cents, without binary float intermediates.
export function cents(...values: number[]): number {
  let numerator=1n, scale=0;
  for(const value of values) {
    if(!Number.isFinite(value)||value<0)throw new Error('Invalid nonnegative amount');
    const [coefficient,exponent='0']=value.toString().toLowerCase().split('e');
    const parts=coefficient.split('.');
    numerator*=BigInt(parts.join('')); scale+=(parts[1]?.length??0)-Number(exponent);
  }
  const denominator=10n**BigInt(Math.max(0,scale));
  numerator*=100n*10n**BigInt(Math.max(0,-scale));
  const result=(numerator+denominator/2n)/denominator;
  if(result>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Amount exceeds safe accounting range');
  return Number(result);
}
export function allocateCents(total:number,weights:number[]):number[] {
  const sum=weights.reduce((a,b)=>a+b,0);
  if(!Number.isSafeInteger(sum)||sum<=0)throw new Error('Cannot allocate charges across zero values');
  const allocations=weights.map(w=>Number(BigInt(total)*BigInt(w)/BigInt(sum)));
  const order=weights.map((w,i)=>({i,r:BigInt(total)*BigInt(w)%BigInt(sum)})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);
  const remainder=total-allocations.reduce((a,b)=>a+b,0);
  for(let i=0;i<remainder;i++)allocations[order[i].i]++;
  return allocations;
}
