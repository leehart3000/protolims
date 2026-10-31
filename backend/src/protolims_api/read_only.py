"""The read-only lock (PROTOLIMS_READ_ONLY): when it's on, nothing can be changed.

It's a server setting, so only whoever runs the server can lift it: on Cloud Run, someone
with Google Cloud access, never just a website sign-in or an API token. While it's on,
everything can still be read, and people can still sign in and out, and revoke their own API
tokens (in case one has leaked). An import can still be tried as a dry run, which saves
nothing. Everything else that would change something answers 423 Locked.
"""

import re

from fastapi import HTTPException, status

READ_ONLY_MESSAGE = "This site is read-only at the moment, so nothing can be changed."

# Requests that only read.
READING = frozenset({"GET", "HEAD", "OPTIONS"})

# Other requests allowed while it's on, as (method, path pattern).
ALLOWED = (
    ("POST", re.compile(r"/api/v1/auth/logout")),
    ("DELETE", re.compile(r"/api/v1/auth/me/tokens/[^/]+")),
    # The import itself refuses anything but a dry run (see routers/importing.py).
    ("POST", re.compile(r"/api/v1/projects/[^/]+/studies/[^/]+/import")),
)


def allowed_while_read_only(method: str, path: str) -> bool:
    """Whether a request may go ahead while the site is read-only."""
    if method in READING:
        return True
    return any(method == allowed and pattern.fullmatch(path) for allowed, pattern in ALLOWED)


def read_only_refusal() -> HTTPException:
    return HTTPException(status.HTTP_423_LOCKED, READ_ONLY_MESSAGE)
