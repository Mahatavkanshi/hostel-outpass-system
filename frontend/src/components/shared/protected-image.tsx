"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { apiBlob } from "@/lib/api";

export function ProtectedImage({
  src,
  token,
  alt,
}: {
  src: string;
  token: string;
  alt: string;
}) {
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    let active = true;
    let url = "";
    apiBlob(src, token)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => setObjectUrl(""));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, token]);

  if (!objectUrl) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded border border-zinc-200 bg-zinc-100 text-xs text-zinc-500">
        Loading
      </div>
    );
  }

  return (
    <Image
      src={objectUrl}
      alt={alt}
      width={240}
      height={180}
      unoptimized
      className="aspect-[4/3] w-full rounded border border-zinc-200 object-cover"
    />
  );
}
