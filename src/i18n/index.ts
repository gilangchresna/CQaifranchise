import { en } from "./en";
import { id } from "./id";

export type Language = "en" | "id";

export const translations = {
  en,
  id,
} as const;

export const languageNames: Record<Language, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

export type TranslationKeys = typeof en;
