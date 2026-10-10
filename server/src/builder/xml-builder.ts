import { ResolvedEntry } from '../checks';
function escapeXml(value:string|number) {
  const s=String(value);
  if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(s))throw new Error('Invalid XML character');
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function tag(name:string,value:string|number|null|undefined):string {
  return value==null?'':'<'+name+'>'+escapeXml(value)+'</'+name+'>';
}
// Only accepts the resolved model. No defaults, lookup calls, or decision logic here.
export function serializeResolvedEntry(e:ResolvedEntry,incomplete=false):string|null {
  const f=e.filing;
  if(!incomplete&&(!f.processingPortCode||!f.entryPortCode||!f.entryDate||!f.entryType||
    e.invoices.some(i=>!i.invoiceNo||i.lines.some(l=>!l.origin||!l.hts||l.valueCents===null))||
    e.bills.some(b=>b.packages===null||b.unit===null)))return null;
  const first=e.bills[0];
  const header=[
    tag('processing-port',f.processingPortCode),tag('entry-port',f.entryPortCode),tag('entry-date',f.entryDate),
    tag('entry-type',f.entryType),tag('bond-type',f.bondType),tag('surety-code',f.suretyCode),
    tag('gross-weight',e.grossWeightKg===null?null:Math.round(e.grossWeightKg)),
    tag('charges',e.chargesCents===null?null:Math.round(e.chargesCents/100)),tag('importer-tax-id',f.importerEin),
    f.ultimateConsignee?'<ultimate-consignee>'+tag('tax-id',f.ultimateConsignee.taxId)+tag('consignee-name',f.ultimateConsignee.name)+'</ultimate-consignee>':'',
    tag('mode-transportation',e.mode),tag('unlading-port',f.unladingPortCode),tag('vessel-name',first?.vessel),tag('voyage-no',first?.voyage),
  ].join('');
  const manifest=e.bills.map(b=>'<bill-of-lading>'+tag('master-scac',b.masterScac)+tag('master-bill',b.masterBill)+tag('house-scac',b.houseScac)+tag('house-bill',b.houseBill)+tag('quantity',b.packages)+tag('unit',b.unit)+'</bill-of-lading>').join('');
  const containers=e.containers.length?'<containers>'+e.containers.map(c=>'<container>'+tag('container-number',c.number)+tag('seal-numbers',c.seal)+'</container>').join('')+'</containers>':'';
  const invoices=e.invoices.map(i=>'<invoice>'+tag('invoice-no',i.invoiceNo)+'<line-items>'+i.lines.map(l=>{
    const quantities=l.reporting.map((q,n)=>tag('quantity'+(n+1),q.quantity)+tag('unit-of-measure'+(n+1),q.unit)).join('');
    return '<line-item>'+tag('country-origin',l.origin)+tag('manufacturer-id',l.mid)+tag('country-export',i.countryExport)+tag('export-date',i.exportDate)+tag('lading-port',f.foreignPortCode)+tag('related-party',f.relatedParty===undefined?null:f.relatedParty?'Y':'N')+tag('invoice-quantity',l.quantity)+'<tariffs><tariff>'+tag('tariff-no',l.hts)+tag('value',l.valueCents===null?null:(l.valueCents/100).toFixed(2))+quantities+'</tariff></tariffs></line-item>';
  }).join('')+'</line-items></invoice>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<entry xmlns="http://www.netchb.com/xml/entry"><entry-no><system-generated/></entry-no><header>'+header+'</header><manifest>'+manifest+'</manifest>'+containers+'<invoices>'+invoices+'</invoices></entry>';
}
