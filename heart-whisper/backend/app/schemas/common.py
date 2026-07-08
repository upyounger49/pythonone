"""API 响应规范：统一响应格式、分页、错误码枚举。"""

from enum import IntEnum
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel


# ---- 泛型类型变量 ----
T = TypeVar("T")


# ---- 错误码枚举 ----
class ErrorCode(IntEnum):
    """统一错误码，编码规则：{HTTP状态码}{2位序号}。"""

    # 成功
    SUCCESS = 0

    # 400 参数校验 / 业务逻辑错误
    VALIDATION_ERROR = 40001

    # 401 认证 / 授权错误
    AUTH_FAILED = 40101
    TOKEN_EXPIRED = 40102

    # 403 权限不足
    FORBIDDEN = 40301

    # 404 资源不存在
    RESOURCE_NOT_FOUND = 40401

    # 409 资源冲突
    USERNAME_TAKEN = 40901

    # 422 请求格式错误
    UNPROCESSABLE_ENTITY = 42201

    # 500 服务端错误
    INTERNAL_ERROR = 50001
    LLM_ERROR = 50002


# ---- 通用响应模型 ----
class ApiResponse(BaseModel, Generic[T]):
    """统一成功响应包装。

    示例：
        ApiResponse[UserOut](data=user)
        ApiResponse[PaginatedData[MessageOut]](data=paginated)
    """

    code: int = ErrorCode.SUCCESS
    message: str = "ok"
    data: Optional[T] = None


class ErrorResponse(BaseModel):
    """统一错误响应模型。"""

    code: int
    message: str
    detail: Optional[str] = None


class PaginatedData(BaseModel, Generic[T]):
    """分页数据容器。

    示例：
        PaginatedData(items=[...], total=42, page=1, page_size=20)
    """

    items: list[T]
    total: int
    page: int
    page_size: int
