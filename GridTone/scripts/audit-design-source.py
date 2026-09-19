"""A separate static audit process; not an AI subagent. Records production design boundaries."""
import json,re,hashlib,sys,os
from pathlib import Path
import tinycss2
R=Path(__file__).resolve().parents[1];O=R/os.environ.get('DESIGN_EVIDENCE_DIR','docs/design-1.9/evidence');O.mkdir(parents=True,exist_ok=True)
a=json.loads((R/'assets.json').read_text());rows=[];violations=[]
props={'font-size','font-weight','font-family','line-height','height','min-height','padding','padding-top','padding-right','padding-bottom','padding-left','color','background','background-color','border-radius'}
exceptions=['.audition-key','.black-key','.white-key','[data-size=key]','[data-size=transport]']
def rules(file,rr):
 for r in rr:
  if r.type=='at-rule' and r.content:rules(file,tinycss2.parse_rule_list(r.content,skip_whitespace=True,skip_comments=True))
  if r.type!='qualified-rule':continue
  selector=tinycss2.serialize(r.prelude).strip()
  if '.btn' not in selector:continue
  values=[d.name for d in tinycss2.parse_declaration_list(r.content,skip_whitespace=True,skip_comments=True) if d.type=='declaration' and d.name in props]
  if not values:continue
  row={'file':file,'line':r.source_line,'selector':selector,'properties':values};rows.append(row)
  if file!='src/styles/components.css' and not any(x in selector for x in exceptions):violations.append(row)
for f in a['styles']:rules(f,tinycss2.parse_stylesheet((R/f).read_text(),skip_whitespace=True,skip_comments=True))
# Literal occurrences are an inventory, not a blind rename script.
terms=['音乐块','片段','乐句','方案','候选','实例','作品','工程','模板','配方','第 0 拍','声格','适组合']
words=[];actions=[]
files=list((R/'src/views').glob('*.js'))+list((R/'src/ui').glob('*.js'))+[R/'src/app.js']+list((R/'src/workspace').glob('*.js'))
for f in files:
 for n,line in enumerate(f.read_text().splitlines(),1):
  found=[t for t in terms if t in line]
  if found:words.append({'file':str(f.relative_to(R)),'line':n,'terms':found})
  for action in re.findall(r"button\('([^']+)'",line):actions.append({'action':action,'file':str(f.relative_to(R)),'line':n})
lexical=[]
for f in files:
 text=f.read_text()
 for term in ['第 0 拍','第0拍','适组合','组合模板案']:
  if term in text:lexical.append({'file':str(f.relative_to(R)),'term':term})
result={'status':'PASS' if not violations and not lexical else 'FAIL','sha256':json.loads((R/'dist/manifest.json').read_text())['sha256'],'buttonRuleSamples':rows,'unexpectedOverrides':violations,'literalErrors':lexical,'actions':actions,'terminology':words,'scope':'Static source audit. UI semantics also require production-browser review; user data and catalog names are not rewritten.'}
(O/'static-design-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'status':result['status'],'overrides':violations,'literalErrors':lexical},ensure_ascii=False,indent=2));sys.exit(0 if result['status']=='PASS'else 1)
