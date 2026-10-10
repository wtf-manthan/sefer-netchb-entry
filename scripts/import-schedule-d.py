"""Offline import of preserved Census rendered table rows; no guessed aliases/states."""
import hashlib,json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'server/data/reference/schedule-d/census-rendered-rows.txt'
raw=source.read_bytes()
rows=[];districts={}
for line in raw.decode().splitlines():
    m=re.fullmatch(r'L\d+: (.*?)\s*\|\s*(\d{2}|\d{4})\s*\|\s*(DISTRICT|Port)',line)
    assert m,line
    name,code,kind=m.groups()
    if kind=='DISTRICT': districts[code]=name.strip()
    else: rows.append((name.strip(),code))
ports={}
for label,code in rows:
    assert code not in ports
    m=re.fullmatch(r'(.*?)[,.]\s*([A-Z]{2})',label)
    name,state=(m[1].strip(),m[2]) if m and not re.search(r',\s*[A-Z]{2}[-,]',label) else (label,'')
    ports[code]={'code':code,'name':name,'state':state,'districtCode':code[:2],'districtName':districts[code[:2]],'sourceLabel':label}
assert len(ports)>400
ports=dict(sorted(ports.items(),key=lambda item:(0 if str(int(item[0]))==item[0] else 1,item[0])))
data=(json.dumps(ports,indent=2,ensure_ascii=False)+'\n').encode()
dest=root/'shared/src/reference/data';dest.mkdir(exist_ok=True)
(dest/'schedule-d.json').write_bytes(data)
manifest={'publisher':'U.S. Census Bureau','sourceUrl':'https://www.census.gov/foreign-trade/schedules/d/distcode.html','datasetVersion':'census-snapshot-2026-10-10-'+hashlib.sha256(raw).hexdigest()[:12],'retrievedAt':'2026-10-10','recordCount':len(ports),'sourceSha256':hashlib.sha256(raw).hexdigest(),'checksumSha256':hashlib.sha256(data).hexdigest(),'effectiveDateStatus':'UNKNOWN: snapshot date is not an effective date','sourceFormat':'Rendered Census table rows preserved from web retrieval; not raw HTML','licenseStatus':'UNKNOWN: no explicit license captured'}
(dest/'schedule-d-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'ports':len(ports),'checksum':manifest['checksumSha256']}))
