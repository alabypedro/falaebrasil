import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function BackToLessonButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = sessionStorage.getItem("ai-return-url");
    if (url) setReturnUrl(url);
  }, []);

  if (!returnUrl) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        sessionStorage.removeItem("ai-return-url");
        navigate(returnUrl);
      }}
    >
      <ArrowLeft className="h-4 w-4 mr-2" /> {t("voice.backToLesson")}
    </Button>
  );
}