import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, Pencil, Shield } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface GovernanceInfo {
  role: string;
  permission: string;
  policy: string;
}

interface ApprovalPanelProps {
  visible: boolean;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  governance?: GovernanceInfo;
  onApprove: () => void;
  onModify?: () => void;
  onCancel: () => void;
}

const ApprovalPanel = ({ visible, title, description, details, governance, onApprove, onModify, onCancel }: ApprovalPanelProps) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.5, ease }}
        className="rounded-2xl p-5 mt-4"
        style={{
          background: "hsl(240 5% 6% / 0.7)",
          backdropFilter: "blur(40px)",
          border: "1px solid hsl(152 60% 45% / 0.12)",
          boxShadow: "0 0 40px hsl(152 60% 45% / 0.03)",
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-3.5 h-3.5 text-success/80 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[13px] font-light text-foreground/95 mb-1">{title}</div>
            <p className="text-[11px] text-muted-foreground/96 leading-relaxed">{description}</p>
          </div>
        </div>

        {details && details.length > 0 && (
          <div className="mb-4 ml-6 space-y-1.5">
            {details.map((d, i) => (
              <motion.div
                key={d.label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06, ease }}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-muted-foreground/90">{d.label}</span>
                <span className="text-foreground/100 font-mono text-[10px]">{d.value}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Governance strip */}
        {governance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, ease }}
            className="mb-4 ml-6 flex items-center gap-3 py-2 px-3 rounded-lg"
            style={{ background: "hsl(152 60% 45% / 0.05)", border: "1px solid hsl(152 60% 45% / 0.08)" }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-success/55" />
              <span className="text-[8px] text-success/80 font-mono tracking-wider">{governance.role}</span>
            </div>
            <span className="text-[6px] text-muted-foreground/92">·</span>
            <span className="text-[8px] text-muted-foreground/88 font-mono">{governance.permission}</span>
            <span className="text-[6px] text-muted-foreground/92">·</span>
            <span className="text-[8px] text-muted-foreground/88 font-mono">{governance.policy}</span>
          </motion.div>
        )}

        <div className="flex items-center gap-2 ml-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onApprove}
            className="text-[11px] px-4 py-2 rounded-xl bg-success/10 text-success/80 hover:bg-success/15 hover:text-success/90 transition-all duration-500 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3 h-3" /> Conferma
          </motion.button>
          {onModify && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onModify}
              className="text-[11px] px-4 py-2 rounded-xl text-muted-foreground/90 hover:text-muted-foreground/90 hover:bg-secondary/[0.1] transition-all duration-500 flex items-center gap-1.5"
            >
              <Pencil className="w-3 h-3" /> Modifica
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCancel}
            className="text-[11px] px-3 py-2 rounded-xl text-muted-foreground/88 hover:text-muted-foreground/96 transition-all duration-500"
          >
            <X className="w-3 h-3" />
          </motion.button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ApprovalPanel;