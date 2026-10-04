/**
 * NurseLearn PH brand mark — a medical cross over a subtle ECG pulse,
 * on a clinical-teal gradient badge. Used in the sidebar header and
 * the login page.
 */
export default function Logo({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="NurseLearn PH"
    >
      <defs>
        <linearGradient
          id="nl-grad"
          x1="8"
          y1="4"
          x2="56"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0a6b61" />
          <stop offset="1" stopColor="#16ab9d" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#nl-grad)" />
      {/* medical cross */}
      <path d="M28 11h8v13h13v8H36v13h-8V32H15v-8h13z" fill="#ffffff" />
      {/* ECG pulse */}
      <path
        d="M7 51h9l3.5-6 4.5 10 3.5-4H57"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
