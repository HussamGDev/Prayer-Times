import languageConfig from "./localization/languages.json";

const localeModules = import.meta.glob("./localization/*.json", { eager: true });

const languageEntries = (languageConfig.languages || []).map((language) => {
  const filePath = `./localization/${language.file}`;
  const messages = localeModules[filePath]?.default || {};
  return [
    language.code,
    {
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      dir: language.dir || "ltr",
      file: language.file,
      messages
    }
  ];
});

export const defaultLocale = languageConfig.defaultLocale || "en";
export const locales = Object.fromEntries(languageEntries);
export const languageList = Object.values(locales);

export function translate(locale, key) {
  const fallbackPack = locales[defaultLocale]?.messages || {};
  const pack = locales[locale]?.messages || fallbackPack;
  const parts = key.split(".");
  let current = pack;

  for (const part of parts) current = current?.[part];

  return current ?? key;
}
