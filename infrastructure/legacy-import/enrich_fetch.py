"""Fetch, for every imported startup, the text a researcher will read and the logo and cover candidates.

Stage 1 of the enrichment: no AI. Per startup it converts the deck to text, saves the company's home page and up to
three of its own pages (about, customers, case studies, product), searches SearXNG on the user's server when the
site is missing, dead or parked, and downloads a checked logo (for the organization) and cover (for the solution).

    python -I enrich_fetch.py <input.json> <work folder>

Writes <work>/sources/, <work>/images/, <work>/state/<id>.json per startup (so a rerun resumes), <work>/fetch.json
and <work>/fetch.log.
"""

import hashlib
import html
import io
import ipaddress
import json
import re
import socket
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = 40_000_000  # a larger picture is refused, not decoded

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/131.0 Safari/537.36")
TIMEOUT = 20
PAGE_LIMIT = 3 * 1024 * 1024
IMAGE_LIMIT = 5 * 1024 * 1024  # organization_logo and solution_image, StorageProperties
DECKS = Path(__file__).resolve().parents[2] / ".tmp" / "legacy-import" / "out" / "files"
PDFTOTEXT = "pdftotext"
SOCIAL = ("linkedin.", "facebook.", "twitter.", "x.com", "instagram.", "youtube.", "crunchbase.", "github.",
          "medium.", "tiktok.", "wikipedia.", "angel.co", "wellfound.", "tracxn.", "pitchbook.", "zoominfo.",
          "glassdoor.", "bloomberg.", "f6s.", "dealroom.", "google.", "apple.com")
PARKED = re.compile(r"(?i)(domain (is|may be) for sale|buy this domain|this domain is parked|parked free|"
                    r"hugedomains|sedo\.com|dan\.com|afternic|domain for sale|is available for purchase|"
                    r"godaddy\.com/domainsearch)")
LINK_WORDS = re.compile(r"(?i)(about|company|who-we-are|our-story|team|customers?|clients?|case-stud|"
                        r"success-stor|portfolio|product|solutions?|platform)")
SEARCH_LOCK = threading.Lock()
LAST_SEARCH = [0.0]


class Refused(Exception):
    pass


def public_host(host: str) -> None:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as error:
        raise Refused("dns") from error
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if (address.is_private or address.is_loopback or address.is_link_local or address.is_reserved
                or address.is_multicast or address.is_unspecified):
            raise Refused("private address")


class GuardedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parts = urllib.parse.urlsplit(newurl)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            raise Refused("redirect off http")
        public_host(parts.hostname)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(GuardedRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))


def encoded(url: str) -> str:
    """A URL as written in a page, made safe to request: spaces and non-ASCII characters escaped, the host in IDNA."""
    parts = urllib.parse.urlsplit(url.strip())
    host = parts.hostname.encode("idna").decode("ascii") if parts.hostname else ""
    netloc = host + (f":{parts.port}" if parts.port else "")
    path = urllib.parse.quote(parts.path, safe="/%:@!$&'()*+,;=-._~")
    query = urllib.parse.quote(parts.query, safe="=&%:@!$'()*+,;/?-._~")
    return urllib.parse.urlunsplit((parts.scheme, netloc, path, query, ""))


def get(url: str, limit: int) -> tuple[str, bytes, str]:
    try:
        url = encoded(url)
    except (UnicodeError, ValueError) as error:
        raise Refused("bad url") from error
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise Refused("not http")
    public_host(parts.hostname)
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with OPENER.open(request, timeout=TIMEOUT) as response:
            body = response.read(limit + 1)
            if len(body) > limit:
                raise Refused("too large")
            return response.geturl(), body, response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        raise Refused(f"http {error.code}") from error
    except urllib.error.URLError as error:
        reason = str(error.reason)
        if "CERTIFICATE" in reason.upper() or "SSL" in reason.upper():
            raise Refused("tls") from error
        if "getaddrinfo" in reason or "Name or service" in reason or "11001" in reason:
            raise Refused("dns") from error
        raise Refused("unreachable") from error
    except (TimeoutError, socket.timeout) as error:
        raise Refused("timeout") from error
    except ssl.SSLError as error:
        raise Refused("tls") from error
    except (ConnectionError, OSError) as error:
        raise Refused("unreachable") from error


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.links, self.icons, self.images, self.meta = [], [], [], [], {}
        self.manifest = None
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag in ("script", "style", "noscript", "svg", "template"):
            self.skip += 1
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "link":
            rel = a.get("rel", "").lower()
            if "manifest" in rel and a.get("href"):
                self.manifest = a["href"]
            elif "icon" in rel and a.get("href"):
                self.icons.append((rel, a.get("sizes", ""), a["href"]))
        elif tag == "meta":
            key = (a.get("property") or a.get("name") or "").lower()
            if key in ("og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src") \
                    and a.get("content"):
                self.meta.setdefault(key, a["content"])
        elif tag == "img":
            src = a.get("src") or a.get("data-src") or ""
            hint = " ".join((src, a.get("alt", ""), a.get("class", ""), a.get("id", ""))).lower()
            if src and "logo" in hint:
                self.images.append(src)
        if tag in ("p", "div", "br", "li", "h1", "h2", "h3", "h4", "section", "tr"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "template") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in raw.splitlines()]
        return "\n".join(line for line in lines if line)


def decode(body: bytes, content_type: str) -> str:
    match = re.search(r"charset=([\w-]+)", content_type or "", re.I)
    for encoding in ([match.group(1)] if match else []) + ["utf-8", "cp1252"]:
        try:
            return body.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def normalise(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip()
    if not re.match(r"(?i)^https?://", url):
        url = "https://" + url.lstrip("/")
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", parts.query, ""))


def bare(host: str) -> str:
    return re.sub(r"^www\.", "", (host or "").lower())


def fetch_page(url: str) -> tuple[str, Page, str]:
    final, body, content_type = get(url, PAGE_LIMIT)
    if "html" not in content_type.lower() and not body.lstrip()[:15].lower().startswith((b"<!doctype", b"<html")):
        raise Refused("not html")
    page = Page()
    page.feed(decode(body, content_type))
    return final, page, page.text()


def site(url: str, sid: str, sources: Path) -> dict:
    """The home page and up to three of the company's own pages, saved as text."""
    out = {"url": url, "status": "ok", "files": [], "page": None, "final": None}
    try:
        final, page, text = fetch_page(url)
    except Refused as refused:
        if str(refused) == "tls" and url.startswith("https://"):
            out["status"] = "tls"
        else:
            out["status"] = str(refused)
        if url.startswith("https://") and out["status"] in ("unreachable", "timeout"):
            try:
                final, page, text = fetch_page("http://" + url[len("https://"):])
                out["status"] = "ok"
            except Refused:
                return out
        else:
            return out
    if PARKED.search(text[:5000]):
        out["status"] = "parked"
        return out
    if len(text) < 80:
        out["status"] = "empty"
    out["final"] = final
    out["page"] = page
    (sources / f"{sid}.web-1.txt").write_text(final + "\n" + text, encoding="utf-8")
    out["files"].append(f"sources/{sid}.web-1.txt")
    host = bare(urllib.parse.urlsplit(final).hostname or "")
    chosen, seen = [], {final.rstrip("/")}
    for href in page.links:
        link = urllib.parse.urljoin(final, html.unescape(href)).split("#")[0]
        parts = urllib.parse.urlsplit(link)
        if parts.scheme not in ("http", "https") or bare(parts.hostname or "") != host:
            continue
        if link.rstrip("/") in seen or not LINK_WORDS.search(parts.path):
            continue
        if re.search(r"(?i)\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4)$", parts.path):
            continue
        seen.add(link.rstrip("/"))
        chosen.append(link)
        if len(chosen) == 3:
            break
    for n, link in enumerate(chosen, start=2):
        try:
            final2, _, text2 = fetch_page(link)
        except Refused:
            continue
        if len(text2) >= 80:
            name = f"{sid}.web-{len(out['files']) + 1}.txt"
            (sources / name).write_text(final2 + "\n" + text2, encoding="utf-8")
            out["files"].append(f"sources/{name}")
    return out


def search(query: str) -> list[dict]:
    with SEARCH_LOCK:
        wait = 2.0 - (time.time() - LAST_SEARCH[0])
        if wait > 0:
            time.sleep(wait)
        encoded = urllib.parse.quote(query)
        command = ["ssh", "-o", "BatchMode=yes", "-o", "ClearAllForwardings=yes", "zm",
                   f"docker exec zeromail-searxng wget -qO- \"http://127.0.0.1:8080/search?q={encoded}&format=json\""]
        try:
            done = subprocess.run(command, capture_output=True, timeout=60)
            LAST_SEARCH[0] = time.time()
            return json.loads(done.stdout.decode("utf-8", errors="replace")).get("results", [])[:8]
        except (subprocess.TimeoutExpired, json.JSONDecodeError, ValueError):
            LAST_SEARCH[0] = time.time()
            return []


def squash_name(name: str) -> str:
    name = re.sub(r"(?i)\b(inc|ltd|llc|llp|pte|sdn|bhd|co|corp|company|limited|jsc|gmbh|tbk|pt|group)\b\.?", " ", name)
    return re.sub(r"[^a-z0-9]", "", name.lower())


def matching_result(results: list[dict], names: list[str]) -> str | None:
    keys = [k for k in (squash_name(n) for n in names) if len(k) >= 4]
    for result in results:
        url = result.get("url") or ""
        host = bare(urllib.parse.urlsplit(url).hostname or "")
        if not host or any(s in host for s in SOCIAL):
            continue
        label = re.sub(r"[^a-z0-9]", "", host.split(".")[0])
        if len(label) < 4:
            continue
        if any(k == label or k.startswith(label) or label.startswith(k) for k in keys):
            return urllib.parse.urlunsplit(("https", urllib.parse.urlsplit(url).netloc, "/", "", ""))
    return None


def image(url: str) -> tuple[bytes, Image.Image, str]:
    if url.lower().split("?")[0].endswith(".svg"):
        raise Refused("svg")
    _, body, content_type = get(url, IMAGE_LIMIT)
    if "svg" in content_type.lower():
        raise Refused("svg")
    try:
        picture = Image.open(io.BytesIO(body))
        picture.load()
    except Exception as error:  # Pillow raises many kinds for a body that is not an image
        raise Refused("not an image") from error
    if picture.format == "ICO":
        sizes = sorted(picture.info.get("sizes", []) or [picture.size], key=lambda s: s[0] * s[1])
        picture.size = sizes[-1]
        picture.load()
    return body, picture, picture.format or ""


def store(body: bytes, picture: Image.Image, form: str, path_no_ext: Path) -> Path:
    if form in ("PNG", "JPEG", "WEBP"):
        path = path_no_ext.with_suffix("." + ("jpg" if form == "JPEG" else form.lower()))
        path.write_bytes(body)
    else:
        path = path_no_ext.with_suffix(".png")
        buffer = io.BytesIO()
        picture.convert("RGBA").save(buffer, "PNG")
        if buffer.tell() > IMAGE_LIMIT:
            raise Refused("too large")
        path.write_bytes(buffer.getvalue())
    return path


def icon_size(sizes: str) -> int:
    best = 0
    for token in sizes.split():
        match = re.match(r"(\d+)x(\d+)", token)
        if match:
            best = max(best, min(int(match.group(1)), int(match.group(2))))
    return best


def logo_candidates(final: str, page: Page) -> list[tuple[str, str]]:
    out = []
    if page.manifest:
        try:
            _, body, _ = get(urllib.parse.urljoin(final, page.manifest), 512 * 1024)
            icons = json.loads(body.decode("utf-8", errors="replace")).get("icons", [])
            icons = sorted(icons, key=lambda i: icon_size(i.get("sizes", "")), reverse=True)
            for icon in icons:
                if icon_size(icon.get("sizes", "")) >= 192 and icon.get("src"):
                    out.append(("manifest", urllib.parse.urljoin(urllib.parse.urljoin(final, page.manifest),
                                                                 icon["src"])))
                    break
        except (Refused, ValueError, AttributeError):
            pass
    for rel, sizes, href in page.icons:
        if "apple-touch-icon" in rel:
            out.append(("apple-touch-icon", urllib.parse.urljoin(final, href)))
    for rel, sizes, href in sorted(page.icons, key=lambda i: icon_size(i[1]), reverse=True):
        if "apple" not in rel and icon_size(sizes) >= 128:
            out.append(("icon", urllib.parse.urljoin(final, href)))
    for src in page.images[:3]:
        out.append(("img-logo", urllib.parse.urljoin(final, html.unescape(src))))
    host = bare(urllib.parse.urlsplit(final).hostname or "")
    out.append(("google-favicon", f"https://www.google.com/s2/favicons?domain={host}&sz=256"))
    return out


def pick_logo(final: str, page: Page, org_id: str, images: Path, rejected: list) -> dict | None:
    for source, url in logo_candidates(final, page):
        try:
            body, picture, form = image(url)
        except Refused as refused:
            rejected.append({"kind": "logo", "source": source, "url": url, "reason": str(refused)})
            continue
        width, height = picture.size
        if min(width, height) < 128:
            rejected.append({"kind": "logo", "source": source, "url": url, "reason": f"small {width}x{height}"})
            continue
        if not 0.5 <= width / height <= 2:
            rejected.append({"kind": "logo", "source": source, "url": url, "reason": f"shape {width}x{height}"})
            continue
        try:
            path = store(body, picture, form, images / f"{org_id}.logo")
        except Refused as refused:
            rejected.append({"kind": "logo", "source": source, "url": url, "reason": str(refused)})
            continue
        return {"file": f"images/{path.name}", "url": url, "source": source, "size": [width, height],
                "sha": hashlib.sha256(path.read_bytes()).hexdigest()}
    return None


def pick_cover(final: str, page: Page, sid: str, images: Path, logo: dict | None, rejected: list) -> dict | None:
    for key in ("og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src"):
        if key not in page.meta:
            continue
        url = urllib.parse.urljoin(final, html.unescape(page.meta[key]))
        if logo and url == logo["url"]:
            rejected.append({"kind": "cover", "source": key, "url": url, "reason": "same as logo"})
            continue
        try:
            body, picture, form = image(url)
        except Refused as refused:
            rejected.append({"kind": "cover", "source": key, "url": url, "reason": str(refused)})
            continue
        width, height = picture.size
        if width < 600 or not 1.3 <= width / height <= 2.5:
            rejected.append({"kind": "cover", "source": key, "url": url, "reason": f"shape {width}x{height}"})
            continue
        if logo and (hashlib.sha256(body).hexdigest() == logo["sha"] or [width, height] == logo["size"]):
            rejected.append({"kind": "cover", "source": key, "url": url, "reason": "same as logo"})
            continue
        try:
            path = store(body, picture, form, images / f"{sid}.cover")
        except Refused as refused:
            rejected.append({"kind": "cover", "source": key, "url": url, "reason": str(refused)})
            continue
        return {"file": f"images/{path.name}", "url": url, "source": key, "size": [width, height]}
    return None


def deck(record: dict, sources: Path) -> str | None:
    if not record.get("deck_key"):
        return None
    out = sources / f"{record['id']}.deck.txt"
    if not out.exists():
        source = DECKS / record["deck_key"]
        if not source.is_file():
            return None
        try:
            subprocess.run([PDFTOTEXT, "-layout", str(source), str(out)], capture_output=True, timeout=120)
        except subprocess.TimeoutExpired:
            return None
    return f"sources/{out.name}" if out.exists() and out.stat().st_size > 0 else None


def one(record: dict, work: Path) -> dict:
    sid = record["id"]
    sources, images = work / "sources", work / "images"
    result = {"id": sid, "org_id": record["org_id"], "name": record["name"], "deck": deck(record, sources),
              "site": None, "via_search": False, "files": [], "logo": None, "cover": None, "rejected": []}
    url = normalise(record.get("website"))
    found = site(url, sid, sources) if url else {"status": "missing", "files": [], "page": None}
    if found["status"] not in ("ok", "empty"):
        names = [record["name"]] + ([record["org_name"]] if record.get("org_name") != record["name"] else [])
        query = f'"{record["name"]}"' + (f' {record["org_name"]}' if record.get("org_name") != record["name"] else "")
        results = search(query)
        (sources / f"{sid}.search.json").write_text(json.dumps(results, ensure_ascii=False, indent=1),
                                                    encoding="utf-8")
        result["files"].append(f"sources/{sid}.search.json")
        match = matching_result(results, names)
        if match and (not url or bare(urllib.parse.urlsplit(match).hostname) != bare(urllib.parse.urlsplit(url).hostname)):
            alternative = site(match, sid, sources)
            if alternative["status"] in ("ok", "empty"):
                result["via_search"] = True
                found = alternative
    result["site"] = {"url": url, "status": found["status"], "final": found.get("final")}
    result["files"] += found["files"]
    page = found.get("page")
    if page is not None and found.get("final"):
        if not record.get("logo_file_id"):
            result["logo"] = pick_logo(found["final"], page, record["org_id"], images, result["rejected"])
        if not record.get("cover_file_id"):
            result["cover"] = pick_cover(found["final"], page, sid, images, result["logo"], result["rejected"])
    return result


def main() -> None:
    records = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    work = Path(sys.argv[2])
    for folder in ("sources", "images", "state"):
        (work / folder).mkdir(parents=True, exist_ok=True)
    log = open(work / "fetch.log", "a", encoding="utf-8")
    todo = [r for r in records if not (work / "state" / f"{r['id']}.json").exists()]
    started, done = time.time(), len(records) - len(todo)
    log.write(f"{time.strftime('%H:%M:%S')} start: {len(todo)} to do, {done} done before\n")
    log.flush()
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(one, r, work): r for r in todo}
        for future in as_completed(futures):
            record = futures[future]
            try:
                result = future.result()
            except Exception as error:  # one startup failing must not stop the run
                result = {"id": record["id"], "org_id": record["org_id"], "name": record["name"],
                          "error": f"{type(error).__name__}: {error}"}
            (work / "state" / f"{record['id']}.json").write_text(json.dumps(result, ensure_ascii=False, indent=1),
                                                                 encoding="utf-8")
            done += 1
            if done % 50 == 0:
                log.write(f"{time.strftime('%H:%M:%S')} {done}/{len(records)} "
                          f"({time.time() - started:.0f}s)\n")
                log.flush()
    states = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((work / "state").glob("*.json"))]
    (work / "fetch.json").write_text(json.dumps(states, ensure_ascii=False, indent=1), encoding="utf-8")
    log.write(f"{time.strftime('%H:%M:%S')} finished: {len(states)} in {time.time() - started:.0f}s\n")
    log.close()


if __name__ == "__main__":
    main()
