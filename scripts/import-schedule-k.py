"""Import the pinned USACE workbook. Requires Python openpyxl; performs no network calls."""
import hashlib
import json
import re
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'server/data/reference/schedule-k'
SOURCE = DEST / 'schedule-k-2026-q2.xlsx'
workbook = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
sheet = workbook['All Current Schedule K Codes']
rows = list(sheet.values)
assert rows[0] == ('Schedule K Code', 'Foreign Port Name', 'Country Code', 'Country Name', 'Update', 'Latitude', 'Longitude', 'Official Port Name/Alias')
ports = {}
for row in rows[1:]:
    code, name, country_code, country, _, _, _, kind = row
    assert re.fullmatch(r'[0-9]{5}', code), row
    assert kind in ('Official', 'Alias'), row
    port = ports.setdefault(code, {'code': code, 'name': '', 'countryCode': country_code, 'country': country, 'aliases': []})
    assert (port['countryCode'], port['country']) == (country_code, country), row
    if kind == 'Official':
        assert not port['name'], row
        port['name'] = name
    else:
        port['aliases'].append(name)
assert all(p['name'] for p in ports.values())
for port in ports.values():
    port['aliases'] = sorted(set(port['aliases']))
data = (json.dumps(sorted(ports.values(), key=lambda p: p['code']), ensure_ascii=False, indent=2) + '\n').encode('utf-8')
(DEST / 'ports.json').write_bytes(data)
manifest_path = DEST / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest.update(sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), checksumSha256=hashlib.sha256(data).hexdigest(), recordCount=len(ports), sourceRowCount=len(rows)-1)
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: manifest[k] for k in ('recordCount', 'sourceRowCount', 'checksumSha256')}))
