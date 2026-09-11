import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, BookOpen, Library as LibraryIcon } from "lucide-react";

export default function Success() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      await refreshProfile();
      if (attempts >= 5) {
        clearInterval(interval);
        setRefreshing(false);
      }
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasCourse = profile?.has_course_access ?? false;
  const hasAnyEbook =
    (profile?.has_ebook1_access ?? false) ||
    (profile?.has_ebook2_access ?? false) ||
    (profile?.has_ebook3_access ?? false);

  return (
    <div className="max-w-lg mx-auto py-12 space-y-6">
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold">Compra confirmada!</h1>
          {refreshing && (
            <p className="text-sm text-muted-foreground">Validando seus novos acessos...</p>
          )}
          {hasCourse && hasAnyEbook ? (
            <p className="text-muted-foreground">
              <strong>Bem-vindo ao Essential Pro A1!</strong> Seus materiais extras também já estão disponíveis.
            </p>
          ) : hasCourse ? (
            <p className="text-muted-foreground">
              <strong>Bem-vindo ao Essential Pro A1!</strong> Seu curso já está liberado.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Seus acessos serão liberados em instantes. Se demorar, recarregue a página.
            </p>
          )}
          <div className="flex gap-2 justify-center pt-2">
            {hasCourse && (
              <Button onClick={() => navigate("/courses")}>
                <BookOpen className="mr-1.5 h-4 w-4" /> Ir para o curso
              </Button>
            )}
            {hasAnyEbook && (
              <Button variant="outline" onClick={() => navigate("/library")}>
                <LibraryIcon className="mr-1.5 h-4 w-4" /> Bibliotecaê BST
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}