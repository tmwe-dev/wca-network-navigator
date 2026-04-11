/**
 * IO Queries: App Settings — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";

export interface AppSetting {
  readonly key: string;
  readonly value: string | null;
}

export async function fetchAppSettings(): Promise<Result<AppSetting[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "app_settings",
      }, "fetchAppSettings"));
    }

    return ok(data ?? []);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchAppSettings"));
  }
}

export async function fetchAppSetting(
  key: string,
): Promise<Result<string | null, AppError>> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "app_settings", key,
      }, "fetchAppSetting"));
    }

    return ok(data?.value ?? null);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchAppSetting"));
  }
}
