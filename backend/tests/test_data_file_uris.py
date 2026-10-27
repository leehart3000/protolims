"""Tests for which data file URIs are accepted."""

import pytest
from pydantic import TypeAdapter, ValidationError

from protolims_api.schemas.data_file import Uri

uri = TypeAdapter(Uri)


@pytest.mark.parametrize(
    "value",
    [
        "s3://bucket/path/file.bam",
        "gs://bucket/counts.tsv",
        "az://container/folder/table.csv",
        "https://api.gdc.cancer.gov/data/0004d251-3f70-4395-b175-c94c2f5b1b81",
        "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE70nnn/GSE70138/suppl/data.txt.gz",
        "https://example.org/file?version=2",
    ],
)
def test_safe_uris_are_accepted(value: str) -> None:
    assert uri.validate_python(value) == value


@pytest.mark.parametrize(
    "value",
    [
        "",
        "relative/path",
        "http://example.org/file",
        "javascript:alert(1)",
        "data:text/plain,hello",
        "file:///etc/passwd",
        "ftp://example.org/file",
        "https:///no-host",
        "s3://bucket",
        "s3://bucket/",
        "https://user:password@example.org/file",
        "https://example.org/file?X-Amz-Signature=abc",
        "https://example.org/file?x-goog-signature=abc",
        "https://account.blob.core.windows.net/container/blob?sv=1&sig=abc",
        "https://example.org/has space",
        "https://example.org/" + "a" * 2000,
    ],
)
def test_unsafe_uris_are_rejected(value: str) -> None:
    with pytest.raises(ValidationError):
        uri.validate_python(value)
