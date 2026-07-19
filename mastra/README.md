# Mastra AI Integration

Этот микросервис интегрирует фреймворк Mastra для создания AI-агентов, воркфлоу и других AI-функционалов для проекта FreqDash.

## Установка и Настройка

### 1. Установка зависимостей

```bash
cd mastra
npm install
```

### 2. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните необходимые переменные:

```bash
cp .env.example .env
```

Обязательно заполните `OPENAI_API_KEY` (или ключи других провайдеров, которые вы хотите использовать).

### 3. Запуск в режиме разработки

```bash
npm run dev
```

Mastra Studio будет доступно по адресу http://localhost:4111

## Запуск через Docker

Сервис уже настроен в `docker-compose.yml` корневого проекта. Для запуска:

```bash
cd ..
docker-compose up -d mastra
```

## Структура проекта

```
mastra/
├── src/
│   ├── agents/          # AI-агенты
│   ├── workflows/       # Воркфлоу
│   ├── mastra.ts        # Конфигурация Mastra
│   └── index.ts         # Точка входа
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Документация

Официальная документация Mastra: https://mastra.ai/docs
