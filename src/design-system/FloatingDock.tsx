import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface DockItem {
  to: string;
  icon: ReactNode;
}

interface FloatingDockProps {
  items?: DockItem[];
}

const FloatingDock = ({ items = [] }: FloatingDockProps) => {
  const location = useLocation();

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="float-panel flex items-center gap-0.5 px-2 py-1.5">
        {items.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink key={item.to} to={item.to} className="relative">
              <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                isActive ? "text-primary bg-primary/30" : "text-muted-foreground hover:text-foreground"
              }`}>
                {item.icon}
              </div>
              {isActive && (
                <motion.div
                  layoutId="dock-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </motion.div>
  );
};

export default FloatingDock;
