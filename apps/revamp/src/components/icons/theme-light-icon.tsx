import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: string;
}

export function IconThemeLight({ size = "18px", ...props }: IconProps) {
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
        d="M7.81794 3.62417C11.3653 2.87982 14.5 5.57361 14.5 8.99999C14.5 11.139 13.2764 12.9817 11.5 13.8897V15.25H6.49997V13.8897C4.47225 12.8528 3.16639 10.5975 3.57418 8.08475C3.92975 5.89423 5.63841 4.08156 7.81794 3.62417Z"
        fill="currentColor"
        fillOpacity="0.4"
        data-color="color-2"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 0C9.41421 0 9.75 0.335786 9.75 0.75V1.75C9.75 2.16421 9.41421 2.5 9 2.5C8.58579 2.5 8.25 2.16421 8.25 1.75V0.75C8.25 0.335786 8.58579 0 9 0Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.3643 2.63566C15.6572 2.92855 15.6572 3.40342 15.3643 3.69632L14.6573 4.40331C14.3644 4.69621 13.8895 4.69621 13.5966 4.40331C13.3037 4.11042 13.3037 3.63555 13.5966 3.34265L14.3036 2.63566C14.5965 2.34276 15.0714 2.34276 15.3643 2.63566Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.5 9C15.5 8.58579 15.8358 8.25 16.25 8.25H17.25C17.6642 8.25 18 8.58579 18 9C18 9.41421 17.6642 9.75 17.25 9.75H16.25C15.8358 9.75 15.5 9.41421 15.5 9Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.63569 2.63566C2.92858 2.34276 3.40345 2.34276 3.69635 2.63566L4.40335 3.34265C4.69624 3.63555 4.69624 4.11042 4.40335 4.40331C4.11045 4.69621 3.63558 4.69621 3.34269 4.40331L2.63569 3.69632C2.34279 3.40342 2.34279 2.92855 2.63569 2.63566Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 9C0 8.58579 0.335786 8.25 0.75 8.25H1.75C2.16421 8.25 2.5 8.58579 2.5 9C2.5 9.41421 2.16421 9.75 1.75 9.75H0.75C0.335786 9.75 0 9.41421 0 9Z"
        fill="currentColor"
      />
      <path
        d="M11.5007 14L11.5001 15.25C11.5001 16.4926 10.4927 17.5 9.25009 17.5H8.75008C7.50742 17.5 6.50001 16.4926 6.50001 15.25L6.49995 14.0004L11.5007 14Z"
        fill="currentColor"
      />
    </svg>
  );
}
