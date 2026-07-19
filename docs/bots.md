# 🤖 Управление ботами

## Добавление ботов

### Авто-обнаружение (Discovery)

FreqDash автоматически сканирует доступные Freqtrade-боты каждые 60 секунд двумя способами:

**Docker Discovery**
- Сканирует запущенные Docker-контейнеры через Docker socket (`/var/run/docker.sock`)
- Ищет контейнеры с образом `freqtradeorg/freqtrade`
- Автоматически определяет API URL, порт и статус контейнера
- Требует установки Docker label `com.freqtrade.bot_name` на контейнере

**Filesystem Discovery**
- Сканирует файловую систему в поиске баз данных `tradesv3.sqlite`
- Пути сканирования по умолчанию: `/opt/freqtrade/*/user_data`
- Подходит для baremetal-установок Freqtrade

**Проверить статус Discovery:**
- Страница Discovery (`/discovery`)
- Отображает: включен ли Docker, Filesystem, время последнего скана, когда следующий

**Ручной запуск сканирования:**
Нажмите **"Trigger Discovery"** на странице Discovery.

### Ручная регистрация

Если бот не обнаружился автоматически:

1. Перейдите в **Bots → Add Bot**
2. Заполните:
   - **Name** — уникальное имя бота (латиница, цифры, `-`, `_`)
   - **API URL** — например, `http://192.168.1.100:8080`
   - **Username / Password** — API-креды из конфига Freqtrade (`api_server.username` / `api_server.password`)
3. Нажмите **Test Connection** для проверки
4. Нажмите **Save**

## Страница Bots (`/freqtrade-bots`)

Отображает таблицу всех зарегистрированных ботов:

| Колонка | Описание |
|---------|----------|
| Name | Имя бота |
| Exchange | Биржа |
| Strategy | Активная стратегия |
| Health | Статус здоровья (🟢 Healthy, 🟡 Degraded, 🔴 Unreachable) |
| Profit | Текущая прибыльность |
| Trades | Количество сделок |
| Environment | Docker / Manual / Baremetal |
| Last Seen | Время последнего контакта |

**Фильтрация:**
- По среде выполнения (Docker, Manual, Baremetal)
- По состоянию здоровья
- По бирже
- По стратегии
- По тегам

## Детальная страница бота (`/bots/:id`)

Вкладки:
- **Overview** — сводка: баланс, открытые позиции, прибыль, график equity
- **Trades** — история сделок с фильтрацией по времени, паре, типу
- **Analytics** — метрики: win rate, profit factor, sharpe, drawdown
- **Health** — uptime, latency, ошибки подключения, rate limits
- **Settings** — конфигурация бота (config.json, чтение/запись)

## Деплой нового бота

FreqDash может развернуть нового Freqtrade-бота в Docker одной кнопкой:

1. **Bots → Deploy Bot**
2. Выберите **стратегию** из списка доступных
3. Настройте:
   - **Bot Name** — уникальное имя
   - **Host Port** — внешний порт (1024–65535)
   - **Dry Run** — включить тестовый режим
4. Нажмите **Deploy**

Система создаст:
- Docker-контейнер `freqtrade-bot-{name}`
- Конфиг с API-сервером (авто-генерация JWT-секрета)
- Стратегию с корректировками для Spot-режима (`can_short = False`)
- Монтирование в `/opt/freqtrade_secrets/{bot_name}/`

## Управление конфигурацией

На странице бота → вкладка **Settings**:

- **Read Config** — просмотр текущего `config.json` бота
- **Edit Config** — редактирование конфига (JSON)
- **Save Config** — запись изменений в контейнер или на диск

Для Docker-ботов поиск конфига выполняется в:
1. `/freqtrade/user_data/config.json`
2. `/freqtrade/user_data/config/config.json`
3. `/freqtrade/user_data/configs/config.json`

## Управление состоянием

- **Start / Stop / Restart** — управление через Docker API
- **Health Check** — принудительная проверка здоровья
- **Delete** — удаление бота из системы (без удаления Docker-контейнера)

## Rate Limits

FreqDash отслеживает rate limits от бирж через анализ логов ботов:

- Автоматическое обнаружение 429-ошибок
- Отображение на странице Alerts
- Ручное снятие блокировки: кнопка **Clear Rate Limit** на странице бота или в Alerts
- Rate limits auto-expire через 10 минут без новых срабатываний
