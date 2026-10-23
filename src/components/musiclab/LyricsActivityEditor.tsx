import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Save, Loader2, Timer } from 'lucide-react';
import LyricsSyncPanel from './LyricsSyncPanel';
import { toast } from 'sonner';
import { readLyricsActivity, type LyricsActivity, type LyricLine } from '@/lib/cantaeGame';
import { youtubeId } from '@/lib/musicMedia';

export default function LyricsActivityEditor({ song, onClose, onSaved }: { song: { id: string; title: string; lyrics_activity?: unknown }; onClose: () => void; onSaved: () => void }) {
  const existing = readLyricsActivity(song.lyrics_activity);
  const [url, setUrl] = useState(existing?.youtube_url ?? '');
  const [lines, setLines] = useState<LyricLine[]>(existing?.lines ?? [{ en: '', pt: '', start: 0 }]);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const update = (i: number, patch: Partial<LyricLine>) => setLines(previous => previous.map((line, index) => index === i ? { ...line, ...patch } : line));
  const save = async () => {
    const activity: LyricsActivity = { youtube_url: url.trim(), lines };
    if (!youtubeId(url)) return toast.error('Informe o link do clipe oficial no YouTube.');
    if (!readLyricsActivity(activity)) return toast.error('Preencha inglês e tradução em todas as linhas, com tempos crescentes em segundos.');
    if (!authorized) return toast.error('Confirme a autorização para usar a letra e a tradução.');
    setSaving(true);
    const { error } = await supabase.from('music_lab_songs').update({ lyrics_activity: { youtube_url: activity.youtube_url, lines: lines.map(line => ({ ...line, en: line.en.trim(), pt: line.pt.trim() })) } }).eq('id', song.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Nova atividade salva; atividade anterior preservada.'); onSaved(); onClose();
  };
  return <Dialog open onOpenChange={value => { if (!value && !saving) onClose(); }}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Nova atividade — {song.title}</DialogTitle></DialogHeader>
    <div className="space-y-2"><Label htmlFor="official-clip">Clipe oficial do YouTube (sem vídeo de letras)</Label><Input id="official-clip" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></div>
    {syncing ? <LyricsSyncPanel url={url} lines={lines} onChange={setLines} onDone={() => setSyncing(false)} /> :
      <Button variant="secondary" disabled={!youtubeId(url) || lines.length === 0} onClick={() => setSyncing(true)}><Timer className="h-4 w-4 mr-2" />Sincronizar tempos com o vídeo</Button>}
    <div className="space-y-4">{lines.map((line, i) => <div key={i} className="border-b border-border pb-4 space-y-2">
      <div className="flex items-center justify-between"><Label>Linha {i + 1}</Label><Button size="icon" variant="ghost" aria-label={`Excluir linha ${i + 1}`} onClick={() => setLines(prev => prev.filter((_, index) => index !== i))}><Trash2 className="h-4 w-4" /></Button></div>
      <Label htmlFor={`lyric-time-${i}`}>Início no clipe (segundos)</Label><Input id={`lyric-time-${i}`} type="number" min="0" step="0.1" value={line.start} onChange={e => update(i, { start: Number(e.target.value) })} />
      <Label htmlFor={`lyric-en-${i}`}>Letra em inglês</Label><Textarea id={`lyric-en-${i}`} value={line.en} onChange={e => update(i, { en: e.target.value })} rows={2} />
      <Label htmlFor={`lyric-pt-${i}`}>Tradução em português</Label><Textarea id={`lyric-pt-${i}`} value={line.pt} onChange={e => update(i, { pt: e.target.value })} rows={2} />
    </div>)}</div>
    <Button variant="outline" onClick={() => setLines(prev => [...prev, { en: '', pt: '', start: (prev[prev.length - 1]?.start ?? 0) + 5 }])}><Plus className="h-4 w-4 mr-2" />Adicionar linha</Button>
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={authorized} onCheckedChange={value => setAuthorized(value === true)} />Tenho autorização para usar a letra completa e sua tradução e conferi que correspondem a este clipe oficial.</label>
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Salvar nova atividade</Button></div>
  </DialogContent></Dialog>;
}