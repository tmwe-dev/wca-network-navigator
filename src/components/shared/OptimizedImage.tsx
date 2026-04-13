interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: "lazy" | "eager";
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
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
    />
  );
}
