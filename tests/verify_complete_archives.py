"""Verify every portable dossier ZIP and the full batch archive."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'data/tuliem-dossiers-full'


def read(path):
    return json.loads(path.read_text())


def main():
    catalogue = read(OUT/'catalogue.json'); data = read(OUT/'packets.json')
    packets = {p['id']: p for p in data['packets']}; checked = 0; papers = 0
    expected_master = {'tuliem-dossiers-full/'+n for n in ['README.txt', 'index.html', 'catalogue.json', 'packets.json', 'manifest.json', 'verification.json']}
    for b in catalogue['procedures']:
        expected_master.add('tuliem-dossiers-full/blueprints/'+b['id']+'.json')
        with zipfile.ZipFile(OUT/'downloads'/(b['id']+'.zip')) as archive:
            names = archive.namelist()
            assert len(names) == len(set(names)), 'duplicate archive entry'
            assert archive.testzip() is None, 'corrupt procedure ZIP'
            assert len(b['packet_ids']) == 2
            for packet_id in b['packet_ids']:
                p = packets[packet_id]; prefix = f"bo-{p['copy']:02}/"
                portable = json.loads(archive.read(prefix+'packet.json'))
                assert portable['id'] == p['id'] and portable['path_base'] == 'packet_directory'
                assert portable['test_complete'] and not portable['legally_complete']
                for key in ['profile_path', 'checklist_path']:
                    assert prefix+portable[key] in names
                combined = archive.read(prefix+portable['combined_pdf']['local_path'])
                assert hashlib.sha256(combined).hexdigest() == p['combined_pdf']['sha256']
                for d in portable['documents']:
                    assert prefix+d['ground_truth_path'] in names
                    paper = archive.read(prefix+d['local_path'])
                    assert hashlib.sha256(paper).hexdigest() == d['sha256']
                    papers += 1
                checked += 1
                for name in ['profile.json', 'checklist.json', 'packet.json', 'ho-so-test.pdf']:
                    expected_master.add('tuliem-dossiers-full/packets/'+p['id']+'/'+name)
                for d in p['documents']:
                    for key in ['local_path', 'ground_truth_path']:
                        expected_master.add('tuliem-dossiers-full/'+str((ROOT/d[key]).relative_to(OUT)))
    assert checked == 850 and papers == data['stats']['filled_documents']
    with zipfile.ZipFile(OUT/'tuliem-dossiers-full.zip') as archive:
        names = archive.namelist()
        assert len(names) == len(set(names))
        assert set(names) == expected_master, 'full archive has missing or stale files'
        assert archive.testzip() is None, 'corrupt full ZIP'
    report = {'passed': True, 'procedure_archives': 425, 'portable_packets': checked,
              'individual_pdfs_checked': papers, 'full_archive_files': len(expected_master),
              'checks': ['ZIP CRCs', 'portable relative paths', 'merged and individual PDF hashes',
                         'exactly two packets in every procedure ZIP', 'no retired or unreferenced files']}
    (OUT/'archive-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
