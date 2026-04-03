/**
 * Expandable panel showing technical email metadata:
 * Message-ID, SHA-256, IMAP UID/FLAGS, parse status, etc.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatBytes } from "./emailUtils";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

type Props = {
  message: ChannelMessage;
};

export function EmailTechnicalHeaders({ message }: Props) {
  const [showHeaders, setShowHeaders] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowHeaders(!showHeaders)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showHeaders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Dettagli tecnici
      </button>
      {showHeaders && (
        <div className="text-[10px] text-muted-foreground space-y-0.5 bg-muted/30 rounded p-2 font-mono">
          <div><span className="font-semibold">Message-ID:</span> {message.message_id_external}</div>
          {message.in_reply_to && <div><span className="font-semibold">In-Reply-To:</span> {message.in_reply_to}</div>}
          {message.raw_sha256 && <div><span className="font-semibold">SHA-256:</span> {message.raw_sha256}</div>}
          {message.imap_uid && <div><span className="font-semibold">IMAP UID:</span> {message.imap_uid}</div>}
          {message.uidvalidity && <div><span className="font-semibold">UIDVALIDITY:</span> {message.uidvalidity}</div>}
          {message.imap_flags && <div><span className="font-semibold">FLAGS:</span> {message.imap_flags}</div>}
          {message.internal_date && <div><span className="font-semibold">Internal Date:</span> {message.internal_date}</div>}
          {message.raw_size_bytes && <div><span className="font-semibold">Size:</span> {formatBytes(message.raw_size_bytes)}</div>}
          {message.parse_status && <div><span className="font-semibold">Parse:</span> {message.parse_status}</div>}
          {message.parse_warnings && message.parse_warnings.length > 0 && (
            <div><span className="font-semibold">Warnings:</span> {message.parse_warnings.join("; ")}</div>
          )}
        </div>
      )}
    </>
  );
}
