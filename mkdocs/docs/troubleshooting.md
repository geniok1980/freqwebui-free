# 🔍 Устранение неполадок

## Контейнеры не запускаются

```bash
# Проверить логи
docker compose logs -f [имя_сервиса]

# Типовое решение
docker compose down
docker compose pull
docker compose up -d
```

## Проблемы с подключением к базе данных

```bash
# Проверить состояние базы
docker compose exec postgres pg_isready -U dashboard

# Сброс базы (все данные будут потеряны!)
docker compose down -v
docker compose up -d postgres redis
```

## Боты не обнаруживаются

```bash
# Проверить доступ к Docker socket
docker compose exec backend docker ps

# Проверить пути сканирования
docker compose exec backend ls -la /opt

# Проверить статус обнаружения в интерфейсе
# Страница «Обнаружение» → статусы поиска в Docker и по файлам
```

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| `Connection refused` | Дождитесь запуска сервисов (30–60 секунд) |
| `Permission denied` | Проверьте права: `chmod -R 755 data/` |
| `JWT validation failed` | Сгенерируйте новый `JWT_SECRET` в `.env` |
| `Database locked` | Перезапустите postgres |
| `Rate limit exceeded` | Проверьте «Уведомления» → «Снять лимит» для бота |
|| `Bot API unreachable` | Проверьте, запущен ли бот Freqtrade и доступен ли по сети |
|| `Token is invalid` (telegram-bot) | Проверьте токен в Настройки → Telegram Bot — он должен быть от @BotFather |
|| `telegram_bot_token is empty` (telegram-bot) | Задайте токен в веб-интерфейсе: Настройки → Telegram Bot |
|| Бот не отвечает на команды | Убедитесь, что ваш Telegram ID есть в списке разрешённых пользователей |

## Логи сервисов

```bash
# Все логи
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f data-collector
docker compose logs -f mastra

# Перезапуск сервиса
docker compose restart backend
```

## Администрирование базы данных

Через Adminer (`http://localhost:18091`):

1. Сервер: `postgres`
2. Пользователь: `dashboard`
3. Пароль: из `.env` (`DB_PASSWORD`)
4. База: `dashboard`

**Резервное копирование и восстановление:**

```bash
# Резервная копия
docker compose exec postgres pg_dump -U dashboard dashboard > backup.sql

# Восстановление
docker compose exec -T postgres psql -U dashboard dashboard < backup.sql
```

## Обновление

```bash
# 1. Сделать резервную копию
docker compose exec postgres pg_dump -U dashboard dashboard > backup_$(date +%Y%m%d).sql

# 2. Стянуть последнюю версию
git pull origin main

# 3. Пересобрать и перезапустить
docker compose down
docker compose build --no-cache
docker compose up -d

# 4. Применить миграции (если есть)
docker compose exec backend alembic upgrade head
```

## Производительность

**Проблема:** Дашборд загружается медленно

**Решения:**
- Уменьшите интервал обновления в настройках
- Проверьте нагрузку на PostgreSQL
- Убедитесь, что Redis включён для кэширования
- Отключите неиспользуемых ботов

**Проблема:** Высокое потребление памяти

**Решения:**
- Ограничьте количество одновременно отслеживаемых ботов
- Уменьшите количество рабочих процессов в конфиге бэкенда
- Настройте лимиты памяти в Docker Compose

## Безопасность

**Контрольный список для продакшена:**
- [ ] Сменить пароль администратора
- [ ] Сгенерировать надёжный `JWT_SECRET` (`openssl rand -hex 64`)
- [ ] Использовать надёжный `DB_PASSWORD`
- [ ] Настроить HTTPS (обратный прокси: Nginx, Caddy)
- [ ] Ограничить доступ к Adminer (VPN/внутренняя сеть)
- [ ] Настроить межсетевой экран
- [ ] Регулярно делать резервные копии
