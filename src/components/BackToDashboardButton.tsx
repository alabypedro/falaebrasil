import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function BackToDashboardButton({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <Button asChild variant="ghost" size="sm" className={className}>
      <Link to="/">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("common.backToDashboard")}
      </Link>
    </Button>
  );
}