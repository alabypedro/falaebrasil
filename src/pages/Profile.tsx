import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
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
          <CardDescription>Clique na foto para trocar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-primary-foreground" />
              )}
            </div>
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
