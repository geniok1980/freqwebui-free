# 🔍 Troubleshooting

## Контейнеры не запускаются

```bash
# Проверить логи
docker compose logs -f [service_name]

# Типовое решение
docker compose down
docker compose pull
docker compose up -d
```

## Проблемы с подключением к БД

```bash
# Проверить здоровье БД
docker compose exec postgres pg_isready -U dashboard

# Сброс БД (все данные будут потеряны!)
docker compose down -v
docker compose up -d postgres redis
```

## Боты не обнаруживаются

```bash
# Проверить доступ к Docker socket
docker compose exec backend docker ps

# Проверить пути сканирования
docker compose exec backend ls -la /opt

# Проверить статус Discovery в UI
# Страница Discovery → статус Docker enabled, Filesystem enabled
```

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| `Connection refused` | Дождитесь запуска сервисов (30–60 сек) |
| `Permission denied` | Проверьте права: `chmod -R 755 data/` |
| `JWT validation failed` | Сгенерируйте новый `JWT_SECRET` в `.env` |
| `Database locked` | Перезапустите postgres |
| `Rate limit exceeded` | Проверьте Alerts → Clear Rate Limit для бота |
| `Bot API unreachable` | Проверьте, запущен ли Freqtrade-бот и доступен ли по сети |

## Логи сервисов

```bash
# Все логи
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f data-collector
docker compose logs -f mastra

# Рестарт сервиса
docker compose restart backend
```

## Администрирование БД

Через Adminer (`http://localhost:8090`):

1. Сервер: `postgres`
2. Пользователь: `dashboard`
3. Пароль: из `.env` (`DB_PASSWORD`)
4. База: `dashboard`

**Бекап и восстановление:**

```bash
# Бекап
docker compose exec postgres pg_dump -U dashboard dashboard > backup.sql

# Восстановление
docker compose exec -T postgres psql -U dashboard dashboard < backup.sql
```

## Обновление

```bash
# 1. Бекап данных
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
- Уменьшите `refresh_interval` в настройках
- Проверьте нагрузку на PostgreSQL
- Убедитесь, что Redis включён для кэширования
- Отключите неиспользуемых ботов

**Проблема:** Высокое потребление RAM

**Решения:**
- Ограничьте количество одновременно отслеживаемых ботов
- Уменьшите `workers` в конфиге backend
- Настройте лимиты памяти в Docker Compose

## Security

**Production чеклист:**
- [ ] Сменить пароль администратора
- [ ] Сгенерировать сильный `JWT_SECRET` (`openssl rand -hex 64`)
- [ ] Использовать надёжный `DB_PASSWORD`
- [ ] Настроить HTTPS (reverse proxy: Nginx, Caddy)
- [ ] Ограничить доступ к Adminer (VPN/internal)
- [ ] Настроить firewall
- [ ] Регулярные бекапы
