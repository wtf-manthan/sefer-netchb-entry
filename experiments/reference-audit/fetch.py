import urllib.request
from pathlib import Path
urls={
 'schedule-d.html':'https://www.census.gov/foreign-trade/schedules/d/distcode.html',
 'schedule-k.pdf':'https://www.cbp.gov/sites/default/files/2025-02/ACE%20Appendix%20F%20Schedule%20K_26_2_2025_v2_508c.pdf',
 'usace.html':'https://ndclibrary.sec.usace.army.mil/'
}
out=Path('.cache/reference-audit');out.mkdir(parents=True,exist_ok=True)
for name,url in urls.items():
 try:
  with urllib.request.urlopen(url,timeout=30) as r: data=r.read()
  (out/name).write_bytes(data);print(name,len(data))
 except Exception as e:print(name,type(e).__name__,str(e))
