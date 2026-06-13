import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Smartphone,
  Share,
  Plus,
  CheckCircle2,
  ArrowLeft,
  Apple,
  Monitor,
  Info,
  MoreHorizontal,
} from "lucide-react";
import {
  getPlatform,
  isAppInstalled,
  isInstallPromptAvailable,
  onInstallAvailabilityChange,
  triggerInstallPrompt,
} from "@/lib/pwa";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Install() {
  const [platform] = useState(getPlatform());
  const [installed, setInstalled] = useState(isAppInstalled());
  const [promptAvailable, setPromptAvailable] = useState(isInstallPromptAvailable());
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = onInstallAvailabilityChange(setPromptAvailable);
    const interval = setInterval(() => setInstalled(isAppInstalled()), 1500);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleInstall = async () => {
    const result = await triggerInstallPrompt();
    if (result === "accepted") {
      toast.success("App instalado com sucesso!");
    } else if (result === "dismissed") {
      toast.info("Instalação cancelada");
    } else {
      toast.info(
        "Instalação automática indisponível aqui. Siga os passos manuais abaixo para o seu dispositivo.",
      );
    }
  };

  const isPreview =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("lovableproject.com") ||
      window.location.hostname.includes("id-preview--"));

  const inIframe = (() => {
    try {
      return typeof window !== "undefined" && window.self !== window.top;
    } catch {
      return true;
    }
  })();

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("install.back")}
        </Link>

        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Smartphone className="h-8 w-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{t("install.title")}</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("install.subtitle")}</p>
        </div>

        {installed && (
          <Card className="border-green-500/40 bg-green-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium">{t("install.installed")}</p>
            </CardContent>
          </Card>
        )}

        {!installed && promptAvailable && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> {t("install.quick.title")}
              </CardTitle>
              <CardDescription>{t("install.quick.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" onClick={handleInstall} className="w-full md:w-auto">
                <Download className="h-4 w-4 mr-2" />
                {t("install.button")}
              </Button>
            </CardContent>
          </Card>
        )}

        {!installed && !promptAvailable && (isPreview || inIframe) && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">{t("install.previewWarn.title")}</p>
                <p className="text-muted-foreground">
                  {t("install.previewWarn.body1")}{" "}
                  <a
                    href="https://falaebrasil.lovable.app/install"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline"
                  >
                    falaebrasil.lovable.app
                  </a>{" "}
                  {t("install.previewWarn.body2")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* iOS instructions */}
        <Card className={platform === "ios" ? "border-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" /> {t("install.ios.title")}
              </CardTitle>
              {platform === "ios" && (
                <Badge variant="secondary" className="pointer-events-none">
                  {t("install.device")}
                </Badge>
              )}
            </div>
            <CardDescription className="pt-1 text-xs">{t("install.ios.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Step n={1}>
              {t("install.ios.step1.a")} <strong>Safari</strong> {t("install.ios.step1.b")}
            </Step>
            <Step n={2}>
              {t("install.ios.step2.a")} <MoreHorizontal className="inline h-4 w-4 mx-1" />{" "}
              <strong>{t("install.ios.step2.b")}</strong> {t("install.ios.step2.c")}
            </Step>
            <Step n={3}>
              {t("install.ios.step3.a")} <Share className="inline h-4 w-4 mx-1" />{" "}
              <strong>{t("install.ios.step3.b")}</strong>{t("install.ios.step3.c")}
            </Step>
            <Step n={4}>
              {t("install.ios.step4.a")} <Plus className="inline h-4 w-4 mx-1" />{" "}
              <strong>{t("install.ios.step4.b")}</strong>.
            </Step>
            <Step n={5}>
              {t("install.ios.step5.a")} <strong>{t("install.ios.step5.b")}</strong>{t("install.ios.step5.c")}
            </Step>
          </CardContent>
        </Card>

        {/* Android instructions */}
        <Card className={platform === "android" ? "border-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" /> {t("install.android.title")}
              </CardTitle>
              {platform === "android" && (
                <Badge variant="secondary" className="pointer-events-none">
                  {t("install.device")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {platform === "android" && promptAvailable && (
              <Button onClick={handleInstall} className="w-full md:w-auto mb-2">
                <Download className="h-4 w-4 mr-2" />
                {t("install.installNow")}
              </Button>
            )}
            <Step n={1}>
              {t("install.android.step1.a")} <Download className="inline h-4 w-4 mx-1" />{" "}
              <strong>{t("install.android.step1.b")}</strong> {t("install.android.step1.c")}{" "}
              <strong>{t("install.android.step1.d")}</strong>
            </Step>
            <Step n={2}>
              {t("install.android.step2.a")} <strong>{t("install.android.step2.b")}</strong>{t("install.android.step2.c")}
            </Step>
          </CardContent>
        </Card>

        {/* Desktop instructions */}
        <Card className={platform === "desktop" ? "border-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" /> {t("install.desktop.title")}
              </CardTitle>
              {platform === "desktop" && (
                <Badge variant="secondary" className="pointer-events-none">
                  {t("install.device")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {platform === "desktop" && promptAvailable && (
              <Button onClick={handleInstall} className="w-full md:w-auto mb-2">
                <Download className="h-4 w-4 mr-2" />
                {t("install.installNow")}
              </Button>
            )}
            <Step n={1}>
              {t("install.desktop.step1.a")} <Download className="inline h-4 w-4 mx-1" />{" "}
              <strong>{t("install.android.step1.b")}</strong> {t("install.android.step1.c")}{" "}
              <strong>{t("install.android.step1.d")}</strong>
            </Step>
            <Step n={2}>
              {t("install.desktop.step2.a")} <strong>{t("install.android.step2.b")}</strong>{t("install.desktop.step2.c")}
            </Step>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-4">{t("install.hint")}</p>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
        {n}
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}
