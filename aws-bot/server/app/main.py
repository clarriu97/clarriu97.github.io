"""Contract (matches worker/src/index.ts exactly, so the frontend can point
at either backend via PUBLIC_CHAT_ENDPOINT with no code change):

  POST /chat  { messages: [{ role: "user"|"assistant", content: string }], turnstileToken: string }
  -> plain-text response, the assistant's reply (not streamed — see issue #2)

Stateless: no server-side session storage. The client keeps the transcript
(localStorage) and resends it each turn, same as the Worker.
"""

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from . import bedrock, guardrails

app = FastAPI()

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:4321").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

MAX_MESSAGES = 20
MAX_CHARS_PER_MESSAGE = 2000


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    turnstileToken: str = Field(min_length=1)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@app.post("/chat")
def chat(req: ChatRequest, request: Request):
    ip = _client_ip(request)

    if not guardrails.verify_turnstile(req.turnstileToken, ip):
        return PlainTextResponse("Verification failed", status_code=403)

    try:
        allowed = guardrails.check_rate_limit(ip)
    except Exception:
        allowed = False  # fail closed — a DynamoDB blip shouldn't open the gate
    if not allowed:
        return PlainTextResponse("Too many requests, try again later", status_code=429)

    clean = []
    for m in req.messages:
        if m.role not in ("user", "assistant"):
            continue
        content = m.content[:MAX_CHARS_PER_MESSAGE].strip()
        if content:
            clean.append({"role": m.role, "content": content})
    if not clean:
        return PlainTextResponse("No usable messages", status_code=400)
    trimmed = clean[-MAX_MESSAGES:]

    try:
        reply = bedrock.chat(trimmed)
    except Exception:
        return PlainTextResponse("Model call failed", status_code=502)

    return PlainTextResponse(reply)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
