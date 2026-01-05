import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  strokeWidth?: number;
  size?: string;
}

export function IconGridPlus({
  strokeWidth = 1.5,
  size = "18px",
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      {...props}
    >
      <path
        d="M5 7.5C6.38071 7.5 7.5 6.38071 7.5 5C7.5 3.61929 6.38071 2.5 5 2.5C3.61929 2.5 2.5 3.61929 2.5 5C2.5 6.38071 3.61929 7.5 5 7.5Z"
        fill="currentColor"
        fillOpacity="0.3"
        data-color="color-2"
        data-stroke="none"
      />
      <path
        d="M13 7.5C14.3807 7.5 15.5 6.38071 15.5 5C15.5 3.61929 14.3807 2.5 13 2.5C11.6193 2.5 10.5 3.61929 10.5 5C10.5 6.38071 11.6193 7.5 13 7.5Z"
        fill="currentColor"
        fillOpacity="0.3"
        data-color="color-2"
        data-stroke="none"
      />
      <path
        d="M5 15.5C6.38071 15.5 7.5 14.3807 7.5 13C7.5 11.6193 6.38071 10.5 5 10.5C3.61929 10.5 2.5 11.6193 2.5 13C2.5 14.3807 3.61929 15.5 5 15.5Z"
        fill="currentColor"
        fillOpacity="0.3"
        data-color="color-2"
        data-stroke="none"
      />
      <path
        d="M13 10.25V15.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M15.5 12.75H10.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M5 7.5C6.38071 7.5 7.5 6.38071 7.5 5C7.5 3.61929 6.38071 2.5 5 2.5C3.61929 2.5 2.5 3.61929 2.5 5C2.5 6.38071 3.61929 7.5 5 7.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M13 7.5C14.3807 7.5 15.5 6.38071 15.5 5C15.5 3.61929 14.3807 2.5 13 2.5C11.6193 2.5 10.5 3.61929 10.5 5C10.5 6.38071 11.6193 7.5 13 7.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M5 15.5C6.38071 15.5 7.5 14.3807 7.5 13C7.5 11.6193 6.38071 10.5 5 10.5C3.61929 10.5 2.5 11.6193 2.5 13C2.5 14.3807 3.61929 15.5 5 15.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
