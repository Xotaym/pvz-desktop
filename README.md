<h1 align="center">
  <br>
  Plants VS Zombies Desktop
  <br>
  <br>
  Russia <img src=https://flagicons.lipis.dev/flags/4x3/ru.svg width=40>
  <br>
</h1>

<p align="center">
  <b>Твой рабочий стол — поле битвы.</b>
  <br>
  <sub>Фанатский PvZ, где зомби вторгаются на твой настоящий рабочий стол Windows.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.1-2ecc71?style=flat-square" />
  <img src="https://img.shields.io/badge/Windows%2010%2F11-0078D4?style=flat-square&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/Python%203.10+-3776AB?style=flat-square&logo=python&logoColor=white" />
</p>

<br>

<p align="center"><i>
  Ты запускаешь игру. Появляется твой настоящий рабочий стол. Windows Defender предупреждает о критической угрозе.
  <br>
  Иконки начинают исчезать. Экран трескается. За трещинами — лужайка PvZ.
  <br>
  Битва начинается.
</i></p>

<br>

---

<br>

<h2 align="center">Растения</h2>

<table align="center">
<tr>
<td align="center" width="120"><img src="static/img/plants/подсолнух.png" width="56" /><br><b>Подсолнух</b><br><sub>50 солнц</sub></td>
<td align="center" width="120"><img src="static/img/plants/горохострел.png" width="56" /><br><b>Горохострел</b><br><sub>75 солнц</sub></td>
<td align="center" width="120"><img src="static/img/plants/папка-магнит.png" width="56" /><br><b>Папка-магнит</b><br><sub>75 солнц</sub></td>
<td align="center" width="120"><img src="static/img/plants/сиамский-горохострел.png" width="56" /><br><b>Сиамский</b><br><sub>125 солнц</sub></td>
<td align="center" width="120"><img src="static/img/plants/xsas-гриб.png" width="56" /><br><b>КСАС-гриб</b><br><sub>150 солнц</sub></td>
<td align="center" width="120"><img src="static/img/plants/солнце-гриб.png" width="56" /><br><b>Солнце-гриб</b><br><sub>25 солнц</sub></td>
</tr>
<tr>
<td align="center"><sub>Генерирует солнца каждые несколько секунд</sub></td>
<td align="center"><sub>Стреляет горошинами по зомби</sub></td>
<td align="center"><sub>Вытягивает системные файлы у зомби</sub></td>
<td align="center"><sub>Стреляет в обе стороны</sub></td>
<td align="center"><sub>Взрывает область 5x5, оставляет глитчи</sub></td>
<td align="center"><sub>Подсолнух для ночного режима</sub></td>
</tr>
</table>

<br>

<h2 align="center">Зомби</h2>

<table align="center">
<tr>
<td align="center" width="120"><img src="static/img/zombies/зомби.webp" width="56" /><br><b>Зомби</b></td>
<td align="center" width="120"><img src="static/img/zombies/систем-зомби.png" width="56" /><br><b>Систем</b></td>
<td align="center" width="120"><img src="static/img/zombies/хдд-зомби.png" width="56" /><br><b>HDD</b></td>
<td align="center" width="120"><img src="static/img/zombies/ссд-зомби.png" width="56" /><br><b>SSD</b></td>
<td align="center" width="120"><img src="static/img/zombies/winrar-зомби.png" width="56" /><br><b>WinRAR</b></td>
<td align="center" width="120"><img src="static/img/zombies/ваша-смерть.png" width="56" /><br><b>Ваша Смерть</b></td>
</tr>
<tr>
<td align="center"><sub>Обычный. Ничего особенного.</sub></td>
<td align="center"><sub>Несёт системный файл. Повредишь его - смерть.</sub></td>
<td align="center"><sub>Медленный, но крепкий. HDD ломается после 3 попаданий.</sub></td>
<td align="center"><sub>Быстрый, но хрупкий. SSD ломается после 2 попаданий.</sub></td>
<td align="center"><sub>Архивирует растения. Используй разархиватор!</sub></td>
<td align="center"><sub>???</sub></td>
</tr>
</table>

<br>

---

<br>

<h2 align="center">Фишки</h2>

<p align="center">

**Твой настоящий рабочий стол** — обои, иконки, всё как есть
<br>
**Курсик** — твой лучший друг в игре, управляет всеми зомби
<br>
**Ночной режим** — тёмная лужайка, солнце-грибы вместо подсолнухов
<br>
**BSOD-смерти** — у каждой смерти уникальная причина и совет
<br>
**Панель разработчика** — консольные команды, спавн зомби, выдача солнц

</p>

<br>

---

<br>

<h2 align="center">Установка и запуск</h2>

<p align="center">
  <b>Windows 10/11 &nbsp;|&nbsp; Python 3.10+</b>
</p>

```
git clone https://github.com/your-repo/pvz-desktop.git
cd pvz-desktop
pip install -r requirements.txt
python server.py
```

<p align="center">
  Или просто запусти <code>start.bat</code> — он установит всё сам и запустит игру.
</p>

<br>

> **Хочешь .exe без Python?**
> Запусти `build.bat` — он соберёт портативную версию через PyInstaller.

<br>

---

<br>

<h2 align="center">Управление</h2>

<p align="center">

| | |
|:---:|---|
| **ЛКМ** | Выбрать растение, посадить, собрать солнце |
| **ПКМ** | Убрать посаженное растение |
| **ESC** | Меню паузы |
| **`** | Панель разработчика (если включена в настройках) |

</p>

<br>

---

<br>

<h1 align="center">English <img src=https://flagicons.lipis.dev/flags/4x3/gb.svg width=40></h2>

A fan-made Plants vs Zombies made by Russian developer where the game is played **on your real Windows desktop**.

**Features:** 7 plants, 7 zombies (including a boss), night mode, BSOD death screens, dev panel with console.

**Quick start:**
```
git clone https://github.com/your-repo/pvz-desktop.git
cd pvz-desktop
pip install -r requirements.txt
python server.py
```
Or run `start.bat`. For standalone `.exe` — run `build.bat`.

<br>

---

<p align="center">
  <sub>Сделано <b>Xotaym</b></sub>
  <br>
  <sub>Фан-проект. Plants vs Zombies — торговая марка Electronic Arts.</sub>
</p>
