/**
 * Thumbnail preview for email attachments.
 * Shows image preview for image types, icon for others.
 */

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, getAttachmentIcon } from "./emailUtils";
import type { EmailAttachment } from "@/hooks/useEmailActions";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

type Props = {
  att: EmailAttachment;
  onDownload: () => void;
};

export function AttachmentThumbnail({ att, onDownload }: Props) {
  const isImage = att.content_type?.startsWith("image/");
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isImage && att.storage_path) {
      if (att.storage_path.startsWith("data:")) {
        setImgUrl(att.storage_path);
      } else {
        const { data } = supabase.storage.from("import-files").getPublicUrl(att.storage_path);
        if (data?.publicUrl) setImgUrl(data.publicUrl);
      }
    }
  }, [att.storage_path, isImage]);

  const Icon = getAttachmentIcon(att.content_type);

  return (
    <button onClick={onDownload}
      className="flex flex-col items-center gap-1.5 p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-xs w-[140px]">
      {isImage && imgUrl ? (
        <OptimizedImage src={imgUrl} alt={att.filename} className="w-full h-16 object-cover rounded" />
      ) : (
        <div className="w-full h-16 flex items-center justify-center bg-muted/30 rounded">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <span className="truncate w-full text-center">{att.filename}</span>
      <div className="flex items-center gap-1 text-muted-foreground">
        {att.size_bytes && <span>{formatBytes(att.size_bytes)}</span>}
        <Download className="w-3 h-3" />
      </div>
    </button>
  );
}
