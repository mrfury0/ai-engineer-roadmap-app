import { useCallback, useEffect, useState } from "react";

export interface Route { view: string; param: string | null }

function parse(hash: string): Route {
  const clean = (hash || "#dashboard").replace(/^#/, "");
  const [view, param] = clean.split("/");
  return { view: view || "dashboard", param: param ?? null };
}

/** Hash routing: keeps the app a static file that works on GitHub Pages with no server rewrites. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((view: string, param?: string | null) => {
    const next = `#${view}${param ? `/${param}` : ""}`;
    if (window.location.hash === next) setRoute(parse(next));
    else window.location.hash = next;
  }, []);

  return { route, navigate };
}
