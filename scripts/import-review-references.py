"""Download UNSD once with --fetch; otherwise regenerate offline country/unit data."""
import sys,json,re,hashlib,urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'server/data/reference/countries';source.mkdir(parents=True,exist_ok=True)
url='https://unstats.un.org/unsd/methodology/m49/overview/'
raw=source/'unsd-m49.html'
if '--fetch' in sys.argv: raw.write_bytes(urllib.request.urlopen(url,timeout=40).read())
iana_url='https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry'
iana=source/'iana-regions.txt'
if '--fetch' in sys.argv:
    registry=urllib.request.urlopen(iana_url,timeout=40).read().decode('utf-8')
    iana.write_bytes(('%%\n'.join(r.strip() for r in registry.split('%%') if r.strip().startswith('Type: region'))+'\n').encode('utf-8'))
class TableParser(HTMLParser):
    def __init__(self):super().__init__();self.rows=[];self.row=[];self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr':self.row=[]
        if tag in ('td','th'):self.cell=''
    def handle_data(self,data):
        if self.cell is not None:self.cell+=data
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:self.row.append(' '.join(self.cell.split()));self.cell=None
        if tag=='tr':self.rows.append(self.row)
p=TableParser();p.feed(raw.read_text(encoding='utf-8-sig'))
countries={}
for row in p.rows:
    # First table is English; retain first record per code, never later translations.
    if len(row)>=12 and re.fullmatch('[A-Z]{2}',row[10]) and re.fullmatch('[A-Z]{3}',row[11]):
        countries.setdefault(row[10],{'alpha2':row[10],'alpha3':row[11],'name':row[8]})
assert len(countries)>240, len(countries)
for record in iana.read_text(encoding='utf-8').split('%%'):
    values={}
    for line in record.splitlines():
        if ': ' in line:
            key,value=line.split(': ',1);values.setdefault(key,[]).append(value)
    code=values.get('Subtag',[''])[0]
    if 'Deprecated' in values:continue
    if code=='TW' and code not in countries:countries[code]={'alpha2':code,'name':values['Description'][0]}
    if code in countries:countries[code]['aliases']=values.get('Description',[])
dest=root/'shared/src/reference/data';dest.mkdir(exist_ok=True)
def write(name,obj):
    data=(json.dumps(obj,indent=2,ensure_ascii=False)+'\n').encode('utf-8');(dest/name).write_bytes(data);return hashlib.sha256(data).hexdigest()
checksum=write('countries.json',sorted(countries.values(),key=lambda c:c['alpha2']))
write('countries-manifest.json',{'publisher':'United Nations Statistics Division; IANA region descriptions','sourceUrl':url,'supplementUrl':iana_url,'retrievedAt':'2026-10-10','datasetVersion':'UNSD-IANA-snapshot-2026-10-10','recordCount':len(countries),'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'supplementSha256':hashlib.sha256(iana.read_bytes()).hexdigest(),'checksumSha256':checksum,'effectiveDateStatus':'UNKNOWN: snapshot date only'})
xsd=root/'spec/data_type.xsd';ns={'x':'http://www.w3.org/2001/XMLSchema'}
units=[e.attrib['value'] for e in ET.fromstring(xsd.read_bytes()).findall("x:simpleType[@name='unitOfMeasureType']/x:restriction/x:enumeration",ns)]
assert len(units)>50 and len(units)==len(set(units))
write('statistical-units.json',{'source':'spec/data_type.xsd#unitOfMeasureType','sourceSha256':hashlib.sha256(xsd.read_bytes()).hexdigest(),'codes':sorted(units)})
print(json.dumps({'countries':len(countries),'statisticalUnits':len(units),'countryChecksum':checksum}))
