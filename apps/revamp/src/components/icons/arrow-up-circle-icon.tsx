import type React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: string;
}

export default function ArrowUpCircleIcon({
  size = "24px",
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <title>Arrow Up</title>
      <path d="M12 17v-14" />
      <path d="M15 6l-3 -3l-3 3" />
      <path d="M12 17a2 2 0 1 0 0 4a2 2 0 0 0 0 -4" />
    </svg>
  );
}
