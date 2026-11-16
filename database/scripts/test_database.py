#!/usr/bin/env python3
"""Test in a disposable PostgreSQL cluster; never connect to an existing server.

Requires local PostgreSQL 16+ binaries initdb, pg_ctl and psql on PATH.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout


def main():
    for binary in ['initdb', 'pg_ctl', 'psql']:
        if not shutil.which(binary):
            raise SystemExit('Missing PostgreSQL binary: ' + binary)
    path = Path(tempfile.mkdtemp(prefix='hoso-pg-', dir='/tmp'))
    os.chmod(path, 0o700)
    started = False
    try:
        run(['initdb', '-D', str(path / 'data'), '-U', 'hoso_test', '--auth-local=trust', '--auth-host=reject', '--no-locale', '--encoding=UTF8'])
        run(['pg_ctl', '-D', str(path / 'data'), '-l', str(path / 'server.log'), '-o', f"-k {path} -p 55489 -c listen_addresses=''", '-w', 'start'])
        started = True
        command = ['psql', '-X', '-h', str(path), '-p', '55489', '-U', 'hoso_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
        run(command + ['-f', str(ROOT / 'install.sql')])
        first = run(command + ['-Atc', 'SELECT count(*) FROM hoso.audit_events;']).strip()
        run(command + ['-f', str(ROOT / 'install.sql')])
        second = run(command + ['-Atc', 'SELECT count(*) FROM hoso.audit_events;']).strip()
        if first != second:
            raise RuntimeError('Repeated real seed changed audit rows.')
        run(command + ['-f', str(ROOT / '004_seed_demo_optional.sql')])
        before = run(command + ['-Atc', 'SELECT count(*) FROM hoso.audit_events;']).strip()
        run(command + ['-f', str(ROOT / '004_seed_demo_optional.sql')])
        after = run(command + ['-Atc', 'SELECT count(*) FROM hoso.audit_events;']).strip()
        if before != after:
            raise RuntimeError('Repeated demo seed changed audit rows.')
        result = run(command + ['-f', str(ROOT / '006_verify.sql')])
        run(command + ['-f', str(ROOT / '005_example_queries.sql')])
        final = run(command + ['-Atc', 'SELECT count(*) FROM hoso.workflow_events;']).strip()
        if final != '0':
            raise RuntimeError('Tests did not roll back workflow changes.')
        run(command + ['-f', str(ROOT / '007_seed_citizen_samples_optional.sql')])
        citizen_first = run(command + ['-Atc', 'SELECT count(*) FROM hoso.audit_events;']).strip()
        run(command + ['-f', str(ROOT / '007_seed_citizen_samples_optional.sql')])
        citizen_second = run(command + ['-Atc', 'SELECT count(*) FROM hoso.audit_events;']).strip()
        if citizen_first != citizen_second:
            raise RuntimeError('Repeated citizen sample seed changed audit rows.')
        counts = run(command + ['-Atc', "SELECT count(*) FROM hoso.v_citizen_samples; SELECT count(*) FROM hoso.dossiers WHERE code LIKE 'TEST-CITIZEN-%'; SELECT count(*) FROM hoso.ocr_jobs;"]).splitlines()
        if counts != ['12', '3', '0']:
            raise RuntimeError('Citizen fixture counts or OCR provenance incorrect: ' + repr(counts))
        print(result.splitlines()[-1])
        print('PASS: fresh PostgreSQL install, repeatable seeds, queries and rollback. Existing servers untouched.')
    except subprocess.CalledProcessError as error:
        print(error.stdout)
        print(error.stderr)
        raise
    finally:
        if started:
            run(['pg_ctl', '-D', str(path / 'data'), '-m', 'fast', '-w', 'stop'])
        shutil.rmtree(path)


if __name__ == '__main__':
    main()
