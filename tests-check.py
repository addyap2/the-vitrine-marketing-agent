"""Dependency-free source checks; not a substitute for TypeScript/build/browser tests."""
from pathlib import Path
root=Path(__file__).parent
page=(root/'app/page.tsx').read_text()
backup=(root/'lib/backup.ts').read_text()
assert (root/'next.config.ts').read_text().find("output: 'export'")>=0
assert 'supabase' not in (root/'package.json').read_text().lower()
for token in ('buildClaudePrompt','makeTemplate','analyseMetrics','checkPublication','csvSafe','parseBackup','makeBackup','exportBackup','importBackup','month-grid'):
    assert token in page, token
for token in ('JSON.parse','10000','1000','Identifiants en double','Version ou structure incompatible'):
    assert token in backup, token
assert (root/'.github/workflows/verify.yml').exists()
assert 'Campagne référencée introuvable' in backup
assert 'getUTCFullYear' in backup
assert 'Les publications associées seront conservées' in page
assert 'value={d.campaign||""}' in page
assert (root/'tests/backup.test.mjs').exists()
assert (root/'HANDOVER.md').exists()
assert (root/'app/globals.css').exists()
print('Static source checks passed; TypeScript and browser verification still required.')