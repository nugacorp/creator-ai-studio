import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { loadAuthenticatedMediaUrl } from '../api';

interface SceneImageProps {
  src?: string;
  alt: string;
  className?: string;
}

/** Loads episode scene images through authenticated API (img tags cannot send JWT). */
export default function SceneImage({ src, alt, className }: SceneImageProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src?.trim()) {
      setDisplayUrl(null);
      setFailed(false);
      return;
    }

    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) {
      setDisplayUrl(src);
      setFailed(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    void loadAuthenticatedMediaUrl(src)
      .then(url => {
        if (cancelled) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setDisplayUrl(url);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) {
          setDisplayUrl(null);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 bg-gradient-to-br from-[#15191E] to-[#0B0F14] px-4 text-center">
        <ImageIcon className="w-8 h-8 opacity-40" />
        <span className="text-[10px]">
          {failed ? 'No se pudo cargar — regenera la imagen' : 'Sin imagen — genera con IA'}
        </span>
      </div>
    );
  }

  if (!displayUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#15191E] text-[10px] text-slate-500">
        Cargando…
      </div>
    );
  }

  return <img src={displayUrl} alt={alt} className={className} referrerPolicy="no-referrer" />;
}
