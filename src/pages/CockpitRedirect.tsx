import { Navigate, useLocation } from "react-router-dom";

export default function CockpitRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = location.pathname === "/sorting" ? "revisiona" : "genera";
  params.set("tab", tab);
  return <Navigate to={`/cockpit?${params.toString()}`} replace />;
}
