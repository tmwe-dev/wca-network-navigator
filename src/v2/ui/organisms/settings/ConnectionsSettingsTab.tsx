/**
 * ConnectionsSettingsTab — WCA & LinkedIn connections
 */
import * as React from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../atoms/Button";
import { StatusBadge } from "../../atoms/StatusBadge";
import { toast } from "sonner";
import { MultichannelTimingPanel } from "./MultichannelTimingPanel";
import {
  getTmweConnection,
  tmweConnectStart,
  tmweDisconnect,
  tmweGetMyProfile,
  tmweQueryKeys,
} from "@/data/tmwe";

export function ConnectionsSettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [liEmail, setLiEmail] = useState("");
  const [liAt, setLiAt] = useState("");
  const qc = useQueryClient();
  const [tmweBusy, setTmweBusy] = useState(false);

  const { data: tmweConn, isLoading: tmweLoading } = useQuery({
    queryKey: tmweQueryKeys.connection,
    queryFn: getTmweConnection,
  });

  // Toast post-callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("tmwe");
    if (!flag) return;
    if (flag === "ok") toast.success("TMWE collegato");
    else toast.error(`TMWE: ${params.get("reason") ?? "errore"}`);
    params.delete("tmwe");
    params.delete("reason");
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", clean);
    qc.invalidateQueries({ queryKey: tmweQueryKeys.connection });
  }, [qc]);

  const handleTmweConnect = useCallback(async () => {
    setTmweBusy(true);
    try {
      const url = await tmweConnectStart();
      window.location.assign(url);
    } catch (e) {
      toast.error(`Impossibile avviare il login TMWE: ${(e as Error).message}`);
      setTmweBusy(false);
    }
  }, []);

  const handleTmweDisconnect = useCallback(async () => {
    if (!confirm("Disconnettere l'account TMWE?")) return;
    setTmweBusy(true);
    try {
      await tmweDisconnect();
      toast.success("TMWE disconnesso");
      qc.invalidateQueries({ queryKey: tmweQueryKeys.connection });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTmweBusy(false);
    }
  }, [qc]);

  const handleTmweTest = useCallback(async () => {
    setTmweBusy(true);
    try {
      const res = await tmweGetMyProfile();
      if (res.ok) toast.success(`TMWE OK · id ${res.tmwe_user_id ?? "?"}`);
      else toast.error(`TMWE risposta ${res.status}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTmweBusy(false);
    }
  }, []);

  useEffect(() => {
    if (settings) {
      setLiEmail(settings.linkedin_email ?? "");
      setLiAt(settings.linkedin_li_at ?? "");
    }
  }, [settings]);

  const handleSaveLinkedIn = async () => {
    try {
      if (liEmail) await updateSetting.mutateAsync({ key: "linkedin_email", value: liEmail });
      if (liAt) await updateSetting.mutateAsync({ key: "linkedin_li_at", value: liAt });
      toast.success("Credenziali LinkedIn salvate");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const wcaConnected = !!settings?.wca_session_cookie;
  const liConnected = !!settings?.linkedin_li_at;
  const tmweConnected = !!tmweConn && tmweConn.token_valid;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">WCA API</h3>
          <StatusBadge status={wcaConnected ? "success" : "warning"} label={wcaConnected ? "Connesso" : "Non configurato"} />
        </div>
        <p className="text-sm text-muted-foreground">
          La connessione WCA è gestita tramite cookie di sessione server-side.
          Verifica lo stato nella pagina Diagnostica.
        </p>
      </div>

      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">LinkedIn</h3>
          <StatusBadge status={liConnected ? "success" : "warning"} label={liConnected ? "Configurato" : "Non configurato"} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email LinkedIn</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            value={liEmail}
            onChange={(e) => setLiEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Cookie li_at</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground font-mono text-xs"
            value={liAt}
            onChange={(e) => setLiAt(e.target.value)}
            placeholder="AQEDAx..."
          />
        </div>
        <Button onClick={handleSaveLinkedIn} isLoading={updateSetting.isPending}>Salva LinkedIn</Button>
      </div>

      <div className="border-t pt-6">
        <MultichannelTimingPanel />
      </div>

      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">TMWE (Findair Sandbox)</h3>
          <StatusBadge
            status={tmweConnected ? "success" : "warning"}
            label={tmweLoading ? "..." : tmweConnected ? "Connesso" : "Non connesso"}
          />
        </div>
        {tmweConn ? (
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              Collegato come <span className="font-medium text-foreground">{tmweConn.tmwe_email ?? "—"}</span>
              {" "}· TMWE id <code className="text-xs">{tmweConn.tmwe_user_id}</code>
            </div>
            {tmweConn.tmwe_company && <div>Azienda: {tmweConn.tmwe_company}</div>}
            <div>Scopes: {tmweConn.scopes.join(", ") || "—"}</div>
            <div>
              Token valido fino a: {new Date(tmweConn.expires_at).toLocaleString()}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Collega il tuo account TMWE per abilitare tracking, spedizioni e rubrica.
          </p>
        )}
        <div className="flex gap-2">
          {tmweConnected ? (
            <>
              <Button onClick={handleTmweTest} isLoading={tmweBusy} variant="secondary">
                Test profilo
              </Button>
              <Button onClick={handleTmweDisconnect} isLoading={tmweBusy} variant="ghost">
                Disconnetti
              </Button>
            </>
          ) : (
            <Button onClick={handleTmweConnect} isLoading={tmweBusy}>
              Connetti TMWE
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
