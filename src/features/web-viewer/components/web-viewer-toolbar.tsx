import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Minus,
  Plus,
  RefreshCw,
  Lock,
  Shield,
  ShieldAlert,
  X,
  ZoomIn,
} from "lucide-react";
import { useState } from "react";
import type { RefObject } from "react";
import { Button } from "@/ui/button";
import Input from "@/ui/input";

interface WebViewerToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  copied: boolean;
  inputUrl: string;
  isLoading: boolean;
  isLocalhost: boolean;
  isSecure: boolean;
  securityToneClass: string;
  securityTooltip: string;
  urlInputRef: RefObject<HTMLInputElement | null>;
  zoomLevel: number;
  onCopyUrl: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onInputUrlChange: (value: string) => void;
  onOpenDevTools: () => void;
  onOpenExternal: () => void;
  onRefresh: () => void;
  onResetZoom: () => void;
  onStopLoading: () => void;
  onUrlSubmit: (event: React.FormEvent) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function WebViewerToolbar({
  canGoBack,
  canGoForward,
  copied,
  inputUrl,
  isLoading,
  isLocalhost,
  isSecure,
  securityToneClass,
  securityTooltip,
  urlInputRef,
  zoomLevel,
  onCopyUrl,
  onGoBack,
  onGoForward,
  onInputUrlChange,
  onOpenDevTools,
  onOpenExternal,
  onRefresh,
  onResetZoom,
  onStopLoading,
  onUrlSubmit,
  onZoomIn,
  onZoomOut,
}: WebViewerToolbarProps) {
  const SecurityIcon = isLocalhost ? Shield : isSecure ? Lock : ShieldAlert;
  const [showZoomPopover, setShowZoomPopover] = useState(false);

  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-border border-b bg-secondary-bg px-2">
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onGoBack}
          disabled={!canGoBack}
          tooltip="Go back"
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onGoForward}
          disabled={!canGoForward}
          tooltip="Go forward"
        >
          <ArrowRight />
        </Button>
      </div>

      <div className="mx-1.5 h-5 w-px bg-border" />

      <form onSubmit={onUrlSubmit} className="flex flex-1 items-center">
        <div className="relative flex flex-1 items-center">
          <div
            className={`absolute left-2.5 flex items-center ${securityToneClass}`}
            title={securityTooltip}
          >
            <SecurityIcon />
          </div>
          <Input
            ref={urlInputRef}
            type="text"
            value={inputUrl}
            onChange={(e) => onInputUrlChange(e.target.value)}
            placeholder="Enter URL..."
            className="h-7 w-full rounded-md border-border bg-primary-bg pr-20 pl-8 text-[13px] focus:border-accent focus:ring-accent/30"
          />
          <div className="absolute right-1.5 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={isLoading ? onStopLoading : onRefresh}
              className="text-text-lighter hover:text-text"
              tooltip={isLoading ? "Stop loading" : "Refresh"}
            >
              {isLoading ? <X className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onCopyUrl}
              className="text-text-lighter hover:text-text"
              tooltip="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </form>

      <div className="mx-1.5 h-5 w-px bg-border" />

      <div className="flex items-center gap-0.5">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowZoomPopover(!showZoomPopover)}
            tooltip="Zoom controls"
          >
            <ZoomIn />
          </Button>
          {showZoomPopover && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowZoomPopover(false)} />
              <div
                role="menu"
                className="absolute top-full right-0 z-[9999] mt-1 flex items-center gap-1 rounded-lg border border-border bg-secondary-bg p-1.5 shadow-lg"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onZoomOut}
                  disabled={zoomLevel <= 0.25}
                  tooltip="Zoom out"
                >
                  <Minus />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onResetZoom}
                  className="min-w-[44px] px-1.5 text-[11px] text-text-light"
                  tooltip="Reset zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onZoomIn}
                  disabled={zoomLevel >= 3}
                  tooltip="Zoom in"
                >
                  <Plus />
                </Button>
              </div>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenDevTools}
          tooltip="Open Developer Tools"
        >
          <Code2 />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onOpenExternal} tooltip="Open in browser">
          <ExternalLink />
        </Button>
      </div>
    </div>
  );
}
