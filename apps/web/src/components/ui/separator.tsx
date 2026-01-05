import {
  Separator as AriaSeparator,
  type SeparatorProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <AriaSeparator
      orientation={orientation}
      className={twMerge(
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        "bg-border",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
