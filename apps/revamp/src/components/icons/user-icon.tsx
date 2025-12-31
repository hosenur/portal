import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: string;
}

function IconUser({ size = "24px", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g fill="none" className="nc-icon-wrapper">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 11C2 5.47723 6.47723 1 12 1C17.5228 1 22 5.47723 22 11C22 16.5228 17.5228 21 12 21C6.47723 21 2 16.5228 2 11Z"
          fill="url(#dewdoc7zl6q-1752500502811-9294189_user_existing_0_t4csz04ye)"
          data-glass="origin"
          mask="url(#dewdoc7zl6q-1752500502811-9294189_user_mask_s86i2afs5)"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 11C2 5.47723 6.47723 1 12 1C17.5228 1 22 5.47723 22 11C22 16.5228 17.5228 21 12 21C6.47723 21 2 16.5228 2 11Z"
          fill="url(#dewdoc7zl6q-1752500502811-9294189_user_existing_0_t4csz04ye)"
          data-glass="clone"
          filter="url(#dewdoc7zl6q-1752500502811-9294189_user_filter_nsyh9isk4)"
          clipPath="url(#dewdoc7zl6q-1752500502811-9294189_user_clipPath_1jvvjoq1t)"
        />
        <path
          d="M12.4414 14C16.3397 14.0001 19.4999 17.1603 19.5 21.0586C19.5 22.1307 18.6307 23 17.5586 23H6.44141C5.36932 23 4.5 22.1307 4.5 21.0586C4.50012 17.1603 7.6603 14.0001 11.5586 14H12.4414ZM12 5C13.933 5 15.5 6.567 15.5 8.5C15.5 10.433 13.933 12 12 12C10.067 12 8.5 10.433 8.5 8.5C8.5 6.567 10.067 5 12 5Z"
          fill="url(#dewdoc7zl6q-1752500502811-9294189_user_existing_1_bnqb6d6gm)"
          data-glass="blur"
        />
        <path
          d="M17.5586 22.25V23H6.44141V22.25H17.5586ZM18.75 21.0586C18.7499 17.5745 15.9255 14.7501 12.4414 14.75H11.5586C8.07451 14.7501 5.25012 17.5745 5.25 21.0586C5.25 21.7165 5.78354 22.25 6.44141 22.25V23L6.24316 22.9902C5.26408 22.891 4.5 22.0638 4.5 21.0586C4.50012 17.1603 7.6603 14.0001 11.5586 14H12.4414L12.8047 14.0088C16.5342 14.198 19.4999 17.2821 19.5 21.0586C19.5 22.1307 18.6307 23 17.5586 23V22.25C18.2165 22.25 18.75 21.7165 18.75 21.0586Z"
          fill="url(#dewdoc7zl6q-1752500502811-9294189_user_existing_2_duz35xtpd)"
        />
        <path
          d="M14.75 8.5C14.75 6.98122 13.5188 5.75 12 5.75C10.4812 5.75 9.25 6.98122 9.25 8.5C9.25 10.0188 10.4812 11.25 12 11.25V12C10.067 12 8.5 10.433 8.5 8.5C8.5 6.567 10.067 5 12 5C13.933 5 15.5 6.567 15.5 8.5C15.5 10.433 13.933 12 12 12V11.25C13.5188 11.25 14.75 10.0188 14.75 8.5Z"
          fill="url(#dewdoc7zl6q-1752500502811-9294189_user_existing_3_x5xjz4yjs)"
        />
        <defs>
          <linearGradient
            id="dewdoc7zl6q-1752500502811-9294189_user_existing_0_t4csz04ye"
            x1="12"
            y1="1"
            x2="12"
            y2="21"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              stopColor="var(--nc-gradient-1-color-1,#575757)"
              data-glass-11="on"
            />
            <stop
              offset="1"
              stopColor="var(--nc-gradient-1-color-2,#151515)"
              data-glass-12="on"
            />
          </linearGradient>
          <linearGradient
            id="dewdoc7zl6q-1752500502811-9294189_user_existing_1_bnqb6d6gm"
            x1="12"
            y1="5"
            x2="12"
            y2="23"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              stopColor="var(--nc-gradient-2-color-1,#E3E3E599)"
              data-glass-21="on"
            />
            <stop
              offset="1"
              stopColor="var(--nc-gradient-2-color-2,#BBBBC099)"
              data-glass-22="on"
            />
          </linearGradient>
          <linearGradient
            id="dewdoc7zl6q-1752500502811-9294189_user_existing_2_duz35xtpd"
            x1="12"
            y1="14"
            x2="12"
            y2="19.212"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--nc-light,#fff)" data-glass-light="on" />
            <stop
              offset="1"
              stopColor="var(--nc-light,#fff)"
              stopOpacity="0"
              data-glass-light="on"
            />
          </linearGradient>
          <linearGradient
            id="dewdoc7zl6q-1752500502811-9294189_user_existing_3_x5xjz4yjs"
            x1="12"
            y1="5"
            x2="12"
            y2="9.054"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--nc-light,#fff)" data-glass-light="on" />
            <stop
              offset="1"
              stopColor="var(--nc-light,#fff)"
              stopOpacity="0"
              data-glass-light="on"
            />
          </linearGradient>
          <filter
            id="dewdoc7zl6q-1752500502811-9294189_user_filter_nsyh9isk4"
            x="-100%"
            y="-100%"
            width="400%"
            height="400%"
            filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse"
          >
            <feGaussianBlur
              stdDeviation="2"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
              in="SourceGraphic"
              edgeMode="none"
              result="blur"
            />
          </filter>
          <clipPath id="dewdoc7zl6q-1752500502811-9294189_user_clipPath_1jvvjoq1t">
            <path
              d="M12.4414 14C16.3397 14.0001 19.4999 17.1603 19.5 21.0586C19.5 22.1307 18.6307 23 17.5586 23H6.44141C5.36932 23 4.5 22.1307 4.5 21.0586C4.50012 17.1603 7.6603 14.0001 11.5586 14H12.4414ZM12 5C13.933 5 15.5 6.567 15.5 8.5C15.5 10.433 13.933 12 12 12C10.067 12 8.5 10.433 8.5 8.5C8.5 6.567 10.067 5 12 5Z"
              fill="url(#dewdoc7zl6q-1752500502811-9294189_user_existing_1_bnqb6d6gm)"
            />
          </clipPath>
          <mask id="dewdoc7zl6q-1752500502811-9294189_user_mask_s86i2afs5">
            <rect width="100%" height="100%" fill="#FFF" />
            <path
              d="M12.4414 14C16.3397 14.0001 19.4999 17.1603 19.5 21.0586C19.5 22.1307 18.6307 23 17.5586 23H6.44141C5.36932 23 4.5 22.1307 4.5 21.0586C4.50012 17.1603 7.6603 14.0001 11.5586 14H12.4414ZM12 5C13.933 5 15.5 6.567 15.5 8.5C15.5 10.433 13.933 12 12 12C10.067 12 8.5 10.433 8.5 8.5C8.5 6.567 10.067 5 12 5Z"
              fill="#000"
            />
          </mask>
        </defs>
      </g>
    </svg>
  );
}

export default IconUser;
