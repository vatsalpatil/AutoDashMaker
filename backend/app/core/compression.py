"""gzip for API responses (big result sets are mostly repetitive JSON, ~5-10x smaller) except streams.

Starlette 0.38 would buffer Server-Sent Events inside the compressor, so streaming endpoints are passed through.
"""
from starlette.middleware.gzip import GZipMiddleware
from starlette.types import Receive, Scope, Send

STREAM_PATHS = ("/api/ai/agent", "/api/studio/stream")


class ApiGZipMiddleware(GZipMiddleware):
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"].startswith(STREAM_PATHS):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)
