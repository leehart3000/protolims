"""Schema pieces shared by several resources."""

from typing import Annotated

from pydantic import Field

CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"

# A short, URL-safe identifier such as "TCGA" or "TCGA-BRCA".
Code = Annotated[str, Field(min_length=1, max_length=64, pattern=CODE_PATTERN)]
