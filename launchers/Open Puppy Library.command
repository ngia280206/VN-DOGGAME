#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
exec .venv/bin/python dog_library.py --breed hmong_bobtail_puppy
