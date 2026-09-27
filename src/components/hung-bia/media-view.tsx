import { useEffect, useState } from "react";
import { getImage } from "@/game/media";

export function MediaView({
  storageKey,
  rev,
  fallback,
  alt,
  className,
}: {
  storageKey: string;
  rev: number;
  fallback: string;
  alt: string;
  className?: string;
}) {
  const [blob, setBlob] = useState<Blob | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setBlob(undefined);
    getImage(storageKey)
      .then((value) => {
        if (alive) setBlob(value ?? null);
      })
      .catch(() => {
        if (alive) setBlob(null);
      });
    return () => {
      alive = false;
    };
  }, [storageKey, rev]);

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  if (url && blob?.type.startsWith("video/")) {
    return <video className={className} src={url} autoPlay muted loop playsInline aria-label={alt} />;
  }
  return <img className={className} src={url ?? fallback} alt={alt} />;
}
