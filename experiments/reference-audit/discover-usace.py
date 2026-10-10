import urllib.request,re
from pathlib import Path
root='https://ndclibrary.sec.usace.army.mil/'
html=Path('.cache/reference-audit/usace.html').read_text()
name=re.search(r'src="(main\.[^"]+\.js)"',html)[1]
data=urllib.request.urlopen(root+name,timeout=40).read();Path('.cache/reference-audit/usace.js').write_bytes(data)
s=data.decode()
for pat in [r'https[^\s"\x27<>`]+',r'.{0,100}apiUrl.{0,150}',r'.{0,100}download.{0,150}']:
 matches=re.findall(pat,s)
 print(pat, '\n'.join(matches[-30:]))
