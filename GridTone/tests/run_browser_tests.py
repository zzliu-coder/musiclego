"""Run the six current browser suites. Install Playwright/Chromium on your development machine.
CHROMIUM_PATH may select an installed browser; otherwise Playwright's bundled browser is used.
The suites use an inline document to keep testing independent of deployment and external services.
"""
from pathlib import Path
import subprocess,sys,json,platform
root=Path(__file__).resolve().parents[1]
suites=['ui_checkpoint.py','playback_browser.py','editor_browser.py','core_browser_regression.py','acceptance_browser.py','prism_browser.py']
for name in suites:
 print('\n=== '+name+' ===',flush=True)
 subprocess.run([sys.executable,str(root/'tests'/name)],cwd=root,check=True)
out=root/'docs/verification'
ui=json.loads((out/'02-browser.json').read_text());audio=json.loads((out/'03-browser.json').read_text());editor=json.loads((out/'04-browser.json').read_text());core=json.loads((out/'core-browser.json').read_text());full=json.loads((out/'acceptance.json').read_text())
counts={'workspaces':ui['passed'],'playback':len(audio['results']['checks']),'editor':len(editor['checks']),'coreWorkflow':core['passed'],'endToEnd':full['passed'],'prism':json.loads((root/'docs/prism/acceptance.json').read_text())['passed']}
summary={'browserChecks':sum(counts.values()),'suites':counts,'allPassed':True,'python':platform.python_version(),'scope':'Real Chromium DOM, user pointers, native Web Audio, offline WAV, downloads and clean-runtime project reimport. Inline document. Physical hardware, real-origin IndexedDB persistence and microphone permissions are excluded.'}
(out/'browser-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('\nALL PASS',summary['browserChecks'],'browser checks')
