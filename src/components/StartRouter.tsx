import { useSearchParams, Navigate } from "react-router-dom";

export default function StartRouter() {
  const [sp] = useSearchParams();
  const mode = Number(sp.get("mode")) as 1 | 2 | 3 | null;

  if (mode === 1) return <Navigate to="/play/combo" replace />;
  if (mode === 2) return <Navigate to="/play/fof" replace />;
  if (mode === 3) return <Navigate to="/play/rhythm" replace />;
  return <Navigate to="/modes" replace />;
}
