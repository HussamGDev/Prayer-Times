## ❤️ Support This Project
If you find this useful, consider supporting:

👉 Buy Me a Coffee: buymeacoffee.com/hussamgdev

# Prayer Times

Prayer Times is a simple desktop app for checking prayer times, setting alarms, and keeping a clean daily prayer view in one place.

It was made to stay practical:
- prayer times in front of you
- before / on-time / after-prayer alarms
- normal alarms
- countdown
- editable side files for localization and audio

## Screenshots

# Prayer Section
![Prayers](./screenshots/Prayer-Times-Prayers.jpg)

# Alarms Section
![Alarms](./screenshots/Prayer-Times-Alarms.jpg)

# Countdown Section
![Countdown](./screenshots/Prayer-Times-Countdown.jpg)

# Settings Section
![Settings1](./screenshots/Prayer-Times-Settings-1.jpg)

![Settings2](./screenshots/Prayer-Times-Settings-2.jpg)


## What You Get
- Daily prayer schedule
- Next prayer and time left
- Alarm system for prayer reminders
- Normal alarms for your own reminders
- Countdown that uses the normal alarm audio
- English / Arabic support
- Easy-to-edit `audio` and `localization` folders beside the app

## Windows App
You can use either of these:

- `Prayer Times Setup ... .exe`
  Installable version for normal users

If you use the portable version, run:
- `Prayer Times.exe`

## Editable Files
The desktop version reads these folders beside the app:

- `audio/`
- `localization/`

You can replace the default sounds in `audio/`:
- `before-prayer.mp3`
- `on-prayer.mp3`
- `after-prayer.mp3`
- `normal-alarm.mp3`

You can edit or add languages in `localization/`:
- `languages.json`
- `en.json`
- `ar.json`

## Default Prayer Settings
- Latitude: `24.38`
- Longitude: `46.43`
- GMT: `180`
- Calculation: `Umm Al Qura`

## Development
If you want to run it in development:

```bash
npm install
npm run dev
```

To build the Windows app:

```bash
npm run build:exe
```

## Third-Party Software
This project is built with a few open-source tools:

- React
- React DOM
- Vite
- Electron
- electron-builder

Their licenses are their own and stay with their respective projects.

For the packaged desktop app:
- Electron / Chromium license files are included inside the built app output
- You will usually see files such as `LICENSE.electron.txt` and `LICENSES.chromium.html` in the packaged app folder

If you distribute this project, keep:
- this project license
- any bundled third-party license files that come with the packaged app

## My License

MIT License

Copyright (c) 2026 HussamGDev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, subject to the following condition:

1. Attribution
   The above copyright notice and this permission notice shall be included
   in all copies or substantial portions of the Software.
   Credit must be given to "HussamGDev" as the original author.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
