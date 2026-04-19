from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, backups, ci, system
from app.config import BACKUPS_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    yield


app = FastAPI(title="Family Admin Routine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(backups.router, prefix="/api", tags=["backups"])
app.include_router(system.router, prefix="/api", tags=["system"])
app.include_router(ci.router, prefix="/api", tags=["ci"])


@app.get("/health")
async def health():
    return {"status": "ok"}
