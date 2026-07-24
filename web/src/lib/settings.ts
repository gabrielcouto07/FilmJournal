export const DEFAULT_ACCENT = "#f5c518";

export type Theme = "system" | "dark" | "light";
export type Language = "pt-BR" | "en";

export type AppSettings = {
  theme: Theme;
  accentColor: string;
  language: Language;
  region: string;
  dateFormat: string;
  defaultRatingScale: 5 | 10;
  allowHalfStars: boolean;
  emailNotifications: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accentColor: DEFAULT_ACCENT,
  language: "pt-BR",
  region: "BR",
  dateFormat: "dd/MM/yyyy",
  defaultRatingScale: 5,
  allowHalfStars: true,
  emailNotifications: false,
};
