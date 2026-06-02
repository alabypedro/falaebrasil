import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, ArrowLeft, Loader2, RotateCcw, Mic, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [grants, setGrants] = useState<
    Array<{
      id: string;
      created_at: string;
      scripted: number;
      unscripted: number;
      product_name: string;
    }>
  >([]);
  const [loadingGrants, setLoadingGrants] = useState(true);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: grantData } = await supabase
        .from("voice_credit_grants")
        .select("id, created_at, scripted_seconds_added, unscripted_seconds_added, hubla_product_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      const productIds = Array.from(
        new Set((grantData || []).map((g) => g.hubla_product_id).filter(Boolean)),
      );
      let nameMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("voice_credit_products")
          .select("hubla_product_id, display_name")
          .in("hubla_product_id", productIds);
        (products || []).forEach((p) => {
          nameMap[p.hubla_product_id] = p.display_name;
        });
      }
      setGrants(
        (grantData || []).map((g) => ({
          id: g.id,
          created_at: g.created_at,
          scripted: g.scripted_seconds_added,
          unscripted: g.unscripted_seconds_added,
          product_name: nameMap[g.hubla_product_id] || "Compra",
        })),
      );
      setLoadingGrants(false);
    })();
  }, [user]);

  const scriptedBalance = profile?.scripted_balance ?? 0;
  const unscriptedBalance = profile?.unscripted_balance ?? 0;
  const totalBalance = scriptedBalance + unscriptedBalance;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    if (file.size < 10 * 1024) {
      toast.error("A imagem deve ter no mínimo 10KB.");
      return;
    }

    setUploading(true);
    try {
      // Validar dimensões
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        const dimensions = await new Promise<{ width: number, height: number }>((resolve) => {
          img.onload = () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(objectUrl);
          };
          img.onerror = () => {
            resolve({ width: 0, height: 0 });
            URL.revokeObjectURL(objectUrl);
          };
          img.src = objectUrl;
        });

        if (dimensions.width < 200 || dimensions.height < 200) {
          toast.error("A imagem deve ter no mínimo 200x200 pixels.");
          setUploading(false);
          return;
        }
        if (dimensions.width > 4000 || dimensions.height > 4000) {
          toast.error("A imagem deve ter no máximo 4000x4000 pixels.");
          setUploading(false);
          return;
        }
      }

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl("");
    toast.info("Foto removida. Lembre-se de salvar as alterações.");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim(), avatar_url: avatarUrl || null })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Perfil salvo com sucesso!");
      // Force refresh to update context
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!user) return;
    setResetting(true);
    const { error } = await supabase.rpc("reset_all_progress");
    if (error) {
      toast.error(error.message || "Erro ao resetar progresso");
      setResetting(false);
      return;
    }
    toast.success("Todo o progresso foi resetado! 🔄");
    setTimeout(() => { window.location.href = "/"; }, 800);
  };

  const initials = (displayName || user?.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 max-w-lg page-transition">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Perfil</h1>
          <p className="text-sm text-muted-foreground">Atualize sua foto e informações.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto de Perfil</CardTitle>
          <CardDescription>
            Clique na foto para trocar.
            <div className="mt-2 text-[10px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/30 p-2 rounded-md border border-border/40">
              <span>Dimensões:</span>
              <span className="text-right">Min: 200x200px | Max: 4000x4000px</span>
              <span>Tamanho:</span>
              <span className="text-right">Min: 10KB | Max: 2048KB (2MB)</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-32 w-32 border-4 border-muted shadow-lg">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-3xl bg-primary text-primary-foreground font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity border-4 border-transparent">
                {uploading ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 text-white" />
                )}
              </div>
            </div>
            
            {avatarUrl && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={handleRemoveAvatar}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover foto
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Meus créditos de voz
          </CardTitle>
          <CardDescription>
            Segundos disponíveis para praticar no IA Falaê.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Com roteiro</p>
              <p className="text-lg font-bold tabular-nums">{scriptedBalance}s</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Livre</p>
              <p className="text-lg font-bold tabular-nums">{unscriptedBalance}s</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold tabular-nums text-primary">{totalBalance}s</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Compras recentes
            </p>
            {loadingGrants ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : grants.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma compra de créditos registrada ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {grants.map((g) => (
                  <li key={g.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{g.product_name}</p>
                      <p className="text-muted-foreground">
                        {new Date(g.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-primary">
                        +{g.scripted + g.unscripted}s
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.scripted}s + {g.unscripted}s
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de Exibição</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nível</Label>
              <p className="text-sm font-semibold">{profile?.level || "A1"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">XP Total</Label>
              <p className="text-sm font-semibold">{profile?.xp || 0}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
          <CardDescription>
            Resete todo o seu progresso: zera XP, retorna ao nível A1, marca todas as aulas como não assistidas e apaga o histórico de quizzes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={resetting}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {resetting ? "Resetando..." : "Resetar todo o progresso"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resetar TODO o seu progresso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá zerar seu XP, voltar seu nível para A1, marcar todas as aulas como não assistidas e apagar todas as suas tentativas de quiz. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAll} className="bg-destructive hover:bg-destructive/90">
                  Resetar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
