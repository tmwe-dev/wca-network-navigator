import { useState } from "react";
import { useWCA } from "@/hooks/useWCA";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, LogIn, LogOut, Wifi, WifiOff, CheckCircle2, XCircle,
  Copy, Globe, Terminal, Cookie, Shield, AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function WCAIntegration() {
  const wca = useWCA();

  const [username, setUsername] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wca_credentials") || "{}").username || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wca_credentials") || "{}").password || ""; } catch { return ""; }
  });
  const [remember, setRemember] = useState(!!localStorage.getItem("wca_credentials"));
  const [manualCookie, setManualCookie] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyResponse, setProxyResponse] = useState("");
  const [proxyLoading, setProxyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleLogin = async () => {
    try {
      await wca.login(username, password);
      if (remember) {
        localStorage.setItem("wca_credentials", JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem("wca_credentials");
      }
      toast.success("Login effettuato con successo!");
    } catch {
      toast.error("Login fallito");
    }
  };

  const handleSetCookie = async () => {
    if (!manualCookie.trim()) return;
    try {
      await wca.setManualCookie(manualCookie.trim());
      toast.success("Cookie impostato!");
    } catch {
      toast.error("Errore nel set cookie");
    }
  };

  const handleProxyGet = async () => {
    if (!proxyUrl.trim()) return;
    setProxyLoading(true);
    setProxyResponse("");
    try {
      const res = await wca.proxyGet(proxyUrl);
      setProxyResponse(res);
    } catch (e: any) {
      setProxyResponse(`ERRORE: ${e.message}`);
    } finally {
      setProxyLoading(false);
    }
  };

  const handleGetCookie = async () => {
    await wca.getCookie();
  };

  const copyCookie = () => {
    if (wca.cookieValue) {
      navigator.clipboard.writeText(wca.cookieValue);
      toast.success("Cookie copiato!");
    }
  };

  const handleLogout = async () => {
    await wca.logout();
    toast.info("Disconnesso");
  };

  const loginMinutes = wca.sessionInfo?.loginTime
    ? Math.round((Date.now() - new Date(wca.sessionInfo.loginTime).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-foreground">WCAWorld Integration</h1>
          <span className={`w-2.5 h-2.5 rounded-full ${wca.isProxyOnline ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-sm text-muted-foreground">
            Proxy {wca.isProxyOnline ? "Online" : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={wca.isAuthenticated ? "default" : "destructive"} className={wca.isAuthenticated ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
            {wca.isAuthenticated ? (
              <><CheckCircle2 className="w-3 h-3 mr-1" /> Autenticato</>
            ) : (
              <><XCircle className="w-3 h-3 mr-1" /> Non autenticato</>
            )}
          </Badge>
        </div>
      </div>

      {/* Proxy offline banner */}
      {!wca.isProxyOnline && (
        <Card className="border-amber-500/50 bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">Proxy non raggiungibile</p>
              <p className="text-sm text-muted-foreground mt-1">
                Avvia il proxy locale con: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">python3 wca-auth-proxy.py</code>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Il proxy deve essere in ascolto su <code className="font-mono">http://localhost:8001</code>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Login view when not authenticated */}
      {!wca.isAuthenticated ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Login form */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="w-5 h-5 text-blue-500" />
                Login WCA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username WCA" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password WCA" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(c) => setRemember(!!c)} />
                <Label htmlFor="remember" className="text-sm cursor-pointer">Ricorda credenziali</Label>
              </div>
              {wca.error && (
                <p className="text-sm text-red-400">{wca.error}</p>
              )}
              <Button onClick={handleLogin} disabled={wca.loading || !wca.isProxyOnline} className="w-full bg-blue-600 hover:bg-blue-700">
                {wca.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                Login Automatico
              </Button>
            </CardContent>
          </Card>

          {/* Manual cookie */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cookie className="w-5 h-5 text-amber-500" />
                Cookie Manuale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                In alternativa, incolla il cookie <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.ASPXAUTH</code> copiato dal browser.
              </p>
              <Textarea
                value={manualCookie}
                onChange={(e) => setManualCookie(e.target.value)}
                placeholder="Incolla il valore del cookie .ASPXAUTH..."
                className="font-mono text-xs min-h-[100px]"
              />
              <Button onClick={handleSetCookie} disabled={wca.loading || !wca.isProxyOnline || !manualCookie.trim()} variant="outline" className="w-full">
                <Shield className="w-4 h-4 mr-2" />
                Imposta Cookie
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Authenticated view with tabs */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="proxy">Proxy & Download</TabsTrigger>
                  <TabsTrigger value="cookie">Cookie Export</TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>

              {/* Dashboard */}
              <TabsContent value="dashboard" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Stato</p>
                          <p className="text-lg font-bold text-emerald-500">Connesso</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Shield className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Utente</p>
                          <p className="text-lg font-bold">{wca.sessionInfo?.username || "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Wifi className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sessione attiva</p>
                          <p className="text-lg font-bold">{loginMinutes != null ? `${loginMinutes} min` : "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setActiveTab("proxy")} className="bg-blue-600 hover:bg-blue-700">
                    <Terminal className="w-4 h-4 mr-2" />
                    Apri Proxy & Download
                  </Button>
                  <Button variant="outline" onClick={async () => { await wca.getCookie(); copyCookie(); }}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copia Cookie negli Appunti
                  </Button>
                  <Button variant="outline" onClick={async () => { await wca.checkStatus(); toast.success("Sessione verificata"); }}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verifica Sessione
                  </Button>
                </div>

                {wca.cookieValue && (
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="text-sm">Cookie Preview</CardTitle></CardHeader>
                    <CardContent>
                      <pre className="font-mono text-xs text-muted-foreground break-all whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-24 overflow-auto">
                        {wca.cookieValue.substring(0, 120)}...
                      </pre>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-sm">Esempi di integrazione</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <pre className="font-mono text-xs bg-muted p-3 rounded-lg overflow-auto text-muted-foreground">{`// Fetch via proxy
const html = await fetch("http://localhost:8001/api/proxy?url=" + 
  encodeURIComponent("https://www.wcaworld.com/MemberProfile?id=12345"))
  .then(r => r.text());`}</pre>
                    <pre className="font-mono text-xs bg-muted p-3 rounded-lg overflow-auto text-muted-foreground">{`# Python
import requests
r = requests.get("http://localhost:8001/api/proxy",
    params={"url": "https://www.wcaworld.com/MemberProfile?id=12345"})
print(r.text)`}</pre>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Proxy & Download */}
              <TabsContent value="proxy" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Terminal className="w-5 h-5 text-blue-500" />
                      Proxy GET
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={proxyUrl}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        placeholder="https://www.wcaworld.com/MemberProfile?id=..."
                        className="font-mono text-sm flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleProxyGet()}
                      />
                      <Button onClick={handleProxyGet} disabled={proxyLoading || !proxyUrl.trim()} className="bg-blue-600 hover:bg-blue-700">
                        {proxyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "GET"}
                      </Button>
                    </div>
                    {proxyResponse && (
                      <pre className="font-mono text-xs bg-muted p-4 rounded-lg max-h-[500px] overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                        {proxyResponse}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cookie Export */}
              <TabsContent value="cookie" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Cookie className="w-5 h-5 text-amber-500" />
                      Cookie Export
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button onClick={handleGetCookie} variant="outline" className="w-full">
                      <Cookie className="w-4 h-4 mr-2" />
                      Ottieni Cookie Completo
                    </Button>
                    {wca.cookieValue && (
                      <>
                        <div className="relative">
                          <pre className="font-mono text-xs bg-muted p-4 rounded-lg max-h-32 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                            {wca.cookieValue}
                          </pre>
                          <Button size="sm" variant="ghost" onClick={copyCookie} className="absolute top-2 right-2">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Esempi d'uso:</p>
                          <pre className="font-mono text-xs bg-muted p-3 rounded-lg overflow-auto text-muted-foreground">{`curl -H "Cookie: .ASPXAUTH=${wca.cookieValue.substring(0, 40)}..." \\
  "https://www.wcaworld.com/MemberProfile?id=12345"`}</pre>
                          <pre className="font-mono text-xs bg-muted p-3 rounded-lg overflow-auto text-muted-foreground">{`import requests
s = requests.Session()
s.cookies.set(".ASPXAUTH", "${wca.cookieValue.substring(0, 40)}...")
r = s.get("https://www.wcaworld.com/MemberProfile?id=12345")
print(r.text)`}</pre>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
