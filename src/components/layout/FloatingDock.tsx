import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, MessageSquare, Sparkles, Mail, MessageCircle, Linkedin, Layers, Zap, Shield, Settings } from "lucide-react";

const items = [
  { to: "/v2", icon: Home, label: "Home" },
  { to: "/v2/command", icon: MessageSquare, label: "Command" },
  { to: "/v2/agents", icon: Sparkles, label: "Agenti" },
  { to: "/v2/inreach", icon: Mail, label: "Email" },
  { to: "/v2/outreach", icon: MessageCircle, label: "Comunicazioni" },
  { to: "/v2/crm/contacts", icon: Linkedin, label: "Contatti" },
  { to: "/v2/templates", icon: Layers, label: "Template" },
  { to: "/v2/automations", icon: Zap, label: "Automazioni" },
  { to: "/v2/audit", icon: Shield, label: "Audit" },
  { to: "/v2/settings", icon: Settings, label: "Impostazioni" },
];

const FloatingDock = () => {
  const location = useLocation();

  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 30 }}
      className="fixed left-3 top-1/2 -translate-y-1/2 z-50"
    >
      <div className="float-panel flex flex-col items-center gap-0.5 px-1.5 py-2">
        {items.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink key={item.to} to={item.to} className="relative group" title={item.label}>
              <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                isActive ? "text-primary bg-primary/30" : "text-muted-foreground/96 hover:text-foreground"
              }`}>
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
              </div>
              {isActive && (
                <motion.div
                  layoutId="dock-dot"
                  className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 bg-primary/90 rounded-full"
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
