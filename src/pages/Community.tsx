import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function Community() {
  return (
    <div className="space-y-6 max-w-4xl page-transition">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunidade</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte-se com outros estudantes e pratique inglês juntos.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Users className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Em breve!</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            A comunidade Falaê Brasil está sendo construída. Em breve você poderá
            participar de grupos de conversação, desafios semanais e rankings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
