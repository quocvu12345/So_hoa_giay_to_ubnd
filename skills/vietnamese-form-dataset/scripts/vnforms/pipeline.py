import concurrent.futures
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

import fitz


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_path(root, template):
    return (root / 'data/form-test-data' / template['local_path']).resolve()


def convert_chunk(job):
    root, out, soffice, rows, worker = job
    out = Path(out)
    profile = out / 'work' / f'lo-profile-{worker}'
    inputs, results = [], []
    for t in rows:
        src = source_path(Path(root), t)
        assert sha(src) == t['sha256'], t['id']
        destination = out / 'source-pdf' / f"{t['id']}.pdf"
        if src.suffix.lower() == '.pdf':
            shutil.copyfile(src, destination)
            results.append({'template_id': t['id'], 'status': 'completed', 'method': 'original_pdf', 'path': str(destination.relative_to(out))})
        else:
            local = out / 'work/in' / (t['id'] + src.suffix.lower())
            local.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, local)
            inputs.append((t, local, destination))
    if inputs:
        cmd = [str(soffice), '-env:UserInstallation=' + profile.resolve().as_uri(), '--headless', '--norestore', '--nodefault',
               '--convert-to', 'pdf:writer_pdf_Export', '--outdir', str(out / 'source-pdf'), *[str(p) for _, p, _ in inputs]]
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=max(180, len(inputs) * 15))
            message = result.stderr.decode(errors='replace')[-1200:]
        except subprocess.TimeoutExpired:
            message = 'LibreOffice conversion timed out for this chunk'
        for t, _, dest in inputs:
            results.append({'template_id': t['id'], 'status': 'completed' if dest.is_file() else 'failed',
                            'method': 'libreoffice_26.8.3_pdf_export', 'path': str(dest.relative_to(out)), 'message': message})
    for r in results:
        if r['status'] == 'completed':
            try:
                with fitz.open(out / r['path']) as pdf:
                    r['pages'] = len(pdf)
                    r['text_characters'] = sum(len(p.get_text()) for p in pdf)
                    assert r['pages'] > 0
                    pdf[0].get_pixmap(matrix=fitz.Matrix(.5, .5))
                r['sha256'] = sha(out / r['path'])
            except Exception as exc:
                r.update(status='failed', message=str(exc))
        save(out / 'conversions' / f"{r['template_id']}.json", r)
    return results


def convert(args, rows, out):
    (out / 'source-pdf').mkdir(parents=True, exist_ok=True)
    todo = []
    for t in rows:
        info = out / 'conversions' / f"{t['id']}.json"
        if args.resume and info.is_file():
            r = json.loads(info.read_text())
            if r['status'] == 'completed' and (out / r['path']).is_file():
                continue
        todo.append(t)
    chunks = [todo[i:i + 18] for i in range(0, len(todo), 18)]
    # Different chunks have separate office profiles, even when queued to one worker.
    jobs = [(str(args.root), str(out), str(args.soffice), chunk, i) for i, chunk in enumerate(chunks)]
    done = len(rows) - len(todo)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(convert_chunk, job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            results = future.result()
            done += len(results)
            print(f'convert {done}/{len(rows)}; failed in chunk {sum(r["status"] != "completed" for r in results)}', flush=True)
            save(out / 'progress.json', {'stage': 'convert', 'completed': done, 'target': len(rows)})
    results = [json.loads((out / 'conversions' / f"{t['id']}.json").read_text()) for t in rows]
    save(out / 'conversion-report.json', results)
    if any(r['status'] != 'completed' for r in results):
        raise RuntimeError('Some source conversions failed; see conversion-report.json and retry those templates.')


def execute(args):
    out = args.root / 'data/vietnamese-form-dataset'
    out.mkdir(parents=True, exist_ok=True)
    targets_path = args.targets or out / 'targets.json'
    if targets_path.is_file():
        rows = json.loads(targets_path.read_text())
    else:
        lib = json.loads((args.root / 'data/form-test-data/classification.json').read_text())
        rows = [t for t in lib['templates'] if t['input_status'] == 'applicant_inputs_detected']
        save(targets_path, rows)
    if args.limit:
        rows = rows[:args.limit]
    settings = {'seed': args.seed, 'copies_per_template': args.copies, 'target_templates': len(rows),
                'expected_filled_documents': len(rows) * args.copies,
                'targets_sha256': sha(targets_path), 'fonts': ['PatrickHand-Regular', 'Mali-Regular']}
    save(out / 'settings.json', settings)
    phases = ['convert', 'plan', 'generate', 'verify', 'package'] if args.phase == 'all' else [args.phase]
    for phase in phases:
        if phase == 'convert':
            convert(args, rows, out)
        elif phase == 'plan':
            from .layout import plan
            plan(args, rows, out)
        elif phase == 'generate':
            from .render import generate
            generate(args, rows, out)
        elif phase == 'verify':
            from .review import verify
            verify(args, rows, out)
        elif phase == 'package':
            from .review import package
            package(args, rows, out)
