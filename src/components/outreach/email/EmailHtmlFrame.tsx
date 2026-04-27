/**
 * Sandboxed iframe for rendering email HTML content.
 * Supports two modes: "faithful" (original) and "safe" (normalized white bg).
 */

import { useRef, useEffect } from "react";
import { blockRemoteImages } from "./emailUtils";

type Props = {
  html: string;
  mode: "faithful" | "safe";
  blockRemote: boolean;
};

export function EmailHtmlFrame({ html, mode, blockRemote }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    let processedHtml = html;
    if (blockRemote) processedHtml = blockRemoteImages(processedHtml);

    const baseStyles = mode === "safe" ? `
      html, body {
        margin: 0; padding: 8px;
        background: #ffffff !important;
        color: #1a1a1a !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; line-height: 1.5;
        word-wrap: break-word; overflow-wrap: break-word;
      }
      a { color: #2563eb !important; }
    ` : `
      html, body {
        margin: 0; padding: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; line-height: 1.5;
        word-wrap: break-word; overflow-wrap: break-word;
      }
    `;

    const wrappedHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${baseStyles}
  img, svg, video, canvas, picture {
    max-width: 100% !important; height: auto !important; display: inline-block;
  }
  blockquote { border-left: 3px solid #d1d5db; margin: 8px 0; padding: 4px 12px; color: #6b7280; }
  pre, code { background: #f3f4f6; border-radius: 4px; padding: 2px 4px; font-size: 13px; overflow-x: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { word-break: break-word; }
  .email-wrapper { overflow-x: auto; max-width: 100%; }
</style>
</head>
<body><div class="email-wrapper">${processedHtml}</div></body>
</html>`;

    doc.open();
    doc.write(wrappedHtml);
    doc.close();

    // Robust height recalculation
    const recalcHeight = () => {
      if (!doc.documentElement) return;
      const h = Math.max(
        doc.documentElement.scrollHeight || 0,
        doc.body?.scrollHeight || 0,
        300
      );
      iframe.style.height = `${h}px`;
    };

    // ResizeObserver for layout changes
    const resizeObserver = new ResizeObserver(() => recalcHeight());

    // After initial write, observe + recalc at intervals (images loading)
    const t1 = setTimeout(() => {
      if (doc.body) resizeObserver.observe(doc.body);
      recalcHeight();

      const blockHorizontalWheelNavigation = (event: WheelEvent) => {
        if (Math.abs(event.deltaX) > 1) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
      doc.addEventListener("wheel", blockHorizontalWheelNavigation, { passive: false, capture: true });

      // Attach load handlers to all images for re-resize
      const imgs = doc.querySelectorAll("img");
      imgs.forEach(img => {
        if (!img.complete) {
          img.addEventListener("load", recalcHeight);
          img.addEventListener("error", recalcHeight);
        }
      });
    }, 50);

    // Periodic recalc for late-loading resources (fonts, images, css)
    const t2 = setTimeout(recalcHeight, 300);
    const t3 = setTimeout(recalcHeight, 800);
    const t4 = setTimeout(recalcHeight, 2000);
    const t5 = setTimeout(recalcHeight, 5000);

    return () => {
      resizeObserver.disconnect();
      doc.removeEventListener("wheel", (event: WheelEvent) => {
        if (Math.abs(event.deltaX) > 1) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, { capture: true });
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [html, mode, blockRemote]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      className="w-full border-0 min-h-[200px]"
      style={{ height: "300px" }}
      title="Email content"
    />
  );
}
