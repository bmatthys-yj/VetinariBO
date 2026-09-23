export function EmptyState({
  children,
  className = "px-5 py-12",
}: {
  children: string;
  className?: string;
}) {
  return <p className={`${className} text-center text-sm text-muted-foreground`}>{children}</p>;
}
