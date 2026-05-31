import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Maximize2, Minimize2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PdfReader({ url, title, isOpen, onClose }: PdfReaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const updateWidth = () => {
      const el = document.getElementById('pdf-container');
      if (el) {
        setContainerWidth(el.clientWidth - 32); // margin/padding
      }
    };

    if (isOpen) {
      setTimeout(updateWidth, 300); // Wait for dialog animation
      window.addEventListener('resize', updateWidth);
    }

    return () => window.removeEventListener('resize', updateWidth);
  }, [isOpen, isFullscreen]);

  // Disable right-click and certain shortcuts when open
  useEffect(() => {
    if (!isOpen) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
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

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const next = prevPageNumber + offset;
      if (next < 1 || next > (numPages || 1)) return prevPageNumber;
      return next;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`p-0 gap-0 overflow-hidden bg-black border-none transition-all duration-300 flex flex-col [&>button]:hidden ${
          isFullscreen ? "max-w-none w-screen h-screen rounded-none z-[100]" : "max-w-5xl w-[95vw] h-[90vh]"
        }`}
      >
        <DialogHeader className="p-1 px-3 flex flex-row items-center justify-between bg-zinc-900 border-b border-zinc-800 space-y-0 min-h-0 h-8 md:h-10">
          <DialogTitle className="text-zinc-100 text-[10px] md:text-xs font-medium truncate max-w-[50%] leading-none">
            {title}
          </DialogTitle>
          
          <div className="flex items-center gap-1 md:gap-4">
            {numPages && numPages > 1 && (
              <div className="flex items-center gap-1 bg-zinc-800 rounded-md px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-white"
                  onClick={() => changePage(-1)}
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-[10px] md:text-xs text-zinc-300 min-w-[40px] text-center">
                  {pageNumber} / {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-white"
                  onClick={() => changePage(1)}
                  disabled={pageNumber >= (numPages || 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-7 w-7 md:h-8 md:w-8"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-7 w-7 md:h-8 md:w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div 
          id="pdf-container"
          className="relative flex-1 w-full bg-zinc-950 overflow-auto flex justify-center p-4 scrollbar-hide" 
          onContextMenu={(e) => e.preventDefault()}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-20">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          )}
          
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={null}
            className="flex flex-col items-center"
          >
            <Page 
              pageNumber={pageNumber} 
              width={containerWidth || undefined}
              loading={<Loader2 className="h-8 w-8 animate-spin text-zinc-600" />}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
          
          {/* Transparent protective layer */}
          <div 
            className="absolute inset-0 z-10 bg-transparent pointer-events-none"
            style={{ 
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
          />
          
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body { display: none !important; }
              .react-pdf__Page { display: none !important; }
            }
            .react-pdf__Page__canvas {
              margin: 0 auto;
              max-width: 100%;
              height: auto !important;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
