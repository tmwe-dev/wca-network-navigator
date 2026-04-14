import React from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: "lazy" | "eager";
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
  onError,
}: OptimizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding="async"
      onError={onError}
    />
  );
}
