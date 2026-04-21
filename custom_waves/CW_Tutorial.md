# Кастомные волны / Custom Waves

---

## Русский

### Как это работает

Вы создаёте JSON-файл в папке `custom_waves/` в корне проекта. Каждый файл описывает набор волн с зомби, настройками экономики и доступными растениями. Запуск возможен только через панель разработчика (клавиша **`**).

### Запуск

**Через GUI:**
1. Откройте панель разработчика (клавиша **`**)
2. Найдите секцию "Кастомные волны"
3. Нажмите 🔄 для обновления списка
4. Выберите волну из списка
5. Нажмите "Запустить"

**Через консоль:**
```
cwave list          - показать все доступные волны
cwave load <имя>    - запустить волну (имя файла без .json)
cwave stop          - остановить текущую кастомную волну
```

### Формат файла

```json
{
  "name": "Название волны",
  "author": "Ваш ник",
  "description": "Описание того, что ждёт игрока",
  "startSun": 200,
  "nightMode": false,
  "plants": ["sunflower", "peashooter", "cherry"],
  "lawnmowers": true,
  "waves": [
    {
      "zombies": [
        { "type": "zombie", "row": 1, "delay": 0 },
        { "type": "hdd_zombie", "row": 3, "delay": 3000 }
      ]
    },
    {
      "zombies": [
        { "type": "trojan_catapult", "row": 2, "delay": 0 },
        { "type": "system_zombie", "row": 5, "delay": 5000 }
      ]
    }
  ]
}
```

### Поля

| Поле | Обязательное | По умолчанию | Описание |
|------|:---:|---|---|
| `name` | да | - | Название волны (отображается в списке) |
| `waves` | да | - | Массив волн (см. ниже) |
| `author` | нет | - | Автор волны |
| `description` | нет | - | Краткое описание |
| `startSun` | нет | 150 | Начальное количество солнц |
| `nightMode` | нет | false | Ночной режим (солнце-гриб вместо подсолнуха) |
| `plants` | нет | все | Массив ключей доступных растений |
| `lawnmowers` | нет | true | Включены ли газонокосилки |

### Структура волны

Каждая волна - объект с массивом `zombies`. Волны запускаются последовательно: следующая начинается через 5 секунд после гибели всех зомби текущей.

```json
{
  "zombies": [
    { "type": "zombie", "row": 3, "delay": 0 },
    { "type": "hdd_zombie", "row": 1, "delay": 4000 }
  ]
}
```

| Поле | Описание |
|------|---|
| `type` | Тип зомби (см. таблицу ниже) |
| `row` | Ряд от 1 до 5 |
| `delay` | Задержка спавна в миллисекундах от начала волны |

### Типы зомби

| Ключ | Название | Особенность |
|------|----------|------------|
| `zombie` | Обычный зомби | Базовый враг |
| `system_zombie` | Систем-зомби | Несёт системный файл |
| `hdd_zombie` | HDD-зомби | Броня (медленный, крепкий) |
| `ssd_zombie` | SSD-зомби | Броня (быстрый) |
| `winrar_zombie` | WinRAR-зомби | Архивирует растения |
| `trojan_catapult` | Троян-катапульта | Заражает растения |
| `bungee` | Тарзанка | Прилетает сверху, ворует растения |
| `flag_zombie` | Зомби с флагом | Делает соседних зомби бессмертными |
| `pole_loud` | Шест-громкий | Повышает громкость при приближении |
| `pole_quiet` | Шест-тихий | Понижает громкость при приближении |
| `your_death` | Ваша смерть | Босс |

### Ключи растений

| Ключ | Растение | Цена |
|------|----------|------|
| `sunflower` | Подсолнух | 50 |
| `peashooter` | Горохострел | 75 |
| `folder_magnet` | Папка-магнит | 75 |
| `siamese_peashooter` | Сиамский горохострел | 125 |
| `xsas_mushroom` | XSAS-гриб | 150 |
| `sun_mushroom` | Солнце-гриб | 25 |
| `unarchiver` | Разархиватор | 50 |
| `kaspersky_bean` | Касперский-боб | 50 |
| `daisy` | Ромашка | 75 |
| `cherry` | Вишня | 80 |
| `avast_nut` | Авасторех | 100 |
| `logic_mine` | Логическая мина | 25 |
| `torrent_lantern` | Торент-фонарь | 75 |
| `basket_chomper` | Корзинокусалка | 75 |
| `double_peashooter` | Двойной горохострел | 125 |
| `snow_peashooter` | Запретострел | 100 |

---

## English

### How it works

Create a JSON file in the `custom_waves/` folder at the project root. Each file describes a set of zombie waves with economy settings and available plants. Custom waves can only be launched from the developer panel (press **`** key).

### Launching

**Via GUI:**
1. Open the developer panel (**`** key)
2. Find the "Custom Waves" section
3. Click 🔄 to refresh the list
4. Select a wave from the dropdown
5. Click "Start"

**Via console:**
```
cwave list          - list all available waves
cwave load <name>   - start a wave (filename without .json)
cwave stop          - stop the current custom wave
```

### File format

```json
{
  "name": "Wave name",
  "author": "Your name",
  "description": "What awaits the player",
  "startSun": 200,
  "nightMode": false,
  "plants": ["sunflower", "peashooter", "cherry"],
  "lawnmowers": true,
  "waves": [
    {
      "zombies": [
        { "type": "zombie", "row": 1, "delay": 0 },
        { "type": "hdd_zombie", "row": 3, "delay": 3000 }
      ]
    }
  ]
}
```

### Fields

| Field | Required | Default | Description |
|-------|:---:|---------|-------------|
| `name` | yes | - | Wave name (shown in the list) |
| `waves` | yes | - | Array of waves (see below) |
| `author` | no | - | Wave author |
| `description` | no | - | Short description |
| `startSun` | no | 150 | Starting sun amount |
| `nightMode` | no | false | Night mode (sun-shroom replaces sunflower) |
| `plants` | no | all | Array of available plant keys |
| `lawnmowers` | no | true | Whether lawnmowers are enabled |

### Wave structure

Each wave is an object with a `zombies` array. Waves run sequentially: the next one starts 5 seconds after all zombies of the current wave are dead.

| Field | Description |
|-------|-------------|
| `type` | Zombie type (see table below) |
| `row` | Row from 1 to 5 |
| `delay` | Spawn delay in milliseconds from wave start |

### Zombie types

| Key | Name | Special |
|-----|------|---------|
| `zombie` | Basic zombie | Standard enemy |
| `system_zombie` | System zombie | Carries a system file |
| `hdd_zombie` | HDD zombie | Armored (slow, tanky) |
| `ssd_zombie` | SSD zombie | Armored (fast) |
| `winrar_zombie` | WinRAR zombie | Archives plants |
| `trojan_catapult` | Trojan catapult | Infects plants |
| `bungee` | Bungee | Drops from above, steals plants |
| `flag_zombie` | Flag Zombie | Makes adjacent zombies invincible |
| `pole_loud` | Loud Pole | Increases volume as it approaches |
| `pole_quiet` | Quiet Pole | Decreases volume as it approaches |
| `your_death` | Your Death | Boss |

### Plant keys

| Key | Plant | Cost |
|-----|-------|------|
| `sunflower` | Sunflower | 50 |
| `peashooter` | Peashooter | 75 |
| `folder_magnet` | Folder Magnet | 75 |
| `siamese_peashooter` | Siamese Peashooter | 125 |
| `xsas_mushroom` | XSAS Mushroom | 150 |
| `sun_mushroom` | Sun Mushroom | 25 |
| `unarchiver` | Unarchiver | 50 |
| `kaspersky_bean` | Kaspersky Bean | 50 |
| `daisy` | Daisy | 75 |
| `cherry` | Cherry | 80 |
| `avast_nut` | Avast-Nut | 100 |
| `logic_mine` | Logic Mine | 25 |
| `torrent_lantern` | Torrent Lantern | 75 |
| `basket_chomper` | Basket-Chomper | 75 |
| `double_peashooter` | Double Peashooter | 125 |
| `snow_peashooter` | Snow Peashooter | 100 |
