"""Bedrock Runtime client: builds the system prompt from the dossier and calls Nova.

Non-streaming for now (API Gateway can't stream) — see issue #2 for the
Lambda Function URL migration that unblocks token-by-token responses.
"""

import os

import boto3

from .dossier import load_dossier_text, load_style

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "eu.amazon.nova-lite-v1:0")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION_NAME", "eu-west-1"))
    return _client


def build_system_prompt() -> str:
    return f"""You are the assistant on Carlos Larriu's personal website (larri.dev). Your only
job is to answer visitors' questions about Carlos: his background, experience,
projects, skills, and how to get in touch.

Rules:
- Only answer questions about Carlos and his professional work. If someone asks
  about anything else, say briefly that you only cover Carlos's background and
  redirect.
- Never invent or guess a fact, a metric, or a URL that isn't in the dossier below.
- Quote contact links character-for-character from the dossier — never construct
  or paraphrase one.
- Speak about Carlos in the third person, as his assistant.

Style notes:
{load_style()}

# Dossier

{load_dossier_text()}
"""


def chat(messages: list[dict]) -> str:
    """messages: [{"role": "user"|"assistant", "content": str}, ...] — no system message."""
    client = _get_client()
    response = client.converse(
        modelId=MODEL_ID,
        system=[{"text": build_system_prompt()}],
        messages=[{"role": m["role"], "content": [{"text": m["content"]}]} for m in messages],
        inferenceConfig={"maxTokens": 512, "temperature": 0.5},
    )
    return response["output"]["message"]["content"][0]["text"]
