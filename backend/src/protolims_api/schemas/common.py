"""Schema pieces shared by several resources."""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"

# Codes that would clash with the website's page addresses, such as /projects/new. Checked
# ignoring case, because the website's addresses ignore case.
RESERVED_CODES = frozenset({"new", "edit"})


def _not_reserved(code: str) -> str:
    """Reject codes that would clash with the website's page addresses."""
    if code.lower() in RESERVED_CODES:
        raise ValueError(f"{code!r} is reserved and can't be used as a code")
    return code


# A short, URL-safe identifier such as "TCGA" or "TCGA-BRCA".
Code = Annotated[
    str, Field(min_length=1, max_length=64, pattern=CODE_PATTERN), AfterValidator(_not_reserved)
]

# Names of subjects and samples often come from outside sources and may contain
# spaces (e.g. the cell line "Hs 578T"). They can't contain a slash, because they appear
# in web addresses, or start or end with a space.
Name = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[^/\s](?:[^/]*[^/\s])?$")]


class Page[T](BaseModel):
    """One page of a list, with the total number of items that match."""

    items: list[T]
    total: int
