import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { pinnedNavItems } from "@/v2/ui/templates/navConfig";

const FloatingDock = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) =>
    path === "/v2" ? location.pathname === "/v2" : location.pathname.startsWith(path);

  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 30 }}
      className="fixed left-3 top-1/2 -translate-y-1/2 z-50"
    >
      <div className="float-panel flex flex-col items-center gap-0.5 px-1.5 py-2">
        {pinnedNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <NavLink key={item.path} to={item.path} className="relative group" title={t(item.labelKey)}>
              <div
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  active ? "text-primary bg-primary/30" : "text-muted-foreground/90 hover:text-foreground"
                }`}
              >
                {item.icon}
              </div>
              {active && (
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
