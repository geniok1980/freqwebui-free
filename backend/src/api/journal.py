"""Trading Journal API — CRUD + шаблон + оценка сигнала (/journal)."""

from datetime import date, datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.bot import Bot
from src.models.metrics import BotMetrics
from src.models.journal import TradeJournal
from src.schemas.journal import (
    JournalCreate,
    JournalData,
    JournalListResponse,
    JournalResponse,
    JournalTemplateRequest,
    JournalTemplateResponse,
    JournalUpdate,
    ScoreSignalRequest,
    ScoreSignalResponse,
)

router = APIRouter()


def _model_to_data(j: TradeJournal) -> JournalData:
    """Преобразовать модель в Pydantic схему."""
    return JournalData(
        id=j.id,
        user_id=j.user_id,
        bot_id=j.bot_id,
        entry_date=j.entry_date,
        entry_type=j.entry_type,
        title=j.title,
        content_md=j.content_md,
        metrics_json=j.metrics_json,
        signals_json=j.signals_json,
        tags=j.tags or [],
        is_pinned=j.is_pinned,
        created_at=j.created_at,
        updated_at=j.updated_at,
    )


@router.get("", response_model=JournalListResponse)
async def list_journal(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200, description="Максимальное количество"),
    offset: int = Query(0, ge=0, description="Смещение"),
    entry_type: Optional[str] = Query(None, description="Фильтр по типу записи"),
    bot_id: Optional[str] = Query(None, description="Фильтр по bot_id"),
) -> JournalListResponse:
    """Список записей журнала с фильтрацией."""
    query = (
        select(TradeJournal)
        .where(TradeJournal.user_id == current_user.id)
    )
    count_base = (
        select(func.count())
        .select_from(TradeJournal)
        .where(TradeJournal.user_id == current_user.id)
    )

    if entry_type:
        query = query.where(TradeJournal.entry_type == entry_type)
        count_base = count_base.where(TradeJournal.entry_type == entry_type)
    if bot_id:
        query = query.where(TradeJournal.bot_id == bot_id)
        count_base = count_base.where(TradeJournal.bot_id == bot_id)

    query = query.order_by(desc(TradeJournal.created_at))

    count_result = await db.execute(count_base)
    total = count_result.scalar() or 0

    result = await db.execute(query.offset(offset).limit(limit))
    items = list(result.scalars())

    return JournalListResponse(
        data=[_model_to_data(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=JournalResponse, status_code=201)
async def create_journal(
    body: JournalCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JournalResponse:
    """Создать новую запись журнала."""
    journal = TradeJournal(
        user_id=current_user.id,
        bot_id=body.bot_id,
        entry_date=body.entry_date,
        entry_type=body.entry_type,
        title=body.title,
        content_md=body.content_md,
        metrics_json=body.metrics_json,
        signals_json=body.signals_json,
        tags=body.tags,
        is_pinned=body.is_pinned,
    )
    db.add(journal)
    await db.commit()
    await db.refresh(journal)
    return JournalResponse(data=_model_to_data(journal))


@router.put("/{journal_id}", response_model=JournalResponse)
async def update_journal(
    journal_id: str,
    body: JournalUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JournalResponse:
    """Обновить запись журнала (только свою)."""
    result = await db.execute(
        select(TradeJournal).where(
            TradeJournal.id == journal_id,
            TradeJournal.user_id == current_user.id,
        )
    )
    journal = result.scalar_one_or_none()
    if not journal:
        raise HTTPException(status_code=404, detail="Запись журнала не найдена")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(journal, key, value)

    await db.commit()
    await db.refresh(journal)
    return JournalResponse(data=_model_to_data(journal))


@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Удалить запись журнала (только свою)."""
    result = await db.execute(
        delete(TradeJournal).where(
            TradeJournal.id == journal_id,
            TradeJournal.user_id == current_user.id,
        )
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Запись журнала не найдена")

    return {"status": "success", "message": "Запись журнала удалена"}


@router.post("/template", response_model=JournalTemplateResponse)
async def generate_template(
    body: JournalTemplateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JournalTemplateResponse:
    """Сгенерировать шаблон записи журнала на основе данных бота."""
    # Получаем бота
    bot_result = await db.execute(select(Bot).where(Bot.id == body.bot_id))
    bot = bot_result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Бот не найден")

    # Получаем последнюю метрику
    metrics_result = await db.execute(
        select(BotMetrics)
        .where(BotMetrics.bot_id == bot.id)
        .order_by(desc(BotMetrics.timestamp))
        .limit(1)
    )
    metrics = metrics_result.scalar_one_or_none()

    today = date.today()
    today_str = today.strftime("%d.%m.%Y")

    title = f"Обзор {bot.name} — {today_str}"
    entry_type = "daily"

    metrics_data: dict = {}
    if metrics:
        metrics_data = {
            "profit_pct": float(metrics.profit_pct) if metrics.profit_pct else 0,
            "balance": float(metrics.balance) if metrics.balance else 0,
            "drawdown": float(metrics.drawdown) if metrics.drawdown else 0,
            "open_positions": metrics.open_positions,
            "closed_trades": metrics.closed_trades,
            "win_rate": float(metrics.win_rate) if metrics.win_rate else 0,
        }

    strategy_line = f"- Стратегия: {bot.strategy or 'не указана'}"
    exchange_line = f"- Биржа: {bot.exchange or 'не указана'}"
    mode_line = f"- Режим: {'Dry-run' if bot.is_dryrun else 'Live'}"

    content_md = f"""# {title}

## Информация о боте
- Бот: {bot.name}
{strategy_line}
{exchange_line}
{mode_line}

## Показатели
- Прибыль: {metrics_data.get('profit_pct', 0):.2f}%
- Баланс: {metrics_data.get('balance', 0):.2f}
- Просадка: {metrics_data.get('drawdown', 0):.2f}%
- Открытых позиций: {metrics_data.get('open_positions', 0)}
- Закрытых сделок: {metrics_data.get('closed_trades', 0)}
- Win Rate: {metrics_data.get('win_rate', 0):.1f}%

## Заметки
- 

## Действия
- [ ] Проверить открытые позиции
- [ ] Оценить рыночные условия
- [ ] Проверить стоп-лоссы
"""

    return JournalTemplateResponse(
        title=title,
        entry_date=today.isoformat(),
        entry_type=entry_type,
        content_md=content_md,
        metrics=metrics_data,
    )


@router.post("/score-signal", response_model=ScoreSignalResponse)
async def score_signal(
    body: ScoreSignalRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScoreSignalResponse:
    """Оценить качество торгового сигнала на основе исторических данных."""
    # Ищем сделки по паре и боту в таблице trades
    result = await db.execute(
        text("""
            SELECT
                COUNT(*) as total_trades,
                COUNT(CASE WHEN profit_pct > 0 THEN 1 END) as winning_trades,
                AVG(profit_pct) as avg_profit,
                AVG(CASE WHEN profit_pct > 0 THEN profit_pct ELSE NULL END) as avg_win,
                AVG(CASE WHEN profit_pct <= 0 THEN profit_pct ELSE NULL END) as avg_loss
            FROM trades
            WHERE bot_id = :bot_id AND pair = :pair
        """),
        {"bot_id": body.bot_id, "pair": body.pair},
    )
    row = result.fetchone()

    total_trades = row[0] if row and row[0] else 0
    winning_trades = row[1] if row and row[1] else 0
    avg_profit = float(row[2]) if row and row[2] else 0.0
    avg_win = float(row[3]) if row and row[3] else 0.0
    avg_loss = float(row[4]) if row and row[4] else 0.0

    # Расчёт факторов
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

    # Оценка win_rate
    if win_rate >= 60:
        wr_score = 8.0
    elif win_rate >= 50:
        wr_score = 6.0
    elif win_rate >= 40:
        wr_score = 4.0
    else:
        wr_score = 2.0

    # Profit factor (упрощённый)
    if avg_win > 0 and abs(avg_loss) > 0:
        profit_factor = avg_win / abs(avg_loss)
    elif avg_win > 0:
        profit_factor = 3.0
    else:
        profit_factor = 0.0

    if profit_factor >= 2.0:
        pf_score = 8.0
    elif profit_factor >= 1.5:
        pf_score = 6.0
    elif profit_factor >= 1.0:
        pf_score = 4.0
    else:
        pf_score = 2.0

    # Оценка достаточности данных
    if total_trades >= 30:
        data_score = 8.0
    elif total_trades >= 10:
        data_score = 5.0
    else:
        data_score = 2.0

    total_score = round((wr_score * 0.5 + pf_score * 0.3 + data_score * 0.2), 1)

    if total_score >= 7.0:
        rating = "Отличный сигнал"
    elif total_score >= 5.0:
        rating = "Хороший сигнал"
    elif total_score >= 3.0:
        rating = "Средний сигнал"
    else:
        rating = "Слабый сигнал"

    return ScoreSignalResponse(
        score=total_score,
        rating=rating,
        factors={
            "pair": body.pair,
            "timeframe": body.timeframe,
            "signal_type": body.signal_type,
            "total_trades": total_trades,
            "win_rate": round(win_rate, 1),
            "avg_profit": round(avg_profit, 4),
            "avg_win": round(avg_win, 4),
            "avg_loss": round(avg_loss, 4),
            "profit_factor": round(profit_factor, 2),
            "win_rate_score": wr_score,
            "profit_factor_score": pf_score,
            "data_score": data_score,
        },
    )
