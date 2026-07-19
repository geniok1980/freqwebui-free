# 🧪 Strategy Lab (V6)

Strategy Lab — система для разработки, тестирования и оптимизации торговых стратегий. Интегрирует ftmanager workflow engine.

## Страницы

| Путь | Описание |
|------|----------|
| `/strategy-lab` | Главная Strategy Lab |
| `/strategy-lab/strategies` | Список стратегий |
| `/strategy-lab/workflow/:botId?` | Управление воркфлоу |
| `/strategy-lab/hyperopt/:strategyName?` | Мониторинг гипероптимизации |
| `/strategy-lab/results` | Результаты оптимизации |
| `/backtest` | Все результаты бэктестов |

## Стратегии

Стратегии загружаются из директории `/opt/Multibotdashboard/Strategies` (или из `STRATEGIES_PATH`).

**Сканирование стратегий:**
- Все `.py` файлы в директории стратегий
- Автоматическое определение имени класса стратегии (наследование от `IStrategy`)
- Отображение исходного кода в интерфейсе

### Написание стратегии

Стратегия — стандартный Freqtrade `IStrategy`:

```python
from freqtrade.strategy import IStrategy

class MyStrategy(IStrategy):
    timeframe = '5m'
    minimal_roi = {"0": 0.01}
    stoploss = -0.05

    def populate_indicators(self, dataframe, metadata):
        # Добавьте индикаторы
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        # Сигналы на вход
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        # Сигналы на выход
        return dataframe
```

## Workflow

Workflow Engine управляет жизненным циклом стратегии:

### Режимы работы

| Режим | Описание |
|-------|----------|
| **Backtest** | Запуск бэктеста стратегии на исторических данных |
| **Hyperopt** | Оптимизация параметров стратегии (поиск лучших значений) |
| **Deploy** | Развёртывание оптимизированной стратегии на live-боте |

### Процесс

1. Выберите стратегию из списка
2. Запустите **Backtest** для получения базовых метрик
3. Запустите **Hyperopt** для оптимизации параметров
4. Просмотрите результаты оптимизации
5. **Deploy** — примените лучшие параметры к live-боту

## Hyperopt Monitor

Мониторинг процесса гипероптимизации в реальном времени:

- Прогресс выполнения (текущая эпоха / всего)
- Лучшие результаты на данный момент
- График сходимости оптимизации
- Статус запущенных процессов

## Results

Результаты бэктестов и оптимизаций сохраняются в БД и доступны на странице `/backtest`:

### Сводка

| Метрика | Описание |
|---------|----------|
| Total Strategies | Всего протестировано стратегий |
| Profitable | Прибыльные стратегии |
| Unprofitable | Убыточные стратегии |
| Avg Profit % | Средняя доходность |
| Best Profit % | Лучшая доходность |
| Worst Profit % | Худшая доходность |
| Avg Win Rate | Средний win rate |
| Total Trades | Всего сделок |

### Детальная информация по стратегии

| Метрика | Описание |
|---------|----------|
| Strategy Name | Имя стратегии |
| Timeframe | Таймфрейм |
| Timerange | Диапазон дат |
| Total Profit % | Общая доходность |
| Total Trades | Количество сделок |
| Win Rate | Процент успешных |
| Avg Profit % | Средняя прибыль на сделку |
| Max Drawdown % | Максимальная просадка |
| Sharpe | Коэффициент Шарпа |
| Sortino | Коэффициент Сортино |
| Calmar | Коэффициент Калмара |
| Profit Factor | Фактор прибыли |
| Best / Worst Pair | Лучшая / худшая пара |
| CAGR % | Среднегодовой темп роста |
