from __future__ import annotations

import gzip
import io
import os
import re
from typing import Any

DEFAULT_PERMISSIVE_LICENSES = {
    "0BSD",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC0-1.0",
    "ISC",
    "MIT",
    "MPL-2.0",
    "Unlicense",
    "Zlib",
}


class StackAccessRequired(PermissionError):
    """The Stack metadata or Software Heritage content needs an access grant/credentials."""


def stack_credentials_present() -> bool:
    return bool(
        os.environ.get("STACK_V2_AWS_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY_ID")
    ) and bool(
        os.environ.get("STACK_V2_AWS_SECRET_ACCESS_KEY") or os.environ.get("AWS_SECRET_ACCESS_KEY")
    )


def _license_set(row: dict[str, Any]) -> set[str]:
    value = row.get("detected_licenses") or row.get("license") or []
    if isinstance(value, str):
        values = re.split(r"[,;| ]+", value)
    elif isinstance(value, (list, tuple, set)):
        values = list(value)
    else:
        values = []
    return {str(item).strip() for item in values if str(item).strip()}


def has_allowed_stack_license(
    row: dict[str, Any], allowlist: set[str] | None = None
) -> bool:
    """Require every detected SPDX license to be in the explicit permissive allowlist."""
    detected = _license_set(row)
    permitted = DEFAULT_PERMISSIVE_LICENSES if allowlist is None else allowlist
    return bool(detected) and detected.issubset(permitted)


_S3_CLIENT = None


def _client():
    global _S3_CLIENT
    if _S3_CLIENT is not None:
        return _S3_CLIENT
    if not stack_credentials_present():
        raise StackAccessRequired(
            "The Stack v2 requires HF dataset approval plus Software Heritage/INRIA AWS credentials"
        )
    try:
        import boto3
    except Exception as exc:
        raise RuntimeError("boto3 is required for The Stack v2 content reader") from exc

    access_key = os.environ.get("STACK_V2_AWS_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("STACK_V2_AWS_SECRET_ACCESS_KEY") or os.environ.get("AWS_SECRET_ACCESS_KEY")
    session_token = os.environ.get("STACK_V2_AWS_SESSION_TOKEN") or os.environ.get("AWS_SESSION_TOKEN")
    region = os.environ.get("STACK_V2_AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
    session = boto3.Session(
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        aws_session_token=session_token,
        region_name=region,
    )
    _S3_CLIENT = session.client("s3", region_name=region)
    return _S3_CLIENT


def fetch_stack_content(
    row: dict[str, Any],
    *,
    max_bytes: int = 524_288,
    client: Any = None,
) -> str | None:
    """Fetch one licensed text file from Software Heritage; never mirrors the full bucket."""
    blob_id = str(row.get("blob_id") or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{40}", blob_id):
        return None

    encoding = str(row.get("src_encoding") or "utf-8").strip()
    if not encoding:
        encoding = "utf-8"

    s3 = client or _client()
    try:
        response = s3.get_object(Bucket="softwareheritage", Key=f"content/{blob_id}")
        body = response["Body"]
        try:
            with gzip.GzipFile(fileobj=body, mode="rb") as compressed:
                raw = compressed.read(max(1, int(max_bytes)) + 1)
        finally:
            close = getattr(body, "close", None)
            if callable(close):
                close()
    except Exception as exc:
        response = getattr(exc, "response", {}) or {}
        error = response.get("Error", {}) if isinstance(response, dict) else {}
        code = str(error.get("Code", ""))
        message = str(error.get("Message", exc))
        if code in {"AccessDenied", "403", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken", "InvalidToken", "RequestExpired"}:
            raise StackAccessRequired(f"Software Heritage denied content access: {code} {message[:160]}") from exc
        raise

    if len(raw) > int(max_bytes) or not raw:
        return None
    try:
        text = raw.decode(encoding, errors="strict")
    except (LookupError, UnicodeDecodeError):
        return None
    text = text.replace("\x00", "")
    if len(text.strip()) < 24:
        return None
    # Reject binary/mixed payloads even when their extension is misleading.
    if sum(1 for ch in text if ord(ch) < 32 and ch not in "\n\r\t") / max(1, len(text)) > 0.01:
        return None
    return text
