#!/usr/bin/env python3
"""Check plan coverage or a filled evidence ledger; never runs application tests.

Usage: python verify_plan.py --coverage
       python verify_plan.py --release [--ledger path]
Release requires actual test evidence; the supplied unexecuted plan must fail.
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path


def check_coverage(ledger: dict, original: dict) -> list[str]:
    errors: list[str] = []
    stages = ledger.get('phases', [])
    names = [s.get('id') for s in stages]
    if names != [f'C{i}' for i in range(12)]:
        errors.append('C0—C11 phase list is incomplete or reordered.')
    original_ids = {x['id'] for x in original['tests']}
    inherited = ledger.get('legacy_tests', [])
    if {x.get('id') for x in inherited} != original_ids or len(inherited) != 87:
        errors.append('The exact 87 original test IDs are not preserved.')
    originals = {item['id']: item for item in original['tests']}
    for item in inherited:
        src = originals.get(item.get('id'))
        if not src:
            continue
        for field in ('title', 'method', 'precondition', 'action'):
            if item.get(field) != src.get(field):
                errors.append(f"{item['id']}: original {field} was not preserved.")
        if item.get('expected') != src.get('expected'):
            if item.get('original_expected') != src.get('expected') or not item.get('disposition'):
                errors.append(f"{item['id']}: acceptance amendment lacks original text and reason.")
    extra = ledger.get('supplemental_tests', [])
    all_tests = inherited + extra
    ids = [x.get('id') for x in all_tests]
    if len(set(ids)) != len(ids):
        errors.append('Duplicate acceptance ID.')
    if len(all_tests) != ledger.get('test_count'):
        errors.append('Test count mismatch.')
    for index, stage in enumerate(stages):
        expected = [] if index == 0 else [f'C{index-1}']
        if stage.get('depends_on') != expected:
            errors.append(f"{stage.get('id')}: sequence dependency mismatch.")
    for item in all_tests:
        tid = item.get('id', '?')
        owner = item.get('owner_phase', item.get('phase'))
        if owner not in names:
            errors.append(f'{tid}: unknown owner phase.')
        for key in ('title','method','precondition','action','expected'):
            if not item.get(key):
                errors.append(f'{tid}: missing {key}.')
        if item.get('priority') != 'required':
            errors.append(f'{tid}: an agreed acceptance was silently waived.')
        if item.get('status') not in ('NOT_RUN','PASS','FAIL','BLOCKED'):
            errors.append(f'{tid}: invalid status or scope waiver.')
    for row in ledger.get('issue_coverage', []):
        if row.get('owner_phase') not in names:
            errors.append(f"{row.get('id')}: unknown owner.")
        if not row.get('acceptance_ids') or not set(row['acceptance_ids']).issubset(ids):
            errors.append(f"{row.get('id')}: invalid acceptance mapping.")
    required_sources = {f'AUD15-F{i:02}' for i in range(1,8)} | {f'AUD16-F{i:02}' for i in range(1,7)} | {f'UX-{i:02}' for i in range(1,13)}
    if not required_sources.issubset({x.get('id') for x in ledger.get('issue_coverage',[])}):
        errors.append('An audit issue or interaction requirement was omitted.')
    return errors


def check_release(ledger: dict, root: Path) -> list[str]:
    errors: list[str] = []
    release = ledger.get('release', {})
    commit, build = release.get('candidate_commit'), release.get('build_sha256')
    if not re.fullmatch(r'[a-f0-9]{40}', str(commit or '')):
        errors.append('Final candidate commit missing.')
    if not re.fullmatch(r'[a-f0-9]{64}', str(build or '')):
        errors.append('Final build SHA-256 missing.')
    if release.get('open_issue_count') != 0:
        errors.append('Open in-scope issues remain or were not counted.')
    if release.get('package_verified') is not True:
        errors.append('Clean-package rebuild has not been verified.')
    for phase in ledger.get('phases', []):
        if phase.get('status') != 'PASS':
            errors.append(f"{phase['id']}: phase not closed.")
    for item in ledger.get('legacy_tests', []) + ledger.get('supplemental_tests', []):
        tid = item['id']
        if item.get('status') != 'PASS':
            errors.append(f'{tid}: {item.get("status")}.')
            continue
        if item.get('tested_commit') != commit or item.get('build_sha256') != build:
            errors.append(f'{tid}: evidence identity differs from final candidate.')
        if not item.get('environment') or not item.get('actual') or not item.get('executed_at'):
            errors.append(f'{tid}: environment, actual result or execution date missing.')
        if not item.get('evidence'):
            errors.append(f'{tid}: evidence absent.')
        for evidence in item.get('evidence', []):
            if not isinstance(evidence,str):
                errors.append(f'{tid}: evidence must be a relative local path.'); continue
            path = (root / evidence).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                errors.append(f'{tid}: missing/unsafe evidence path: {evidence}.')
        if any(word in item.get('method','') for word in ('人工','真机','听评')) and not item.get('reviewer'):
            errors.append(f'{tid}: real reviewer/executor missing.')
    for row in ledger.get('issue_coverage', []):
        if row.get('status') != 'PASS':
            errors.append(f"{row['id']}: requirement not closed.")
    return errors


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--coverage',action='store_true')
    group.add_argument('--release',action='store_true')
    parser.add_argument('--ledger',type=Path,default=Path(__file__).parent/'ACCEPTANCE_LEDGER.json')
    args=parser.parse_args()
    try:
        ledger=json.loads(args.ledger.read_text(encoding='utf-8'))
        original=json.loads((Path(__file__).parent/'sources/original_acceptance_87.json').read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        print(f'Cannot read plan: {exc}',file=sys.stderr);return 2
    errors=check_coverage(ledger,original)
    if args.release: errors+=check_release(ledger,args.ledger.parent)
    report={'kind':'release-evidence-gate' if args.release else 'plan-coverage-only',
            'passed':not errors,'original_requirements':len(ledger.get('legacy_tests',[])),
            'supplemental_requirements':len(ledger.get('supplemental_tests',[])),
            'issue_mappings':len(ledger.get('issue_coverage',[])),
            'errors':errors,'application_tests_executed':False}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 1 if errors else 0
if __name__=='__main__':raise SystemExit(main())
