"""
Thin reverse-proxy backend on port 8001.
Forwards all /api/* requests to the Next.js dev server on port 3000.
"""
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEXTJS_URL = "http://127.0.0.1:3000"

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    url = f"{NEXTJS_URL}/{path}"
    headers = dict(request.headers)
    headers.pop("host", None)
    body = await request.body()

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                params=dict(request.query_params),
            )
            return StreamingResponse(
                iter([resp.content]),
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=502)
