import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function BackToDashboardButton({ className }: { className?: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className={className}>
      <Link to="/">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao Painel
      </Link>
    </Button>
  );
}