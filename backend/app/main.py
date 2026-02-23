from __future__ import annotations

import logging
import os
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import router as v1_router
from app.config import settings
from app.logging import configure_logging, request_id_ctx


logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    configure_logging(settings.log_level)

    app = FastAPI(title=settings.app_name)

    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY is required")

    # TODO: Add auth and per-user scoping when multi-user support is implemented.

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[settings.request_id_header],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        incoming = request.headers.get(settings.request_id_header)
        request_id = incoming if incoming else str(uuid.uuid4())
        token = request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers[settings.request_id_header] = request_id
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        request_id = request_id_ctx.get()
        return JSONResponse(
            status_code=exc.status_code,
            content={"request_id": request_id, "detail": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = request_id_ctx.get()
        return JSONResponse(
            status_code=422,
            content={"request_id": request_id, "detail": "Validation error"},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = request_id_ctx.get()
        logger.exception("Unhandled exception")
        return JSONResponse(
            status_code=500,
            content={"request_id": request_id, "detail": "Internal server error"},
        )

    app.include_router(v1_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
