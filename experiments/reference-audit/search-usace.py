import urllib.request,json
from pathlib import Path
url='https://ndclibrary.sec.usace.army.mil/api/keywordsearchpub?term=Schedule%20K'
r=urllib.request.urlopen(url,timeout=40).read();Path('.cache/reference-audit/usace-search.json').write_bytes(r)
d=json.loads(r);print(type(d).__name__)
if isinstance(d,dict):print(list(d.keys()))
if isinstance(d,list):
 for x in d:print({k:v for k,v in x.items() if k in ['OBJECTID','TITLE','FILENAME','DATE','DATEPUB','ABSTRACT']})
