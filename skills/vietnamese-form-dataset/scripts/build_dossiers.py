#!/usr/bin/env python3
"""Build source-backed ward procedure checklists and coherent synthetic packets."""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--copies', type=int, default=2)
    parser.add_argument('--jobs', type=int, default=3)
    parser.add_argument('--seed', type=int, default=20261113)
    parser.add_argument('--phase', choices=['prepare','plan','generate','verify','package','all'], default='all')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    args.root = args.root.resolve()
    if not 1 <= args.copies <= 20:
        parser.error('--copies must be between 1 and 20')
    from vnforms.dossiers import execute
    execute(args)


if __name__ == '__main__':
    main()
