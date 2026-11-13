from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, message: str, *, code: str, status_code: int = 500) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="validation_error", status_code=400)


class NotFoundError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="not_found", status_code=404)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, code="unauthorized", status_code=401)


class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "Service unavailable") -> None:
        super().__init__(message, code="service_unavailable", status_code=503)


class ApiError(AppError):
    """Domain error returned through the centralized error envelope.

    Phase 5 services use stable machine-readable codes so API clients can
    distinguish reminder and notification failure modes without parsing
    human-readable messages.
    """

    def __init__(self, code: str, message: str, *, status_code: int) -> None:
        super().__init__(message, code=code, status_code=status_code)


class ReminderNotFoundError(ApiError):
    def __init__(self) -> None:
        super().__init__("REMINDER_NOT_FOUND", "Reminder not found", status_code=404)


class ReminderTodoNotFoundError(ApiError):
    def __init__(self) -> None:
        super().__init__("REMINDER_TODO_NOT_FOUND", "Todo not found", status_code=404)


class ReminderInvalidTimeError(ApiError):
    def __init__(
        self,
        message: str = "Reminder time must be a future timezone-aware value",
    ) -> None:
        super().__init__("REMINDER_INVALID_TIME", message, status_code=422)


class ReminderAlreadyProcessedError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "REMINDER_ALREADY_PROCESSED",
            "Processed reminders cannot be modified",
            status_code=409,
        )


class ReminderAlreadyCancelledError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "REMINDER_ALREADY_CANCELLED",
            "Cancelled reminders cannot be modified",
            status_code=409,
        )


class ReminderPermissionDeniedError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "REMINDER_PERMISSION_DENIED",
            "You do not have permission to access this reminder",
            status_code=403,
        )


class ReminderUserNotMemberError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "REMINDER_USER_NOT_MEMBER",
            "You are not a member of this workspace",
            status_code=403,
        )


class ReminderInvalidStateError(ApiError):
    def __init__(self, message: str = "Reminder is not in a modifiable state") -> None:
        super().__init__("REMINDER_INVALID_STATE", message, status_code=409)


class ReminderDuplicateError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "REMINDER_DUPLICATE",
            "A pending reminder already exists for this time",
            status_code=409,
        )


class NotificationNotFoundError(ApiError):
    def __init__(self) -> None:
        super().__init__("NOTIFICATION_NOT_FOUND", "Notification not found", status_code=404)


class InvalidNotificationCursorError(ApiError):
    def __init__(self, message: str = "Invalid notification cursor") -> None:
        super().__init__("INVALID_NOTIFICATION_CURSOR", message, status_code=400)


class NotificationCursorSignatureInvalidError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "NOTIFICATION_CURSOR_SIGNATURE_INVALID",
            "Notification cursor signature is invalid",
            status_code=400,
        )


class NotificationCursorUserMismatchError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "NOTIFICATION_CURSOR_USER_MISMATCH",
            "Notification cursor does not belong to the current user",
            status_code=400,
        )


class AutomaticReminderDisabledError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            "AUTOMATIC_REMINDER_DISABLED",
            "Automatic due date reminders are disabled",
            status_code=409,
        )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": getattr(request.state, "request_id", None),
            },
        },
    )


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "internal_server_error",
                "message": "An unexpected error occurred.",
                "request_id": getattr(request.state, "request_id", None),
            },
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, generic_error_handler)
