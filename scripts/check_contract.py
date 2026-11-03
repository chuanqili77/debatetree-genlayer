"""Static contract checks mirroring the documented GenVM deploy rules."""
import re
import sys

PATH = "contracts/debatetree.py"
HEADER = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'

src = open(PATH).read()
lines = src.splitlines()
errors = []

if lines[0] != HEADER:
    errors.append("first line is not the pinned Depends header")
for i, line in enumerate(lines[1:], start=2):
    if line.lstrip().startswith("#"):
        errors.append(f"comment line after Depends header at line {i}")
if "import gl" in src or "from genlayer import gl" in src:
    errors.append("must use 'from genlayer import *', never 'import gl'")
if "class DebateTree(gl.Contract)" not in src:
    errors.append("contract class must subclass gl.Contract")
if "def __init__(self):" not in src:
    errors.append("contract class must define __init__")
if "float(" in src:
    errors.append("no floats in contract code")
for method in ["def create_debate", "def post_argument", "def assess_argument",
               "def close_debate", "def get_debate", "def get_argument",
               "def get_counts", "def get_protocol"]:
    if method not in src:
        errors.append(f"missing method {method}")
if errors:
    print("FAIL:")
    for e in errors:
        print(" - " + e)
    sys.exit(1)
print("contract static checks pass")
