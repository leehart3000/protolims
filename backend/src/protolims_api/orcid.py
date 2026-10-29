"""ORCID iDs: checking that one is well formed, including its check digit."""

import re
from typing import Annotated

from pydantic import AfterValidator

ORCID_ID_PATTERN = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")


def check_digit(digits: str) -> str:
    """The check digit for the first 15 digits of an ORCID iD (ISO 7064 MOD 11-2)."""
    total = 0
    for digit in digits:
        total = (total + int(digit)) * 2
    result = (12 - total % 11) % 11
    return "X" if result == 10 else str(result)


def is_orcid_id(value: str) -> bool:
    """Whether value looks like an ORCID iD, e.g. 0000-0002-1825-0097, and its check digit
    is right. (It doesn't check that the iD exists.)"""
    if not ORCID_ID_PATTERN.match(value):
        return False
    digits = value.replace("-", "")
    return check_digit(digits[:15]) == digits[15]


def _valid(value: str) -> str:
    if not is_orcid_id(value):
        raise ValueError(f"{value!r} isn't a valid ORCID iD, such as 0000-0002-1825-0097")
    return value


# An ORCID iD, checked, for request bodies, paths and settings.
OrcidId = Annotated[str, AfterValidator(_valid)]
