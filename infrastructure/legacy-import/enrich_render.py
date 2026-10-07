"""Stage 1b of the enrichment: what a plain fetch could not read, read in a real browser.

1. Logos and covers that stage 1 refused only because they are SVG are drawn by Chromium into PNG and checked by
   the same rules (enrich_fetch.py), for records that still have none. A wordmark up to 4.5 times as wide as it
   is tall is centred on a transparent square first, so the square logo slot shows it whole.
2. Sites that answered an empty page (built by JavaScript) or refused a plain client are opened in headless
   Chromium: the rendered text is saved as the source, with up to three of the company's own pages, and logo and
   cover candidates are read from the rendered page.

Each record's stage 1 state (state/<id>.json) is updated in place and fetch.json is written again from all states.

    python -I enrich_render.py <input.json> <work folder> [how many, to try a few first]
"""

import asyncio
import base64
import html
import io
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import enrich_fetch as fetch  # noqa: E402

CONCURRENCY = 3
PAGE_TIMEOUT = 25_000
CHALLENGE = re.compile(r"(?i)(just a moment|attention required|verify you are human|are you a robot|captcha|"
                       r"checking your browser|access denied|cf-challenge|ddos protection)")


def svg_page(body: bytes) -> str:
    data = base64.b64encode(body).decode("ascii")
    return ("<!doctype html><html><body style='margin:0;background:transparent'>"
            f"<img id='i' src='data:image/svg+xml;base64,{data}'></body></html>")


async def rasterise(browser, body: bytes, kind: str) -> Image.Image:
    """Draws an SVG at a size fit for its use and returns the PNG as a picture."""
    page = await browser.new_page()
    try:
        await page.set_content(svg_page(body), timeout=PAGE_TIMEOUT)
        size = await page.evaluate("() => { const i = document.getElementById('i'); "
                                   "return [i.naturalWidth, i.naturalHeight]; }")
        width, height = size if size and size[0] and size[1] else (300, 150)
        if kind == "logo":
            scale = 512 / max(width, height)
        else:
            scale = max(1200 / width, 1.0)
        target = [max(1, round(width * scale)), max(1, round(height * scale))]
        await page.evaluate("([w, h]) => { const i = document.getElementById('i'); "
                            "i.style.width = w + 'px'; i.style.height = h + 'px'; }", target)
        await page.set_viewport_size({"width": target[0] + 10, "height": target[1] + 10})
        png = await page.locator("#i").screenshot(omit_background=True, timeout=PAGE_TIMEOUT)
    finally:
        await page.close()
    picture = Image.open(io.BytesIO(png))
    picture.load()
    return picture


def save_png(picture: Image.Image, path_no_ext: Path) -> Path:
    buffer = io.BytesIO()
    picture.convert("RGBA").save(buffer, "PNG")
    if buffer.tell() > fetch.IMAGE_LIMIT:
        raise fetch.Refused("too large")
    path = path_no_ext.with_suffix(".png")
    path.write_bytes(buffer.getvalue())
    return path


async def svg_logo(browser, state: dict, images: Path) -> bool:
    for rejection in [r for r in state.get("rejected") or [] if r.get("kind") == "logo" and r.get("reason") == "svg"]:
        try:
            _, body, _ = await asyncio.to_thread(fetch.get, rejection["url"], fetch.IMAGE_LIMIT)
            picture = await rasterise(browser, body, "logo")
        except Exception as error:  # a failed drawing leaves the record as it was
            rejection["svg"] = f"failed: {type(error).__name__}"
            continue
        width, height = picture.size
        source = "svg-rendered"
        if 2 < width / height <= 4.5 or 2 < height / width <= 4.5:
            # A wordmark sits in the middle of a transparent square, so the square logo slot shows it whole.
            side = max(width, height)
            square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            square.paste(picture.convert("RGBA"), ((side - width) // 2, (side - height) // 2))
            picture, source = square, "svg-rendered-padded"
            width, height = picture.size
        if min(width, height) < 128 or not 0.5 <= width / height <= 2:
            rejection["svg"] = f"shape {width}x{height}"
            continue
        path = save_png(picture, images / f"{state['org_id']}.logo")
        state["logo"] = {"file": f"images/{path.name}", "url": rejection["url"], "source": source,
                         "size": [width, height], "sha": fetch.hashlib.sha256(path.read_bytes()).hexdigest()}
        return True
    return False


async def svg_cover(browser, state: dict, images: Path) -> bool:
    logo = state.get("logo")
    for rejection in [r for r in state.get("rejected") or [] if r.get("kind") == "cover" and r.get("reason") == "svg"]:
        if logo and rejection["url"] == logo.get("url"):
            continue
        try:
            _, body, _ = await asyncio.to_thread(fetch.get, rejection["url"], fetch.IMAGE_LIMIT)
            picture = await rasterise(browser, body, "cover")
        except Exception as error:
            rejection["svg"] = f"failed: {type(error).__name__}"
            continue
        width, height = picture.size
        if width < 600 or not 1.3 <= width / height <= 2.5:
            rejection["svg"] = f"shape {width}x{height}"
            continue
        path = save_png(picture, images / f"{state['id']}.cover")
        state["cover"] = {"file": f"images/{path.name}", "url": rejection["url"], "source": "svg-rendered",
                          "size": [width, height]}
        return True
    return False


async def open_page(context, url: str) -> tuple[str, str, str]:
    """Opens a page in the browser and returns its final address, its HTML and its visible text."""
    fetch.public_host(urllib.parse.urlsplit(url).hostname or "")
    page = await context.new_page()
    try:
        response = await page.goto(url, timeout=PAGE_TIMEOUT, wait_until="domcontentloaded")
        try:
            await page.wait_for_load_state("networkidle", timeout=5_000)
        except Exception:  # a page that never goes quiet is read as it is after five seconds
            pass
        final = page.url
        fetch.public_host(urllib.parse.urlsplit(final).hostname or "")
        if response is not None and response.status >= 400:
            raise fetch.Refused(f"http {response.status}")
        content = await page.content()
        text = await page.evaluate("() => document.body ? document.body.innerText : ''")
    finally:
        await page.close()
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in (text or "").splitlines()]
    return final, content, "\n".join(line for line in lines if line)


async def render_site(context, state: dict, record: dict, sources: Path, images: Path) -> None:
    sid = state["id"]
    url = (state.get("site") or {}).get("final") or (state.get("site") or {}).get("url") \
        or fetch.normalise(record.get("website"))
    if not url:
        return
    try:
        final, content, text = await open_page(context, url)
    except fetch.Refused as refused:
        state["site"]["status"] = str(refused)
        return
    except Exception as error:
        state["site"]["status"] = "render failed: " + type(error).__name__
        return
    if CHALLENGE.search(text[:3000]) and len(text) < 3000:
        state["site"]["status"] = "challenge"
        return
    if fetch.PARKED.search(text[:5000]):
        state["site"]["status"] = "parked"
        return
    if len(text) < 80:
        state["site"]["status"] = "empty after render"
        return
    state["site"]["status"] = "rendered"
    state["site"]["final"] = final
    web = [f for f in state.get("files") or [] if ".web-" in f]
    for name in web:
        (sources.parent / name).unlink(missing_ok=True)
    state["files"] = [f for f in state.get("files") or [] if ".web-" not in f]
    (sources / f"{sid}.web-1.txt").write_text(final + "\n" + text, encoding="utf-8")
    state["files"].append(f"sources/{sid}.web-1.txt")
    page = fetch.Page()
    page.feed(content)
    host = fetch.bare(urllib.parse.urlsplit(final).hostname or "")
    chosen, seen = [], {final.rstrip("/")}
    for href in page.links:
        link = urllib.parse.urljoin(final, html.unescape(href)).split("#")[0]
        parts = urllib.parse.urlsplit(link)
        if parts.scheme not in ("http", "https") or fetch.bare(parts.hostname or "") != host:
            continue
        if link.rstrip("/") in seen or not fetch.LINK_WORDS.search(parts.path):
            continue
        if re.search(r"(?i)\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4)$", parts.path):
            continue
        seen.add(link.rstrip("/"))
        chosen.append(link)
        if len(chosen) == 3:
            break
    for link in chosen:
        try:
            final2, _, text2 = await open_page(context, link)
        except Exception:
            continue
        if len(text2) >= 80:
            name = f"{sid}.web-{len([f for f in state['files'] if '.web-' in f]) + 1}.txt"
            (sources / name).write_text(final2 + "\n" + text2, encoding="utf-8")
            state["files"].append(f"sources/{name}")
    rejected = state.setdefault("rejected", [])
    if not state.get("logo") and not record.get("logo_file_id"):
        state["logo"] = await asyncio.to_thread(fetch.pick_logo, final, page, state["org_id"], images, rejected)
    if not state.get("cover") and not record.get("cover_file_id"):
        state["cover"] = await asyncio.to_thread(fetch.pick_cover, final, page, sid, images, state.get("logo"),
                                                 rejected)


async def one(browser, state_path: Path, record: dict, render: bool, work: Path, gate) -> None:
    async with gate:
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if "site" not in state or state.get("site") is None:
            state["site"] = {"url": fetch.normalise(record.get("website")), "status": "missing"}
        state["render"] = {}
        if render:
            context = await browser.new_context(user_agent=fetch.UA, ignore_https_errors=False)
            try:
                await render_site(context, state, record, work / "sources", work / "images")
            finally:
                await context.close()
            state["render"]["site"] = state["site"]["status"]
        if not state.get("logo") and not record.get("logo_file_id"):
            state["render"]["svg_logo"] = await svg_logo(browser, state, work / "images")
        if not state.get("cover") and not record.get("cover_file_id"):
            state["render"]["svg_cover"] = await svg_cover(browser, state, work / "images")
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")


async def run(records: dict, work: Path, limit: int | None) -> None:
    render_ids = set(json.loads((work / "render-ids.json").read_text(encoding="utf-8")))
    todo = []
    for path in sorted((work / "state").glob("*.json")):
        state = json.loads(path.read_text(encoding="utf-8"))
        if "render" in state:
            continue
        record = records.get(state["id"])
        if record is None:
            continue
        has_svg = any(r.get("reason") == "svg" for r in state.get("rejected") or [])
        if state["id"] in render_ids or has_svg:
            todo.append((path, record, state["id"] in render_ids))
    todo = todo[:limit] if limit else todo
    log = open(work / "render.log", "a", encoding="utf-8")
    started = time.time()
    log.write(f"{time.strftime('%H:%M:%S')} start: {len(todo)} to do\n")
    log.flush()
    gate = asyncio.Semaphore(CONCURRENCY)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        tasks = [asyncio.create_task(one(browser, path, record, render, work, gate)) for path, record, render in todo]
        done = 0
        for task in asyncio.as_completed(tasks):
            try:
                await task
            except Exception as error:  # one record failing must not stop the run
                log.write(f"error: {type(error).__name__}: {error}\n")
            done += 1
            if done % 25 == 0:
                log.write(f"{time.strftime('%H:%M:%S')} {done}/{len(todo)} ({time.time() - started:.0f}s)\n")
                log.flush()
        await browser.close()
    states = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((work / "state").glob("*.json"))]
    (work / "fetch.json").write_text(json.dumps(states, ensure_ascii=False, indent=1), encoding="utf-8")
    log.write(f"{time.strftime('%H:%M:%S')} finished: {len(todo)} in {time.time() - started:.0f}s\n")
    log.close()


def main() -> None:
    records = {r["id"]: r for r in json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))}
    asyncio.run(run(records, Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else None))


if __name__ == "__main__":
    main()
