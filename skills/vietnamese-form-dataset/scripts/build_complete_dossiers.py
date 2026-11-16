#!/usr/bin/env python3
"""Create 425 x 2 complete synthetic test packets, including supporting papers.

The original source-backed dataset remains unchanged. Missing originals are
represented by visibly labelled mock documents, never by empty checklists.
"""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--copies', type=int, default=2)
    parser.add_argument('--jobs', type=int, default=3)
    parser.add_argument('--seed', type=int, default=20261113)
    parser.add_argument('--phase', choices=['plan', 'generate', 'verify', 'package', 'all'], default='all')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    args.root = args.root.resolve()
    if args.copies != 2:
        parser.error('This frozen batch requires exactly two copies per procedure (850 packets).')
    if not 1 <= args.jobs <= 8:
        parser.error('--jobs must be between 1 and 8')
    from vnforms.complete_dossiers import execute
    execute(args)


if __name__ == '__main__':
    main()
