import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Save, Loader2, Timer, ClipboardPaste } from 'lucide-react';
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
  const [dirty, setDirty] = useState(false);
  const changeLines = (next: LyricLine[]) => { setLines(next); setDirty(true); };
  const update = (i: number, patch: Partial<LyricLine>) => { setLines(previous => previous.map((line, index) => index === i ? { ...line, ...patch } : line)); setDirty(true); };
  const save = async (current: LyricLine[] = lines) => {
    const activity: LyricsActivity = { youtube_url: url.trim(), lines: current };
    if (!youtubeId(url)) return toast.error('Informe o link do clipe oficial no YouTube.');
    if (!readLyricsActivity(activity)) return toast.error('Preencha inglês e tradução em todas as linhas, com tempos crescentes em segundos.');
    if (!authorized) return toast.error('Marque a caixa de autorização no topo para salvar.');
    setSaving(true);
    const { error } = await supabase.from('music_lab_songs').update({ lyrics_activity: { youtube_url: activity.youtube_url, lines: current.map(line => ({ ...line, en: line.en.trim(), pt: line.pt.trim() })) } }).eq('id', song.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
    toast.success('Atividade salva.'); onSaved(); onClose();
  };
  const requestClose = () => {
    if (saving) return;
    if (dirty && !window.confirm('Você tem alterações não salvas (como as marcações de tempo). Sair sem salvar?')) return;
    onClose();
  };
  return <Dialog open onOpenChange={value => { if (!value) requestClose(); }}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}><DialogHeader><DialogTitle>Nova atividade — {song.title}</DialogTitle></DialogHeader>
    <div className="space-y-2"><Label htmlFor="official-clip">Clipe oficial do YouTube (sem vídeo de letras)</Label><Input id="official-clip" value={url} onChange={e => { setUrl(e.target.value); setDirty(true); }} placeholder="https://www.youtube.com/watch?v=..." /></div>
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={authorized} onCheckedChange={value => setAuthorized(value === true)} />Tenho autorização para usar a letra completa e sua tradução e conferi que correspondem a este clipe oficial.</label>
    {syncing ? <LyricsSyncPanel url={url} lines={lines} onChange={changeLines} saving={saving} onDone={() => { setSyncing(false); void save(lines); }} onCancel={() => setSyncing(false)} /> :
      <Button variant="secondary" disabled={!youtubeId(url) || lines.length === 0} onClick={() => setSyncing(true)}><Timer className="h-4 w-4 mr-2" />Sincronizar tempos com o vídeo</Button>}
    <div className="space-y-4">{lines.map((line, i) => <div key={i} className="border-b border-border pb-4 space-y-2">
      <div className="flex items-center justify-between"><Label>Linha {i + 1}</Label><Button size="icon" variant="ghost" aria-label={`Excluir linha ${i + 1}`} onClick={() => changeLines(lines.filter((_, index) => index !== i))}><Trash2 className="h-4 w-4" /></Button></div>
      <Label htmlFor={`lyric-time-${i}`}>Início no clipe (segundos)</Label><Input id={`lyric-time-${i}`} type="number" min="0" step="0.1" value={line.start} onChange={e => update(i, { start: Number(e.target.value) })} />
      <Label htmlFor={`lyric-en-${i}`}>Letra em inglês</Label><Textarea id={`lyric-en-${i}`} value={line.en} onChange={e => update(i, { en: e.target.value })} rows={2} />
      <Label htmlFor={`lyric-pt-${i}`}>Tradução em português</Label><Textarea id={`lyric-pt-${i}`} value={line.pt} onChange={e => update(i, { pt: e.target.value })} rows={2} />
    </div>)}</div>
    <Button variant="outline" onClick={() => changeLines([...lines, { en: '', pt: '', start: (lines[lines.length - 1]?.start ?? 0) + 5 }])}><Plus className="h-4 w-4 mr-2" />Adicionar linha</Button>
    <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-background p-4"><Button variant="outline" disabled={saving} onClick={requestClose}>Cancelar</Button><Button onClick={() => save()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Salvar atividade</Button></div>
  </DialogContent></Dialog>;
}