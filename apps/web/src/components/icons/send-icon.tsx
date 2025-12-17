import type React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: string;
}

export default function SendIcon({ size = "24px", ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <title>Send</title>
      <g clipPath="url(#clip0_send)">
        <path d="M18.07 8.51062L9.51002 4.23062C3.76002 1.35062 1.40002 3.71062 4.28002 9.46062L5.15002 11.2006C5.40002 11.7106 5.40002 12.3006 5.15002 12.8106L4.28002 14.5406C1.40002 20.2906 3.75002 22.6506 9.51002 19.7706L18.07 15.4906C21.91 13.5706 21.91 10.4306 18.07 8.51062ZM14.84 12.7506H9.44002C9.03002 12.7506 8.69002 12.4106 8.69002 12.0006C8.69002 11.5906 9.03002 11.2506 9.44002 11.2506H14.84C15.25 11.2506 15.59 11.5906 15.59 12.0006C15.59 12.4106 15.25 12.7506 14.84 12.7506Z" />
      </g>
      <defs>
        <clipPath id="clip0_send">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
