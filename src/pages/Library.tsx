import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface LibraryItem {
  id: string;
  title: string;
  type: string;
  file_url: string | null;
  audio_url: string | null;
}

function ItemCard({ item }: { item: LibraryItem }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <span className="text-4xl">{item.type === "ebook" ? "📘" : "🎧"}</span>
          <Badge variant="secondary" className="text-[10px] border-0">
            {item.type === "ebook" ? "E-book" : "Audiobook"}
          </Badge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
        </div>
        {item.type === "ebook" && item.file_url ? (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={item.file_url} target="_blank" rel="noopener noreferrer">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Ler
            </a>
          </Button>
        ) : item.type === "audiobook" && item.audio_url ? (
          <div className="space-y-2">
            <audio src={item.audio_url} controls className="w-full h-9" />
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" disabled>
            {item.type === "ebook" ? <><BookOpen className="mr-1.5 h-3.5 w-3.5" /> Indisponível</> : <><Headphones className="mr-1.5 h-3.5 w-3.5" /> Indisponível</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("library_bst").select("*").order("created_at", { ascending: false });
      if (data) setItems(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Biblioteca BST</h1>
        <p className="text-sm text-muted-foreground mt-1">
          E-books e Audiobooks para complementar seu aprendizado.
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="ebook">E-books</TabsTrigger>
          <TabsTrigger value="audiobook">Audiobooks</TabsTrigger>
        </TabsList>

        {["all", "ebook", "audiobook"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(tab === "all" ? items : items.filter((i) => i.type === tab)).map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
            {(tab === "all" ? items : items.filter((i) => i.type === tab)).length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum item disponível.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
