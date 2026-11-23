#!/usr/bin/env python3
"""Build a zero-dependency single-file HTML export of DMC 445 · Optical Atelier."""
from __future__ import annotations

import base64
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_FILE = ROOT / "dmc445-optical-atelier.html"


def safe_inline_js(js_text: str) -> str:
    return re.sub(r"</script", "<\\/script", js_text, flags=re.IGNORECASE)


def safe_inline_css(css_text: str) -> str:
    return re.sub(r"</style", "<\\/style", css_text, flags=re.IGNORECASE)


def build() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = safe_inline_css((ROOT / "styles.css").read_text(encoding="utf-8"))
    dmc_js = safe_inline_js((ROOT / "dmc445.js").read_text(encoding="utf-8"))
    icons_js = safe_inline_js((ROOT / "icons.js").read_text(encoding="utf-8"))
    d3d_js = safe_inline_js((ROOT / "diamond3d.js").read_text(encoding="utf-8"))
    pm_js = safe_inline_js((ROOT / "path-marquee.js").read_text(encoding="utf-8"))
    app_js = safe_inline_js((ROOT / "app.js").read_text(encoding="utf-8"))

    icon_bytes = (ROOT / "assets" / "webgradients-icon.png").read_bytes()
    icon_b64 = base64.b64encode(icon_bytes).decode("ascii")
    icon_data_uri = f"data:image/png;base64,{icon_b64}"

    # Strip external Google Fonts links for 100% offline zero-dependency resilience
    html = re.sub(
        r'\s*<link[^>]*href="https://fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*/?>',
        "",
        html,
    )

    # Inline stylesheet
    html, css_n = re.subn(
        r'<link\s+rel="stylesheet"\s+href="\./styles\.css(?:\?[^"]*)?"\s*/?>',
        lambda _: f"<style>\n{css}\n  </style>",
        html,
        count=1,
    )
    if css_n != 1:
        raise RuntimeError(f"Expected 1 styles.css link tag, matched {css_n}")

    # Inline brand emblem PNG
    html, img_n = re.subn(
        r'src="\./assets/webgradients-icon\.png"',
        lambda _: f'src="{icon_data_uri}"',
        html,
    )
    if img_n < 1:
        raise RuntimeError("Expected at least 1 webgradients-icon.png reference")

    # Inline scripts in exact load order
    script_bundle = (
        f"<script>\n{dmc_js}\n  </script>\n"
        f"  <script>\n{icons_js}\n  </script>\n"
        f"  <script>\n{d3d_js}\n  </script>\n"
        f"  <script>\n{pm_js}\n  </script>\n"
        f"  <script>\n{app_js}\n  </script>"
    )
    script_pattern = (
        r'<script\s+src="\./dmc445\.js(?:\?[^"]*)?"></script>\s*'
        r'<script\s+src="\./icons\.js(?:\?[^"]*)?"></script>\s*'
        r'<script\s+src="\./diamond3d\.js(?:\?[^"]*)?"></script>\s*'
        r'<script\s+src="\./path-marquee\.js(?:\?[^"]*)?"></script>\s*'
        r'<script\s+src="\./app\.js(?:\?[^"]*)?"></script>'
    )
    html, js_n = re.subn(script_pattern, lambda _: script_bundle, html, count=1)
    if js_n != 1:
        raise RuntimeError(f"Expected 1 script block, matched {js_n}")

    OUT_FILE.write_text(html, encoding="utf-8")
    digest = hashlib.sha256(OUT_FILE.read_bytes()).hexdigest()[:16]
    print(f"Built {OUT_FILE} ({OUT_FILE.stat().st_size:,} bytes, sha256={digest})")


if __name__ == "__main__":
    build()
