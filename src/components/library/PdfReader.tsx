import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface PdfReaderProps {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PdfReader({ url, title, isOpen, onClose }: PdfReaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Disable right-click and certain shortcuts when open
  useEffect(() => {
    if (!isOpen) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+S, Ctrl+P, Ctrl+U
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "s" || e.key === "p" || e.key === "u")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Use the direct URL. Adding #toolbar=0 can sometimes cause blocks in certain browser versions.
  const displayUrl = url;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`p-0 gap-0 overflow-hidden bg-black border-none transition-all duration-300 ${
          isFullscreen ? "max-w-none w-screen h-screen rounded-none z-[100]" : "max-w-5xl w-[95vw] h-[90vh]"
        }`}
      >
        <DialogHeader className="p-4 flex flex-row items-center justify-between bg-zinc-900 border-b border-zinc-800 space-y-0">
          <DialogTitle className="text-zinc-100 text-sm md:text-base font-medium truncate max-w-[70%]">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative flex-1 w-full h-full bg-zinc-900 overflow-hidden">
          {/* 
            Using <object> with an <iframe> fallback is the most robust way to embed PDFs.
            This helps avoid "Blocked by Chrome" errors by letting the browser choose 
             the best plugin handler.
          */}
          <object
            data={displayUrl}
            type="application/pdf"
            className="w-full h-full border-none"
            style={{ width: '100%', height: '100%' }}
          >
            <iframe
              src={displayUrl}
              className="w-full h-full border-none"
              title={title}
              style={{ width: '100%', height: '100%' }}
            />
          </object>
          
          {/* 
            Invisible protection overlay
          */}
          <div 
            className="absolute inset-0 z-10 pointer-events-none" 
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {/* CSS to help block printing and hide scrollbars */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body { display: none !important; }
              iframe, embed, object { display: none !important; }
            }
          `}} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
