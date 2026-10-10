"""One-time fixture migration for the scoped reference API repair."""
from pathlib import Path
for name in ['task1-infrastructure.test.ts','adversarial-task1.test.ts']:
    p=Path('server/test/reference')/name
    s=p.read_text(encoding='utf-8')
    s=s.replace('new ReferenceDiskCache(tmpDir)',"new ReferenceDiskCache(tmpDir, {targetField:'header.unladingPort',contextFingerprint:computeSha256('fixture-context')})")
    if name.startswith('task1'):
        scope="...{shipmentId:'fixture-shipment',evidenceFingerprint:computeSha256('fixture-evidence'),lookupFingerprint:computeSha256('fixture-lookup'),targetField:'header.unladingPort'},\n"
        for title in ['Confirmation: Scoped invalidation','Confirmation: Gracefully coerces','Confirmation: Port role context isolation']:
            start=s.index("test('"+title)
            end=s.find("\ntest(",start+1)
            if end<0:end=len(s)
            block=s[start:end]
            import re
            block=re.sub(r'(?m)^(\s*)category:',lambda m:m[1]+scope+m[1]+'category:',block)
            s=s[:start]+block+s[end:]
    p.write_text(s,encoding='utf-8')
