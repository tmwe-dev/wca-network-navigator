import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { CockpitFilter } from "@/types/cockpit";

interface ActiveFilterChipsProps {
  filters: CockpitFilter[];
  onRemove: (id: string) => void;
}

export function ActiveFilterChips({ filters, onRemove }: ActiveFilterChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="px-4 pb-2 flex flex-wrap gap-1.5"
    >
      {filters.map((filter, i) => (
        <motion.span
          key={filter.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: i * 0.05 }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 backdrop-blur-sm"
        >
          {filter.label}
          <button
            onClick={() => onRemove(filter.id)}
            className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.span>
      ))}
    </motion.div>
  );
}
