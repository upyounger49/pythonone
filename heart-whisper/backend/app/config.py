import os
from pydantic_settings import BaseSettings

##全局变量 相当于application.yml
class Settings(BaseSettings):
    dashscope_api_key: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    database_url: str = "sqlite:///./heart_whisper.db"

    model_config = {
        "env_file": f".env.{os.getenv('APP_ENV', 'dev')}",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
