import urllib.request,urllib.parse,json
from pathlib import Path
id='8c90a43a-eaa8-4e2c-ad13-13a9f3ed2b92'
base='https://ndclibrary.sec.usace.army.mil/api/'
for name,url in [('schedule-k-metadata.json',base+'getdocdatapub/'+id),('schedule-k-2026-q2.xlsx',base+'download?'+urllib.parse.urlencode({'id':id,'filename':'Schedule K 2nd Quarter 2026.xlsx'}))]:
 data=urllib.request.urlopen(url,timeout=45).read();Path('.cache/reference-audit',name).write_bytes(data);print(name,len(data))
