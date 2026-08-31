/**
 * CorpoEmail — resa sicura del corpo HTML di un messaggio.
 *
 * Iframe sandboxed (niente script, niente navigazione): il contenuto remoto
 * non può toccare l'app. Le immagini remote sono sostituite da segnaposto
 * finché l'operatore non sceglie di mostrarle (toggle gestito dal chiamante).
 * Componente standard V3: ogni maschera che mostra un corpo email usa questo.
 */
import * as React from "react";

const SEGNAPOSTO_IMMAGINE =
  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23e5e7eb%22/%3E%3C/svg%3E";

/** Sostituisce le immagini remote con segnaposto; conserva data: e cid:. */
export function bloccaImmaginiRemote(html: string): string {
  return html.replace(
    /(<img[^>]*\s+src\s*=\s*["'])(https?:\/\/[^"']+)(["'][^>]*>)/gi,
    `$1${SEGNAPOSTO_IMMAGINE}$3`,
  );
}

interface CorpoEmailProps {
  readonly html: string;
  readonly mostraImmaginiRemote: boolean;
}

export function CorpoEmail({ html, mostraImmaginiRemote }: CorpoEmailProps): React.ReactElement {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    const contenuto = mostraImmaginiRemote ? html : bloccaImmaginiRemote(html);
    const wrapped = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body {
    margin: 0; padding: 8px;
    background: #ffffff !important;
    color: #1a1a1a !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; line-height: 1.5;
    word-wrap: break-word; overflow-wrap: break-word;
  }
  a { color: #2563eb !important; }
  img, svg, video, canvas, picture { max-width: 100% !important; height: auto !important; }
  blockquote { border-left: 3px solid #d1d5db; margin: 8px 0; padding: 4px 12px; color: #6b7280; }
  pre, code { background: #f3f4f6; border-radius: 4px; padding: 2px 4px; font-size: 13px; overflow-x: auto; }
  table { border-collapse: collapse; max-width: 100%; }
</style>
</head><body>${contenuto}</body></html>`;

    doc.open();
    doc.write(wrapped);
    doc.close();

    const ricalcola = () => {
      if (!doc.documentElement) return;
      const h = Math.max(doc.documentElement.scrollHeight || 0, doc.body?.scrollHeight || 0, 200);
      iframe.style.height = `${h}px`;
    };

    const observer = new ResizeObserver(ricalcola);
    const t1 = window.setTimeout(() => {
      if (doc.body) observer.observe(doc.body);
      ricalcola();
      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", ricalcola);
          img.addEventListener("error", ricalcola);
        }
      });
    }, 50);
    const t2 = window.setTimeout(ricalcola, 500);
    const t3 = window.setTimeout(ricalcola, 2000);

    return () => {
      observer.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [html, mostraImmaginiRemote]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      className="min-h-[200px] w-full rounded-md border border-border bg-white"
      style={{ height: "200px" }}
      title="Contenuto del messaggio"
    />
  );
}

export default CorpoEmail;
