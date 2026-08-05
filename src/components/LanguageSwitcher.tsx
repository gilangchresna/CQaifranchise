import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/src/i18n/I18nContext";
import { Language, languageNames } from "@/src/i18n";
import { Globe, ChevronDown, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const languages: Language[] = ["en", "id"];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
          "text-slate-600 hover:bg-slate-100",
          isOpen && "bg-slate-100"
        )}
        title={languageNames[language]}
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium">{language.toUpperCase()}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2 text-sm transition-colors",
                language === lang
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span>{languageNames[lang]}</span>
              {language === lang && <Check className="h-4 w-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
