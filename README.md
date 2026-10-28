<div align="center">

# Cuttlefish-UI

**Администрирование Cuttlefish-серверов — в одном окне.**

Десктопный клиент для управления конфигурацией, метриками и скриптами Cuttlefish-инстансов.
Написан на Tauri и React. Работает на Windows, macOS и Linux.

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)]()

</div>

![Cuttlefish-UI — главный экран](docs/screenshots/hero.png)

---

## Зачем это

Cuttlefish-инфраструктура обычно управляется вразнобой:

- конфиги серверов — в JSON-файлах на диске
- метрики — в Prometheus, в Grafana
- скрипты — на каждом сервере отдельно
- health-статус — в системе мониторинга
- подключение / аутентификация — где-то ещё

**Cuttlefish собирает всё это в одно окно.** Один список серверов, одно дерево папок, одна панель метрик, один редактор скриптов с отладчиком. Без переключения между вкладками браузера и SSH-сессиями.

---

## Что внутри

<table>
<tr>
<td width="50%" valign="top">

### 🌳 Дерево серверов

Папки и серверы любой вложенности. Drag & drop между папками. Контекстное меню для добавления, переименования и удаления. Статус соединения для каждого сервера — виден сразу.

</td>
<td width="50%" valign="top">

### 📊 Метрики Prometheus

Плоский список метрик `Group.Group.Name` парсится в иерархическое дерево. Каскадные чекбоксы: клик по группе включает или выключает все дочерние. Три состояния группы: полностью включена, частично (серая галка), полностью выключена.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💻 Скрипты с отладчиком

Редактор Lua (CodeMirror 6) с подсветкой синтаксиса, точками останова и панелями отладки: стек вызовов, breakpoints-дерево, сообщения, переменные. Тулбар отладчика: запуск, пауза, шаг с обходом, с входом, с выходом, перезапуск.

</td>
<td width="50%" valign="top">

### 🗂️ Вкладки и под-вкладки

Каждый сервер открывается в своей вкладке. Под-вкладки: Настройка, Коннекторы, Плагины, Метрики, Scripts. Под-вкладки запоминаются per-server — вернулся к серверу через час, всё на месте.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💾 Файлы конфигурации

Сохранение и открытие `*.json` с деревом серверов. Список недавних файлов. Флаг «несохранённые изменения» и подтверждение при закрытии окна. Обратная совместимость с плоским форматом `version: 1`.

</td>
<td width="50%" valign="top">

### 🎨 Светлая и тёмная тема

Приложение автоматически подстраивается под системную тему (`prefers-color-scheme`). Никаких настроек — просто работает.

</td>
</tr>
</table>

---

## Скриншоты

<div align="center">

### Дерево серверов и вкладки

![Скриншот: дерево серверов](docs/screenshots/sidebar.png)

### Метрики с каскадными чекбоксами

![Скриншот: метрики](docs/screenshots/metrics.png)

### Отладчик скриптов

![Скриншот: отладчик](docs/screenshots/scripts.png)

</div>

---

## Быстрый старт

```bash
git clone https://github.com/CuttlefishETL/cuttlefish_ts_ui.git
cd cuttlefish_ts_ui
npm install
npm run tauri dev
