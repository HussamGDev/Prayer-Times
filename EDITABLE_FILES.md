Editable side files for the desktop build.

Folders beside the app:
- `audio/`
- `localization/`

Notes:
- Edit `localization/languages.json` to register languages.
- Add or edit the matching locale JSON files in `localization/`.
- Replace the files in `audio/` to change the default desktop sounds without rebuilding the app.
- The packaged desktop app reads these files first and falls back to built-in values if needed.
