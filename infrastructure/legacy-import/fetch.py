"""Fetches the files v1 names, one at a time, and keeps each under a cache so a second run fetches nothing.

Only v1's API and Google's public file addresses are asked, and a redirect is followed only to Google's own download
hosts: any other address is refused before a request is made.
"""

import hashlib
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ALLOWED = ("https://papi.genaifund.ai/attachments/", "https://papi.genaifund.ai/use-cases/attachments/",
           "https://drive.google.com/uc?export=download&id=", "https://docs.google.com/presentation/d/",
           "https://docs.google.com/document/d/")

# The hosts a Google download may redirect to; Docs exports are served from its content hosts.
REDIRECT_HOSTS = ("drive.google.com", "drive.usercontent.google.com", "docs.google.com")
REDIRECT_SUFFIX = ".googleusercontent.com"
NOT_ALLOWED = "redirect to an address not allowed"


class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        host = urllib.parse.urlsplit(newurl).hostname or ""
        if not newurl.startswith("https://") or not (host in REDIRECT_HOSTS or host.endswith(REDIRECT_SUFFIX)):
            raise urllib.error.HTTPError(newurl, code, NOT_ALLOWED, headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(Redirects)
TIMEOUT = 30

MB = 1024 * 1024

# What each purpose accepts, as StorageService and StorageProperties' defaults do.
PURPOSES = {
    "organization_logo": ({"image/png", "image/jpeg", "image/webp"}, 5 * MB, True),
    "solution_deck": ({"application/pdf"}, 100 * MB, False),
    "use_case_attachment": ({
        "application/pdf", "image/png", "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"}, 25 * MB, False),
}

OFFICE = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


EXTENSION = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


@dataclass
class Fetched:
    path: Path
    media_type: str
    size: int
    file_name: str


def media_type(head: bytes, name: str) -> str | None:
    """The type the bytes are, not the type the server says: v1 answers `application/octet-stream`."""
    if head.startswith(b"%PDF"):
        return "application/pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"PK\x03\x04"):
        return OFFICE.get(PurePosixPath(name.lower()).suffix)
    return None


def get(url: str, cache: Path) -> Path:
    if not url.startswith(ALLOWED):
        raise ValueError("not an address on v1's API")
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / hashlib.sha256(url.encode()).hexdigest()
    if target.exists():
        return target
    last: Exception | None = None
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "BeyondPilot legacy import"})
            with OPENER.open(request, timeout=TIMEOUT) as response:
                partial = target.with_suffix(".part")
                with partial.open("wb") as out:
                    shutil.copyfileobj(response, out, 1024 * 1024)
                partial.replace(target)
                return target
        except urllib.error.HTTPError as error:
            if error.msg == NOT_ALLOWED:
                # Google sends a file that is not public to its sign-in page.
                raise RuntimeError("redirected off Google's download hosts, not public") from None
            if 400 <= error.code < 500:
                # Not there, or not public: asking again changes nothing.
                raise RuntimeError(f"HTTP {error.code}") from None
            last = error
            time.sleep(2 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last = error
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"fetch failed: {type(last).__name__}")


def fetch(url: str, purpose: str, name: str | None, cache: Path) -> Fetched:
    """The file at the address, checked against what the purpose accepts.

    Raises ValueError with the reason when the file is refused, RuntimeError when it cannot be fetched.
    """
    path = get(url, cache)
    size = path.stat().st_size
    file_name = (name or PurePosixPath(url).name).strip() or "file"
    with path.open("rb") as handle:
        head = handle.read(4096)
    kind = media_type(head, file_name)
    types, limit, _ = PURPOSES[purpose]
    google = not url.startswith("https://papi.genaifund.ai/")
    if size == 0:
        raise ValueError("empty")
    if google and kind is None:
        # Drive answers a file it will not scan with a warning page instead of the file; it is not bypassed.
        if b"virus scan warning" in head.lower() or b"too large for google to scan" in head.lower():
            raise ValueError("on Google, too large to be scanned, not bypassed")
        raise ValueError("on Google, not public or not a file of this kind")
    if kind is None or kind not in types:
        raise ValueError(f"type {kind or 'unknown'} not accepted")
    if google and name is None:
        # Google's download address names no file.
        file_name = ("deck" if purpose == "solution_deck" else "logo") + EXTENSION[kind]
    if size > limit:
        raise ValueError(f"{size // MB} MB, over the limit")
    return Fetched(path, kind, size, file_name)
