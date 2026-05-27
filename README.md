# 📊 FreqDash — Multi-Bot Dashboard для Freqtrade

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://postgresql.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://react.dev)

> **Современная панель управления для мониторинга нескольких Freqtrade-ботов из одного интерфейса**

---

## 📋 Содержание

- [Обзор](#обзор)
- [Возможности](#возможности)
- [Системные требования](#системные-требования)
- [Быстрый старт](#быстрый-старт)
- [Методы установки](#методы-установки)
- [Конфигурация](#конфигурация)
- [Использование](#использование)
- [Устранение неполадок](#устранение-неполадок)
- [Безопасность](#безопасность)
- [Обновление](#обновление)

---

## 🎯 Обзор

**FreqDash** — это многофункциональная панель для управления и мониторинга сразу нескольких торговых ботов [Freqtrade](https://www.freqtrade.io/) в реальном времени.

### ✨ Возможности

- **Multi-Bot Management** — управляйте неограниченным количеством Freqtrade-ботов
- **Real-Time Updates** — данные в реальном времени через WebSocket
- **Auto-Discovery** — автоматическое обнаружение ботов через Docker или файловую систему
- **Portfolio Analytics** — агрегированная статистика по всем ботам
- **Trade History** — детальная история сделок с фильтрацией и экспортом
- **Health Monitoring** — контроль uptime, задержек и ошибок
- **Тёмная/светлая тема** — адаптивный интерфейс
- **Mobile Ready** — работает на десктопе и мобильных устройствах

### 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
│                     (Browser / Mobile)                                   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP / WebSocket
┌─────────────────────────────▼───────────────────────────────────────────┐
│                           FRONTEND                                       │
│              React 18 + TypeScript + Vite + Tailwind CSS                 │
│                         Port: 5000                                       │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ REST API / WebSocket
┌─────────────────────────────▼───────────────────────────────────────────┐
│                           BACKEND                                        │
│              FastAPI + Python 3.11 + SQLAlchemy 2.0                      │
│                         Port: 8000                                       │
└─────────────────────────────┬───────────────────────────────────────────┘
              ┌───────────────┼───────────────┐
              │               │               │
┌─────────────▼─────┐ ┌───────▼────────┐ ┌────▼──────────┐
│   PostgreSQL      │ │   PostgreSQL   │ │    Redis      │
│   (Main DB)       │ │  (Analytics)   │ │   (Cache)     │
│   Port: 5432      │ │   Port: 5433   │ │  Port: 6379   │
└───────────────────┘ └────────────────┘ └───────────────┘
```

---

## 💻 Системные требования

### Минимальные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| **CPU** | 2 ядра | 4+ ядер |
| **RAM** | 4 GB | 8+ GB |
| **Диск** | 20 GB | 50+ GB SSD |
| **ОС** | Linux/macOS/Windows с Docker | Linux Ubuntu 22.04+ |
| **Docker** | 20.10+ | Последняя версия |
| **Docker Compose** | 2.0+ | Последняя версия |

### Сетевые требования

- Порты для открытия:
  - `5000` — панель управления
  - `8000` — API
  - `8090` — Adminer (опционально, только для внутреннего использования)

---

## 🚀 Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/geniok1980/freqwebui-free.git
cd freqwebui-free
```

### 2. Запуск установки

```bash
chmod +x install.sh
./install.sh
```

Или с кастомными параметрами:

```bash
./install.sh --db-password mypass --admin-password myadmin --production
```

### 3. Доступ к панели

```
🌐 Панель:     http://localhost:5000
📚 API Docs:   http://localhost:8000/docs
🗄️ Adminer:    http://localhost:8090
```

**Логин по умолчанию:**
- Username: `admin`
- Password: `admin` (сменить при первом входе!)

---

## 🔧 Методы установки

### Метод 1: Автоматическая установка (рекомендуется)

```bash
./install.sh
```

Скрипт выполнит:
1. Проверку зависимостей (Docker, Docker Compose)
2. Генерацию паролей и секретов
3. Создание структуры директорий
4. Настройку схем БД
5. Сборку и запуск всех сервисов

### Метод 2: Ручная установка

```bash
# 1. Создать файл окружения
cp .env.example .env
nano .env

# 2. Создать директории
mkdir -p {logs,backup_DB,data,db/init,db/init-analytics}

# 3. Запустить БД
docker-compose up -d postgres postgres-analytics redis

# 4. Дождаться инициализации БД (30 сек)
sleep 30

# 5. Запустить все сервисы
docker-compose up -d
```

### Метод 3: Production

```bash
./install.sh \
  --production \
  --db-password "$(openssl rand -base64 32)" \
  --jwt-secret "$(openssl rand -hex 64)" \
  --admin-password "$(openssl rand -base64 16)"
```

---

## ⚙️ Конфигурация

### Переменные окружения

Настройки в файле `.env`:

| Переменная | Описание | По умолчанию |
|-----------|----------|-------------|
| `PUBLIC_HOST` | Публичный хост/IP | `localhost` |
| `DB_PASSWORD` | Пароль PostgreSQL | (авто-генерация) |
| `JWT_SECRET` | JWT ключ | (авто-генерация) |
| `ADMIN_USERNAME` | Имя админа | `admin` |
| `ADMIN_PASSWORD` | Пароль админа | `admin` |
| `BACKEND_PORT` | Порт API | `8000` |
| `FRONTEND_PORT` | Порт UI | `5000` |
| `REDIS_PORT` | Порт Redis | `6379` |

### Dashboard YAML Config

Создать `config/dashboard.yaml`:

```yaml
server:
  host: "0.0.0.0"
  port: 8000
  cors_origins:
    - "http://localhost:5000"

database:
  url: "postgresql://dashboard:***@postgres:5432/dashboard"

discovery:
  docker:
    enabled: true
    image_patterns:
      - "freqtradeorg/freqtrade"
  filesystem:
    enabled: true
    scan_paths:
      - "/opt/freqtrade/*/user_data"

api_defaults:
  username: "your_freqtrade_user"
  password: "your_freqtrade_pass"
```

---

## 🎮 Использование

### Первый вход

1. Откройте `http://localhost:5000`
2. Войдите с учётными данными по умолчанию
3. **Сразу смените пароль администратора!**
4. Settings → Profile → Change Password

### Добавление ботов

**Метод 1: Авто-обнаружение**
- Панель автоматически сканирует ботов каждые 60 секунд
- Боты должны быть запущены в Docker или доступны по заданным путям

**Метод 2: Ручная регистрация**
1. Bots → Add Bot
2. Укажите данные бота:
   - Name: уникальный идентификатор
   - API URL: `http://bot-host:8080`
   - Username/Password: API-креды Freqtrade
3. Test Connection → Save

### Разделы панели

| Раздел | Описание |
|--------|----------|
| **Overview** | Сводка портфеля, P&L, активные боты |
| **Bots** | Статус и управление ботами |
| **Trades** | История сделок с фильтрами |
| **Analytics** | Графики и метрики производительности |
| **Alerts** | Системные уведомления |
| **Settings** | Конфигурация и управление пользователями |

---

## 🔍 Устранение неполадок

### Контейнер не запускается

```bash
# Проверить логи
docker-compose logs -f [service_name]

# Типовое решение
docker-compose down
docker-compose pull
docker-compose up -d
```

### Проблемы с подключением к БД

```bash
# Проверить здоровье БД
docker-compose exec postgres pg_isready -U dashboard

# Сброс БД (все данные будут потеряны!)
docker-compose down -v
docker-compose up -d postgres postgres-analytics
```

### Боты не обнаруживаются

```bash
# Проверить доступ к Docker socket
docker-compose exec backend docker ps

# Проверить пути сканирования
docker-compose exec backend ls -la /opt
```

### Частые ошибки

| Ошибка | Решение |
|--------|---------|
| `Connection refused` | Дождитесь запуска сервисов (30 сек) |
| `Permission denied` | Проверьте права: `chmod -R 755 data/` |
| `JWT validation failed` | Сгенерируйте новый JWT_SECRET в .env |
| `Database locked` | Перезапустите postgres |

---

## 🔒 Безопасность

### Production чеклист

- [ ] Сменить пароль администратора
- [ ] Сгенерировать сильный JWT_SECRET
- [ ] Использовать надёжный DB_PASSWORD
- [ ] Настроить HTTPS (reverse proxy)
- [ ] Ограничить доступ к Adminer (VPN/internal)
- [ ] Настроить firewall
- [ ] Включить аудит логов
- [ ] Регулярные бекапы

---

## 📈 Обновление

```bash
# 1. Бекап данных
docker-compose exec postgres pg_dump -U dashboard dashboard > backup.sql

# 2. Стянуть последнюю версию
git pull origin main

# 3. Пересобрать и перезапустить
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 4. Применить миграции (если есть)
docker-compose exec backend alembic upgrade head
```

---

## 📝 Полезные команды

```bash
# Все логи
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f backend

# Рестарт сервиса
docker-compose restart backend

# Бекап БД
docker-compose exec postgres pg_dump -U dashboard dashboard > backup.sql

# Восстановление БД
docker-compose exec -T postgres psql -U dashboard dashboard < backup.sql

# Обновить образы
docker-compose pull
docker-compose up -d
```

---

## 📬 Контакты

[![Telegram](https://img.shields.io/badge/-Telegram-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://t.me/geniok)

---

## 📄 Лицензия

MIT License

---

<p align="center">
  Made with ❤️ for the Freqtrade community
</p>
