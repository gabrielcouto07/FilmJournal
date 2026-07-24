import type { UserSettings } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma.js";

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

function coerce(row: UserSettings): AppSettings {
  return {
    theme: (["system", "dark", "light"] as const).find((value) => value === row.theme) ?? "dark",
    accentColor: /^#[0-9a-fA-F]{6}$/.test(row.accentColor) ? row.accentColor : DEFAULT_ACCENT,
    language: row.language === "en" ? "en" : "pt-BR",
    region: row.region,
    dateFormat: row.dateFormat,
    defaultRatingScale: row.defaultRatingScale === 10 ? 10 : 5,
    allowHalfStars: row.allowHalfStars,
    emailNotifications: row.emailNotifications,
  };
}

/** Lê as preferências e usa os padrões quando ainda não há dados ou migração. */
export async function getUserSettings(userId: string | null | undefined): Promise<AppSettings> {
  if (!userId) return DEFAULT_SETTINGS;
  try {
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    return row ? coerce(row) : DEFAULT_SETTINGS;
  } catch (error) {
    console.warn("[settings] falling back to defaults:", error instanceof Error ? error.message : error);
    return DEFAULT_SETTINGS;
  }
}

export const settingsUpdateSchema = z.object({
  theme: z.enum(["system", "dark", "light"]).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
  language: z.enum(["pt-BR", "en"]).optional(),
  region: z.string().trim().min(2).max(8).optional(),
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]).optional(),
  defaultRatingScale: z.union([z.literal(5), z.literal(10)]).optional(),
  allowHalfStars: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
