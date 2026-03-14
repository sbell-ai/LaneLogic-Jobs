import { useEffect } from "react";
import { useLocation } from "wouter";

const CANONICAL_HOST = "https://lanelogicjobs.com";

function getCanonicalUrl(pathname: string): string {
  const cleanPath = pathname.replace(/\?.*$/, "").replace(/#.*$/, "");
  return `${CANONICAL_HOST}${cleanPath}`;
}

export function useCanonical() {
  const [location] = useLocation();

  useEffect(() => {
    const canonicalUrl = getCanonicalUrl(location);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalUrl;
  }, [location]);
}
