#!/usr/bin/env python3
"""Fail the build on the two silent breakages this UI is prone to.

A missing translation key renders as the raw key ("view.drag") and a missing
element makes a handler throw on boot, killing everything after it. Neither
shows up until someone opens the page, and both are trivially checkable.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCALES = ROOT / "src" / "i18n" / "locales"
SOURCE = "en"


def leaves(obj, prefix=""):
    for k, v in obj.items():
        if k == "_meta":
            continue
        if isinstance(v, dict):
            yield from leaves(v, prefix + k + ".")
        else:
            yield prefix + k


def main() -> int:
    keys = set(leaves(json.loads((LOCALES / f"{SOURCE}.json").read_text("utf-8"))))
    failures = 0

    for page in sorted(ROOT.glob("index.html")):
        html = page.read_text("utf-8")
        used = set(re.findall(r'data-i18n="([^"]+)"', html))
        for attr in re.findall(r'data-i18n-attr="([^"]+)"', html):
            for pair in attr.split(";"):
                if ":" in pair:
                    used.add(pair.split(":", 1)[1].strip())
        missing = sorted(used - keys)
        label = page.relative_to(ROOT)
        if missing:
            failures += 1
            print(f"FAIL {label}: {len(missing)} unknown key(s): {', '.join(missing)}")
        else:
            print(f"ok   {label} — {len(used)} keys resolve")

    # Selectors the viewer reaches for at boot must exist in every shell —
    # except the ones it builds itself, which are counted from the class
    # attributes appearing inside its own string literals.
    js = (ROOT / "src" / "ui" / "viewer.js").read_text("utf-8")
    sel = set(re.findall(r'\$\("([#.][^"]+)"\)', js)) | set(re.findall(r'\$\$\("([#.][^"]+)"\)', js))
    injected = {c for attr in re.findall(r'class=\\?"([^"\\]+)', js) for c in attr.split()}
    for page in sorted(ROOT.glob("index.html")):
        html = page.read_text("utf-8")
        ids = set(re.findall(r'id="([^"]+)"', html))
        classes = {c for attr in re.findall(r'class="([^"]+)"', html) for c in attr.split()}
        missing = sorted(
            s for s in sel
            if (s[0] == "#" and s[1:] not in ids)
            or (s[0] == "." and s[1:].split()[0].split(".")[0] not in (classes | injected))
        )
        label = page.relative_to(ROOT)
        if missing:
            failures += 1
            print(f"FAIL {label}: selector(s) with no target: {', '.join(missing)}")
        else:
            print(f"ok   {label} — {len(sel)} selectors resolve")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
