"""Guardrail Layer B — same two checks as worker/src/guardrails.ts, ported.

1. Turnstile: proves the caller ran real browser JS, blocks scripted traffic.
2. Rate limit (DynamoDB, atomic per-counter via conditional UpdateItem —
   stricter than the Worker's KV version, which admits a get-then-put race).
"""

import os
import time
import urllib.parse
import urllib.request

import boto3
from botocore.exceptions import ClientError

RATE_LIMIT_PER_MINUTE = 4
RATE_LIMIT_PER_DAY = 15

TABLE_NAME = os.environ.get("RATE_LIMIT_TABLE")
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY")

_table = None


def _get_table():
    global _table
    if _table is None:
        region = os.environ.get("AWS_REGION_NAME", "eu-west-1")
        _table = boto3.resource("dynamodb", region_name=region).Table(TABLE_NAME)
    return _table


def verify_turnstile(token: str, ip: str) -> bool:
    if not TURNSTILE_SECRET_KEY:
        return False
    data = urllib.parse.urlencode(
        {"secret": TURNSTILE_SECRET_KEY, "response": token, "remoteip": ip}
    ).encode()
    req = urllib.request.Request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        data=data,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            import json

            return json.loads(res.read()).get("success") is True
    except Exception:
        return False


def _increment_counter(pk: str, limit: int, ttl_seconds: int) -> bool:
    """Atomically increments a fixed-window counter. Returns False if it's at the limit."""
    try:
        _get_table().update_item(
            Key={"pk": pk},
            UpdateExpression="ADD hits :one SET #ttl = if_not_exists(#ttl, :ttl)",
            ConditionExpression="attribute_not_exists(hits) OR hits < :limit",
            ExpressionAttributeNames={"#ttl": "ttl"},
            ExpressionAttributeValues={
                ":one": 1,
                ":limit": limit,
                ":ttl": int(time.time()) + ttl_seconds,
            },
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def check_rate_limit(ip: str) -> bool:
    if not TABLE_NAME:
        return False
    now = int(time.time())
    minute_bucket = now // 60
    day_bucket = now // 86400

    if not _increment_counter(f"min#{ip}#{minute_bucket}", RATE_LIMIT_PER_MINUTE, 60):
        return False
    if not _increment_counter(f"day#{ip}#{day_bucket}", RATE_LIMIT_PER_DAY, 86400):
        return False
    return True
