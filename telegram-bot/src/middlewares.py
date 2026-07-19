"""Middleware for the Telegram bot."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, MutableSet

from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery


class AllowedUsersMiddleware(BaseMiddleware):
    """Reject messages from users not in the allowed list.

    ``allowed_ids`` is a mutable set — callers can update it at runtime.
    """

    def __init__(self, allowed_ids: set[int] | list[int] | None = None) -> None:
        self.allowed_ids: set[int] = set(allowed_ids or [])
        super().__init__()

    async def __call__(
        self,
        handler: Callable[[Any, dict[str, Any]], Awaitable[Any]],
        event: Any,
        data: dict[str, Any],
    ) -> Any:
        if not self.allowed_ids:
            return await handler(event, data)

        user_id = None
        if isinstance(event, Message):
            user_id = event.from_user.id if event.from_user else None
        elif isinstance(event, CallbackQuery):
            user_id = event.from_user.id if event.from_user else None

        if user_id and user_id in self.allowed_ids:
            return await handler(event, data)

        if isinstance(event, Message):
            await event.answer("⛔ У вас нет доступа к этому боту.")
        return None
