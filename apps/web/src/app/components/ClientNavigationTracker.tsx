"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * we're using a client side component that basically marks when an in-app (client) navigation has occurred
 *
 * so we set a global flag on window so page-level components can know whether the
 * current render is the result of a full page load (initial load / reload) or a
 * client-side route change
 * 
 * this helps us show the IntroHero only on full loads
 */
export default function ClientNavigationTracker() {
  const pathname = usePathname();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      (window as any).__hadClientNavigation = false;
      return;
    }

    (window as any).__hadClientNavigation = true;
  }, [pathname]);

  return null;
}
