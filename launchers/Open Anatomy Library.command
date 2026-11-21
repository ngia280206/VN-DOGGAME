#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
exec .venv/bin/python dog_library.py --breed chihuahua_deer
