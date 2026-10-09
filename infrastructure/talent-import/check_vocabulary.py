"""Fails when vocabulary.py no longer matches the codes in the backend. Run from the repository root."""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import vocabulary

BASE = Path("backend/src/main/java/ai/genaifund/beyondpilot")


def codes(path: Path, constant: str) -> tuple[str, ...]:
    source = path.read_text(encoding="utf-8")
    match = re.search(rf"String {constant}\s*=\s*((?:\"[^\"]*\"\s*\+?\s*)+);", source)
    if match is None:
        raise SystemExit(f"{constant} not found in {path}")
    joined = "".join(re.findall(r"\"([^\"]*)\"", match.group(1)))
    return tuple(joined.split("|"))


def main() -> int:
    drift = []
    for name, (file, constant) in vocabulary.SOURCES.items():
        expected = codes(BASE / file, constant)
        if tuple(getattr(vocabulary, name)) != expected:
            drift.append(f"{name}: backend has {expected}")
    for line in drift:
        print(line)
    return 1 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
