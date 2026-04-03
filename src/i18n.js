import builtInLanguageConfig from "./localization/languages.json";

const localeModules = import.meta.glob("./localization/*.json", { eager: true });

function buildMessagesByFile() {
  return Object.fromEntries(
    Object.entries(localeModules).map(([filePath, moduleValue]) => [
      filePath.split("/").pop(),
      moduleValue?.default || {}
    ])
  );
}

function buildLocalePack(languageConfig, messagesByFile) {
  const defaultLocale = languageConfig?.defaultLocale || "en";
  const languageEntries = (languageConfig?.languages || []).map((language) => [
    language.code,
    {
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      dir: language.dir || "ltr",
      file: language.file,
      messages: messagesByFile?.[language.file] || {}
    }
  ]);

  const locales = Object.fromEntries(languageEntries);

  return {
    defaultLocale,
    locales,
    languageList: Object.values(locales)
  };
}

const builtInLocalePack = buildLocalePack(builtInLanguageConfig, buildMessagesByFile());

export const defaultLocale = builtInLocalePack.defaultLocale;
export const locales = builtInLocalePack.locales;
export const languageList = builtInLocalePack.languageList;

export async function loadLocalePack() {
  if (typeof window === "undefined" || !window.prayerTimesDesktop?.getLocalizationBundle) {
    return builtInLocalePack;
  }

  try {
    const externalBundle = await window.prayerTimesDesktop.getLocalizationBundle();
    if (!externalBundle?.languages?.length) return builtInLocalePack;
    return buildLocalePack(externalBundle, externalBundle.messagesByFile || {});
  } catch {
    return builtInLocalePack;
  }
}

export function translate(locale, key, localeMap = locales, fallbackLocale = defaultLocale) {
  const fallbackPack = localeMap[fallbackLocale]?.messages || {};
  const pack = localeMap[locale]?.messages || fallbackPack;
  const parts = key.split(".");
  let current = pack;

  for (const part of parts) current = current?.[part];

  return current ?? key;
}
