import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface TemplateSuggestProps {
  visible: boolean;
  label?: string;
  onSave?: () => void;
}

const TemplateSuggest = ({ visible, label = "Salva come template", onSave }: TemplateSuggestProps) => {
  if (!visible) return null;

  const handleSave = () => {
    onSave?.();
    toast("Template salvato", {
      description: "Disponibile in Template Library · Audit log aggiornato",
      duration: 3000,
    });
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6, ease }}
      onClick={handleSave}
      className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground/88 hover:text-primary/92 transition-all duration-700 group"
    >
      <Bookmark className="w-3 h-3 group-hover:text-primary/65 transition-colors duration-500" />
      <span className="font-light tracking-wide">{label}</span>
    </motion.button>
  );
};

export default TemplateSuggest;