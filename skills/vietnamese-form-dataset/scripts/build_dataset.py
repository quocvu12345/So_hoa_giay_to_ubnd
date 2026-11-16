#!/usr/bin/env python3
"""Entrypoint for reproducible bulk fixtures; source templates are read-only."""
import argparse
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--targets', type=Path)
    parser.add_argument('--copies', type=int, default=2)
    parser.add_argument('--seed', type=int, default=20261113)
    parser.add_argument('--phase', choices=['convert', 'plan', 'generate', 'verify', 'package', 'all'], default='all')
    parser.add_argument('--soffice', type=Path, default=Path('/Volumes/quocDisk/AI/document-samples/tools/lo-extracted/LibreOffice/LibreOffice.app/Contents/MacOS/soffice'))
    parser.add_argument('--jobs', type=int, default=3)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.copies <= 100:
        parser.error('--copies must be between 1 and 100')
    args.root = args.root.resolve()
    from vnforms.pipeline import execute
    execute(args)


if __name__ == '__main__':
    main()
