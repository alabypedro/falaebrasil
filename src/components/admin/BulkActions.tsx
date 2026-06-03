import { Button } from "@/components/ui/button";
import { Trash2, Eye, EyeOff, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onPublish?: (status: boolean) => void;
  label?: string;
}

export function BulkActions({ selectedCount, onClear, onDelete, onPublish, label = "itens" }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 pr-4 border-r">
        <Badge variant="secondary" className="rounded-full px-2">{selectedCount}</Badge>
        <span className="text-sm font-medium">{label} selecionados</span>
      </div>
      
      <div className="flex items-center gap-2">
        {onPublish && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onPublish(true)} className="h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
              <Eye className="h-4 w-4" /> Publicar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onPublish(false)} className="h-8 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
              <EyeOff className="h-4 w-4" /> Rascunho
            </Button>
          </>
        )}
        
        {onDelete && (
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 gap-1.5 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        )}
        
        <div className="w-px h-4 bg-border mx-2" />
        
        <Button size="sm" variant="ghost" onClick={onClear} className="h-8 w-8 p-0 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
