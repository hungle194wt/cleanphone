export function StorageRing({ fraction }: { fraction: number }) {
  const clamped = Math.min(1, Math.max(0, fraction))
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const percent = Math.round(clamped * 100)

  return (
    <svg viewBox="0 0 120 120" className="size-28 shrink-0 text-foreground" aria-hidden>
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth="12"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${circumference * clamped} ${circumference}`}
        transform="rotate(-90 60 60)"
        className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
      />
      <text
        x="60"
        y="66"
        textAnchor="middle"
        fill="currentColor"
        fontSize="22"
        fontWeight="650"
        fontFamily="var(--font-sans), ui-sans-serif, system-ui"
      >
        {percent}%
      </text>
    </svg>
  )
}
