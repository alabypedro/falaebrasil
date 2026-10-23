import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { youtubeEmbed } from '@/lib/musicMedia';
import type { LyricsActivity } from '@/lib/cantaeGame';

export default function LyricsPracticeDialog({ activity, title, videoId, open, onOpenChange }: {
  activity: LyricsActivity;
  title: string;
  videoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useLanguage();
  const en = language === 'en';

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby={undefined} className="lyrics-practice-dialog gap-0 overflow-hidden rounded-none border-0 p-0">
      <DialogHeader className="min-w-0 justify-center border-b border-border px-4 pr-12 text-left">
        <DialogTitle className="truncate text-base">{title} — lyrics</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 bg-muted" aria-label={en ? 'Music video' : 'Videoclipe'}>
        {videoId && <iframe
          src={youtubeEmbed(videoId)}
          title={`${title} — ${en ? 'Music video' : 'Videoclipe'}`}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />}
      </div>
      <section className="flex min-h-0 flex-col" aria-label={en ? 'Bilingual lyrics' : 'Letra bilíngue'}>
        <div className="grid shrink-0 grid-cols-2 gap-x-4 border-b border-border px-4 py-2 text-xs font-semibold uppercase text-muted-foreground sm:gap-x-8 sm:px-6">
          <span>English</span><span>{en ? 'Portuguese' : 'Português'}</span>
        </div>
        <div tabIndex={0} role="region" aria-label={en ? 'Scroll lyrics' : 'Rolar letra'} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
          {activity.lines.map((line, i) => <div key={i} className="grid grid-cols-2 gap-x-4 border-b border-border/40 py-1.5 sm:gap-x-8">
            <p className="min-w-0 break-words text-sm font-medium leading-6 text-foreground sm:text-base">{line.en}</p>
            <p className="min-w-0 break-words text-sm italic leading-6 text-muted-foreground sm:text-base">{line.pt}</p>
          </div>)}
        </div>
      </section>
    </DialogContent>
  </Dialog>;
}