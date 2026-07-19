# 📱 Мобильное приложение

FreqDash Mobile — нативное приложение для iOS и Android на базе Expo (React Native). Доступно после сборки через EAS Build.

## Сборка

### Требования

- Node.js 20+
- Expo CLI (`npm install -g eas-cli`)
- Аккаунт Expo (expo.dev)
- EAS Build доступ

### Сборка APK (Android)

```bash
cd mobile
npx eas build --platform android --profile preview --local
```

### Сборка IPA (iOS)

```bash
cd mobile
npx eas build --platform ios --profile preview --local
```

## Экраны приложения

| Экран | Таб | Описание |
|-------|-----|----------|
| **Dashboard** | 📊 | Сводка портфеля, метрики ботов |
| **Finance** | 💰 | Криптовалюты, акции, новости |
| **Discovery** | 🔍 | Авто-обнаружение ботов |
| **Agent** | 🤖 | Веса агентов, управление |
| **Alerts** | 🔔 | Системные уведомления |

### Dashboard Screen

- Краткая сводка портфеля (total profit, balance, active bots)
- Список ботов со статусом здоровья
- Tap на бота → переход к деталям

### Bot Detail Screen

- Информация о боте (биржа, стратегия, статус)
- Текущие метрики (profit, trades, balance)
- Кнопки управления (если доступно)

### Finance Data Screen

- Список криптовалют с ценами
- Изменение за 24 часа
- Pull-to-refresh для обновления

### Discovery Screen

- Статус авто-обнаружения
- Ручной запуск сканирования
- Добавление бота вручную

### Agent Screen

- Веса сигналов по рыночным режимам
- Статистика агента (win rate, trades)

### Alerts Screen

- Список активных алертов
- Фильтрация по типу и уровню
- Mark as read / dismiss

## Настройка подключения

При первом запуске приложение запросит URL сервера FreqDash:

1. Экран Setup → введите URL вашего сервера
   - Например: `http://192.168.1.100:5000`
2. Войдите с вашими учетными данными
3. Данные авторизации сохраняются в AsyncStorage

## Технический стек

- **Expo SDK 57** — фреймворк
- **React 19** + **React Native 0.86**
- **React Navigation 7** — навигация (bottom tabs + stack)
- **TanStack React Query 5** — кэширование и загрузка данных
- **Zustand 5** — управление состоянием
- **TypeScript 6**
