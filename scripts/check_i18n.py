#!/usr/bin/env python3
"""Fail the build when a catalogue drifts from English, the source language.

i18n rots quietly: a key is added in English, a translation keeps rendering
the raw key, and nobody notices until a user reports a screen full of
"result.gap". This check makes that a build failure instead.
"""
import json, pathlib, sys

SOURCE = "en"
ROOT = pathlib.Path(__file__).resolve().parent.parent / "src" / "i18n" / "locales"


def leaves(obj, prefix=""):
    for key, value in obj.items():
        if key == "_meta":
            continue
        if isinstance(value, dict):
            yield from leaves(value, prefix + key + ".")
        else:
            yield prefix + key, value


def main() -> int:
    source = dict(leaves(json.loads((ROOT / f"{SOURCE}.json").read_text("utf-8"))))
    failures = 0

    for path in sorted(ROOT.glob("*.json")):
        locale = path.stem
        data = json.loads(path.read_text("utf-8"))
        meta = data.get("_meta", {})
        strings = dict(leaves(data))

        missing = sorted(set(source) - set(strings))
        extra = sorted(set(strings) - set(source))
        # A placeholder present in the source must survive translation, or the
        # sentence silently loses its number.
        holes = []
        for key, text in strings.items():
            if key in source:
                want = set(__import__("re").findall(r"\{(\w+)\}", source[key]))
                got = set(__import__("re").findall(r"\{(\w+)\}", text))
                if want != got:
                    holes.append(f"{key}: expected {sorted(want)}, found {sorted(got)}")

        problems = []
        if locale != SOURCE and missing:
            problems.append(f"{len(missing)} missing: {', '.join(missing[:6])}")
        if extra:
            problems.append(f"{len(extra)} unknown: {', '.join(extra[:6])}")
        if holes:
            problems.append(f"{len(holes)} placeholder mismatch: {holes[0]}")
        if meta.get("status") not in {"reviewed", "draft", "machine"}:
            problems.append("_meta.status must be reviewed, draft or machine")

        if problems:
            failures += 1
            print(f"FAIL {locale}.json")
            for p in problems:
                print(f"     {p}")
        else:
            flag = "" if meta.get("status") == "reviewed" else f"  ({meta.get('status')})"
            print(f"ok   {locale}.json — {len(strings)} strings{flag}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
