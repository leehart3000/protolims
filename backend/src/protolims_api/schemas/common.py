"""Schema pieces shared by several resources."""

from typing import Annotated

from pydantic import Field

CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"

# A short, URL-safe identifier such as "TCGA" or "TCGA-BRCA".
Code = Annotated[str, Field(min_length=1, max_length=64, pattern=CODE_PATTERN)]

# Names of subjects and samples often come from outside sources and may contain
# spaces (e.g. the cell line "Hs 578T"). They can't contain a slash, because they appear
# in web addresses, or start or end with a space.
Name = Annotated[str, Field(min_length=1, max_length=200, pattern=r"^[^/\s](?:[^/]*[^/\s])?$")]
