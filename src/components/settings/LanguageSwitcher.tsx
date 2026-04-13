import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGES = [
  { code: "it", label: "Italiano" },
  { code: "en", label: "English" },
] as const;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        {t("settings.language")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("settings.language_description")}</p>
      <Select value={i18n.language?.substring(0, 2) || "it"} onValueChange={(v) => i18n.changeLanguage(v)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
