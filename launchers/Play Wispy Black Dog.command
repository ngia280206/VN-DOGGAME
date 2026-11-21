#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
exec .venv/bin/python play_park.py --breed saved_wispy-black-dog-20261116
