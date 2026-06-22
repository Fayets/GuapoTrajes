/** Ícono de percha (conjunto ya separado en perchero). */
export function IconoPercha({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 6.5a4 4 0 1 1 8 0" />
      <path d="M4 10.5h16l-2.5 9H6.5l-2.5-9z" />
      <path d="M12 10.5v9" />
    </svg>
  );
}
