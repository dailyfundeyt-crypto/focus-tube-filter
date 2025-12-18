import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, Check, WifiOff, Clock, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-4">
          <img src={logo} alt="FocusTube Logo" className="h-20 w-auto mx-auto" />
          <h1 className="text-3xl font-bold">FocusTube installieren</h1>
          <p className="text-muted-foreground">
            Installiere die App für schnellen Zugriff und Offline-Nutzung
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                <Check className="h-6 w-6" />
                <div>
                  <p className="font-semibold">App ist installiert!</p>
                  <p className="text-sm text-muted-foreground">
                    Du kannst die App jetzt vom Homescreen öffnen
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card>
            <CardContent className="pt-6">
              <Button onClick={handleInstall} size="lg" className="w-full gap-2">
                <Download className="h-5 w-5" />
                Jetzt installieren
              </Button>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                iOS Installation
              </CardTitle>
              <CardDescription>
                Folge diesen Schritten um die App zu installieren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <span>Tippe auf das <strong>Teilen</strong>-Symbol unten in Safari</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <span>Scrolle und tippe auf <strong>"Zum Home-Bildschirm"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <span>Tippe auf <strong>"Hinzufügen"</strong></span>
                </li>
              </ol>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Desktop Installation
              </CardTitle>
              <CardDescription>
                Installiere die App über deinen Browser
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Klicke auf das Installations-Symbol in der Adressleiste deines Browsers oder nutze das Browser-Menü.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Offline Features */}
        <Card>
          <CardHeader>
            <CardTitle>Offline-Funktionen</CardTitle>
            <CardDescription>
              Diese Features funktionieren ohne Internet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Timer & Stoppuhr</p>
                  <p className="text-sm text-muted-foreground">Lernzeit tracken auch ohne Verbindung</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Gecachte Daten</p>
                  <p className="text-sm text-muted-foreground">Kategorien & Kanäle bleiben verfügbar</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <WifiOff className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Video-Thumbnails</p>
                  <p className="text-sm text-muted-foreground">Bereits geladene Bilder bleiben sichtbar</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link to="/" className="text-primary hover:underline text-sm">
            Zurück zur App
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Install;
