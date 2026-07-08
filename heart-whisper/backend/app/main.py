from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.auth import router as auth_router
from .api.conversations import router as conversations_router
from .api.chat import router as chat_router
from .database import engine, Base

##SpringBoot 启动类项目入口，组装所有组件并启动
def create_app() -> FastAPI:
    app = FastAPI(title="Heart Whisper", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(conversations_router)
    app.include_router(chat_router)

    return app


app = create_app()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
