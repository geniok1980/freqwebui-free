# 🚀 Быстрый старт

## Системные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 2 ядра | 4+ ядер |
| RAM | 4 GB | 8+ GB |
| Диск | 20 GB | 50+ GB SSD |
| ОС | Linux/macOS с Docker | Linux Ubuntu 22.04+ |
| Docker | 20.10+ | Последняя версия |
| Docker Compose | 2.0+ | Последняя версия |

## Установка

### Автоматическая установка (рекомендуется)

```bash
git clone https://github.com/geniok1980/freqwebui-free.git
cd freqwebui-free
chmod +x install.sh
./install.sh
```

Скрипт выполнит:
1. Проверку зависимостей (Docker, Docker Compose)
2. Генерацию паролей и секретов
3. Создание структуры директорий
4. Настройку схем БД
5. Сборку и запуск всех сервисов

С кастомными параметрами:

```bash
./install.sh --db-password mypass --admin-password myadmin --production
```

### Ручная установка

```bash
# 1. Создать файл окружения
cp .env.example .env
nano .env

# 2. Создать директории
mkdir -p {logs,backup_DB,data,db/init,db/init-analytics}

# 3. Запустить БД
docker compose up -d postgres postgres-analytics redis

# 4. Дождаться инициализации БД (30 сек)
sleep 30

# 5. Запустить все сервисы
docker compose up -d
```

### Production-установка

```bash
./install.sh \
  --production \
  --db-password "$(openssl rand -base64 32)" \
  --jwt-secret "$(openssl rand -hex 64)" \
  --admin-password "$(openssl rand -base64 16)"
```

## Первый вход

1. Откройте **http://localhost:5000**
2. Войдите с учётными данными по умолчанию:
   - **Username:** `admin`
   - **Password:** `admin`
3. **Сразу смените пароль администратора!** Settings → Profile → Change Password

## Обзор сервисов

После запуска становятся доступны:

| Сервис | URL | Описание |
|--------|-----|----------|
| Frontend (Web UI) | http://localhost:5000 | Панель управления |
| API (Swagger) | http://localhost:8000/api/docs | Документация API |
| API (ReDoc) | http://localhost:8000/api/redoc | Альтернативная документация API |
| Adminer | http://localhost:8090 | Web-интерфейс БД |
| Mastra AI | http://localhost:4111/api | AI-агент |

## Структура проекта

```
├── backend/              # FastAPI backend (Python 3.11)
│   └── src/
│       ├── api/          # REST API endpoints
│       ├── models/       # SQLAlchemy models
│       ├── services/     # Business logic (discovery, health, connectors...)
│       ├── config.py     # Configuration loader
│       └── main.py       # Application entry point
├── frontend/             # React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/        # Page components
│       ├── components/   # Reusable UI components
│       ├── hooks/        # Custom React hooks
│       ├── store/        # Zustand state management
│       └── services/     # API client
├── mobile/               # Expo React Native app
│   └── src/
│       ├── screens/      # Mobile screens
│       ├── navigation/   # Tab + stack navigation
│       └── api/          # API client
├── config/               # Dashboard YAML config
├── strategies/           # Freqtrade strategy files
├── mastra/               # Mastra AI microservice
├── data_collector/       # Analytics data pipeline
└── docker-compose.yml    # Docker Compose stack
```

## Основные страницы

| Путь | Раздел | Описание |
|------|--------|----------|
| `/` | Dashboard | Сводка портфеля, P&L, активные боты |
| `/freqtrade-bots` | Bots | Статус и управление ботами |
| `/bots/:id` | Bot Detail | Детали конкретного бота |
| `/backtest` | Backtest | Результаты бэктестов |
| `/strategy-lab` | Strategy Lab | Стратегии, воркфлоу, гиперопт |
| `/financedata` | Finance Data | Котировки, новости, макропоказатели |
| `/agent` | Agent | Динамические торговые агенты |
| `/pairlist-selector` | Pairlist | ML-оптимизация пар |
| `/alerts` | Alerts | Системные уведомления |
| `/settings` | Settings | Конфигурация и управление |
| `/users` | Users | Управление пользователями (admin) |
| `/compare` | Compare | Сравнение стратегий/ботов |
| `/discovery` | Discovery | Авто-обнаружение ботов |
| `/historic` | Historic | Исторические данные |
