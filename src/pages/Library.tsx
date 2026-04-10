import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LibraryItem {
  id: string;
  title: string;
  author: string;
  level: string;
  type: "ebook" | "audiobook";
  cover: string;
}

const libraryItems: LibraryItem[] = [
  { id: "1", title: "English for Everyday Life", author: "Sarah Collins", level: "A1", type: "ebook", cover: "📘" },
  { id: "2", title: "Travel English", author: "James Wright", level: "A2", type: "ebook", cover: "📗" },
  { id: "3", title: "Business Communication", author: "Laura Chen", level: "B1", type: "ebook", cover: "📕" },
  { id: "4", title: "Advanced Conversations", author: "Michael Brown", level: "B2", type: "ebook", cover: "📙" },
  { id: "5", title: "Pronunciation Mastery", author: "Emily Davis", level: "A2", type: "audiobook", cover: "🎧" },
  { id: "6", title: "Listening Practice A1", author: "David Wilson", level: "A1", type: "audiobook", cover: "🎧" },
  { id: "7", title: "Podcast Comprehension", author: "Anna Lee", level: "B1", type: "audiobook", cover: "🎧" },
  { id: "8", title: "Idioms & Expressions", author: "Chris Taylor", level: "B2", type: "audiobook", cover: "🎧" },
];

const levelColors: Record<string, string> = {
  A1: "bg-success/15 text-success",
  A2: "bg-accent/15 text-accent",
  B1: "bg-xp/15 text-xp",
  B2: "bg-innovation/15 text-innovation",
};

function ItemCard({ item }: { item: LibraryItem }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <span className="text-4xl">{item.cover}</span>
          <Badge className={`text-[10px] border-0 ${levelColors[item.level] || ""}`}>
            {item.level}
          </Badge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
          <p className="text-xs text-muted-foreground">{item.author}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full">
          {item.type === "ebook" ? (
            <><BookOpen className="mr-1.5 h-3.5 w-3.5" /> Ler</>
          ) : (
            <><Headphones className="mr-1.5 h-3.5 w-3.5" /> Ouvir</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Library() {
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

        <TabsContent value="all">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {libraryItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ebook">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {libraryItems.filter((i) => i.type === "ebook").map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audiobook">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {libraryItems.filter((i) => i.type === "audiobook").map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
