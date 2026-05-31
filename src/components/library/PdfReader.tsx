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

  // Append toolbar=0 to the URL to hide the native PDF toolbar in many browsers
  const protectedUrl = url.includes("#") 
    ? url.split("#")[0] + "#toolbar=0&navpanes=0" 
    : url + "#toolbar=0&navpanes=0";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`p-0 gap-0 overflow-hidden bg-black/95 border-none transition-all duration-300 ${
          isFullscreen ? "max-w-none w-screen h-screen rounded-none" : "max-w-5xl w-[95vw] h-[90vh]"
        }`}
      >
        <DialogHeader className="p-4 flex flex-row items-center justify-between bg-zinc-900 border-b border-zinc-800 space-y-0">
          <DialogTitle className="text-zinc-100 text-base font-medium truncate max-w-[70%]">
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

        <div className="relative flex-1 w-full h-full select-none bg-zinc-900">
          {/* 
            This div is a protection layer that catches right-clicks and 
            makes it harder to interact with the iframe's internal controls.
            We leave the pointer events auto so users can still scroll if the browser allows.
          */}
          <iframe
            src={protectedUrl}
            className="w-full h-full border-none pointer-events-auto"
            title={title}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {/* CSS to help block printing */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body { display: none !important; }
            }
            /* Hide the download/print overlay that some browsers show on hover */
            iframe::-webkit-scrollbar {
              display: none;
            }
          `}} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
