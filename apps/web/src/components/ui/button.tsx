"use client";

import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
} from "react-aria-components";
import { tv, type VariantProps } from "tailwind-variants";
import { cx } from "@/lib/primitive";

export const buttonStyles = tv({
  base: [
    "[--btn-radius:var(--radius-xl)] [--btn-icon-active:var(--btn-fg)] [--btn-outline:var(--btn-stroke-start)] [--btn-focus-ring:var(--btn-stroke-start)]",
    "relative isolate inline-flex items-center justify-center rounded-(--btn-radius) border border-transparent font-medium text-(--btn-fg) outline-(--btn-outline) transition-[background,box-shadow,color,opacity] duration-150 hover:no-underline",
    "[background:linear-gradient(180deg,var(--btn-fill-start)_0%,var(--btn-fill-end)_100%)_padding-box,linear-gradient(180deg,var(--btn-stroke-start)_0%,var(--btn-stroke-end)_100%)_border-box]",
    "[box-shadow:0_2px_4px_rgb(0_0_0/0.1),0_0_0_1px_var(--btn-shadow-ring)]",
    "enabled:hover:[--btn-fill-start:var(--btn-fill-hover-start)] enabled:hover:[--btn-fill-end:var(--btn-fill-hover-end)] pressed:[--btn-fill-start:var(--btn-fill-active-start)] pressed:[--btn-fill-end:var(--btn-fill-active-end)]",
    "focus:outline-0 focus-visible:outline focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-(--btn-focus-ring) focus-visible:ring-offset-3 focus-visible:ring-offset-bg",
    "*:data-[slot=icon]:-mx-0.5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:self-center *:data-[slot=icon]:text-(--btn-icon) focus-visible:*:data-[slot=icon]:text-(--btn-icon-active)/80 hover:*:data-[slot=icon]:text-(--btn-icon-active)/90 forced-colors:[--btn-icon:ButtonText] forced-colors:hover:[--btn-icon:ButtonText]",
    "*:data-[slot=loader]:-mx-0.5 *:data-[slot=loader]:shrink-0 *:data-[slot=loader]:self-center *:data-[slot=loader]:text-(--btn-icon)",
    "pending:opacity-50 disabled:opacity-50 disabled:forced-colors:text-[GrayText]",
    "*:data-[slot=color-swatch]:-mx-0.5 *:data-[slot=color-swatch]:shrink-0 *:data-[slot=color-swatch]:self-center *:data-[slot=color-swatch]:[--color-swatch-size:--spacing(5)]",
  ],
  variants: {
    intent: {
      primary:
        "[--btn-fill-start:#201E25] [--btn-fill-end:#323137] [--btn-fill-hover-start:#292730] [--btn-fill-hover-end:#3A3940] [--btn-fill-active-start:#1A181F] [--btn-fill-active-end:#2B2A30] [--btn-stroke-start:#4B4951] [--btn-stroke-end:#313036] [--btn-shadow-ring:#0D0D0D] [--btn-fg:#F4F4F5] [--btn-icon:#F4F4F5]/70 [--btn-icon-active:#F4F4F5]",
      secondary:
        "[--btn-fill-start:color-mix(in_oklab,var(--color-secondary)_96%,var(--color-bg)_4%)] [--btn-fill-end:color-mix(in_oklab,var(--color-secondary)_86%,var(--color-fg)_14%)] [--btn-fill-hover-start:color-mix(in_oklab,var(--color-secondary)_90%,var(--color-fg)_10%)] [--btn-fill-hover-end:color-mix(in_oklab,var(--color-secondary)_78%,var(--color-fg)_22%)] [--btn-fill-active-start:color-mix(in_oklab,var(--color-secondary)_78%,var(--color-fg)_22%)] [--btn-fill-active-end:color-mix(in_oklab,var(--color-secondary)_70%,var(--color-fg)_30%)] [--btn-stroke-start:color-mix(in_oklab,var(--color-secondary)_60%,var(--color-fg)_40%)] [--btn-stroke-end:color-mix(in_oklab,var(--color-secondary)_78%,var(--color-fg)_22%)] [--btn-shadow-ring:color-mix(in_oklab,var(--color-fg)_16%,transparent)] [--btn-fg:var(--color-secondary-fg)] [--btn-icon:var(--color-muted-fg)] [--btn-icon-active:var(--color-secondary-fg)]",
      warning:
        "[--btn-fill-start:color-mix(in_oklab,var(--color-warning)_92%,white_8%)] [--btn-fill-end:color-mix(in_oklab,var(--color-warning)_82%,black_18%)] [--btn-fill-hover-start:color-mix(in_oklab,var(--color-warning)_96%,white_4%)] [--btn-fill-hover-end:color-mix(in_oklab,var(--color-warning)_74%,black_26%)] [--btn-fill-active-start:color-mix(in_oklab,var(--color-warning)_84%,black_16%)] [--btn-fill-active-end:color-mix(in_oklab,var(--color-warning)_68%,black_32%)] [--btn-stroke-start:color-mix(in_oklab,var(--color-warning)_70%,white_30%)] [--btn-stroke-end:color-mix(in_oklab,var(--color-warning)_60%,black_40%)] [--btn-shadow-ring:color-mix(in_oklab,var(--color-warning)_45%,black_55%)] [--btn-fg:var(--color-warning-fg)] [--btn-icon:var(--color-warning-fg)]/70 [--btn-icon-active:var(--color-warning-fg)]",
      danger:
        "[--btn-fill-start:color-mix(in_oklab,var(--color-danger)_92%,white_8%)] [--btn-fill-end:color-mix(in_oklab,var(--color-danger)_78%,black_22%)] [--btn-fill-hover-start:color-mix(in_oklab,var(--color-danger)_96%,white_4%)] [--btn-fill-hover-end:color-mix(in_oklab,var(--color-danger)_70%,black_30%)] [--btn-fill-active-start:color-mix(in_oklab,var(--color-danger)_84%,black_16%)] [--btn-fill-active-end:color-mix(in_oklab,var(--color-danger)_64%,black_36%)] [--btn-stroke-start:color-mix(in_oklab,var(--color-danger)_70%,white_30%)] [--btn-stroke-end:color-mix(in_oklab,var(--color-danger)_58%,black_42%)] [--btn-shadow-ring:color-mix(in_oklab,var(--color-danger)_45%,black_55%)] [--btn-fg:var(--color-danger-fg)] [--btn-icon:var(--color-danger-fg)]/70 [--btn-icon-active:var(--color-danger-fg)]",
      outline:
        "[--btn-fill-start:color-mix(in_oklab,var(--color-bg)_92%,var(--color-fg)_8%)] [--btn-fill-end:color-mix(in_oklab,var(--color-bg)_86%,var(--color-fg)_14%)] [--btn-fill-hover-start:color-mix(in_oklab,var(--color-bg)_88%,var(--color-fg)_12%)] [--btn-fill-hover-end:color-mix(in_oklab,var(--color-bg)_80%,var(--color-fg)_20%)] [--btn-fill-active-start:color-mix(in_oklab,var(--color-bg)_82%,var(--color-fg)_18%)] [--btn-fill-active-end:color-mix(in_oklab,var(--color-bg)_74%,var(--color-fg)_26%)] [--btn-stroke-start:color-mix(in_oklab,var(--color-border)_65%,var(--color-fg)_35%)] [--btn-stroke-end:var(--color-border)] [--btn-shadow-ring:color-mix(in_oklab,var(--color-fg)_10%,transparent)] [--btn-fg:var(--color-fg)] [--btn-icon:var(--color-muted-fg)] [--btn-icon-active:var(--color-fg)]",
      plain:
        "[--btn-fill-start:color-mix(in_oklab,var(--color-bg)_94%,var(--color-fg)_6%)] [--btn-fill-end:color-mix(in_oklab,var(--color-bg)_90%,var(--color-fg)_10%)] [--btn-fill-hover-start:color-mix(in_oklab,var(--color-bg)_90%,var(--color-fg)_10%)] [--btn-fill-hover-end:color-mix(in_oklab,var(--color-bg)_84%,var(--color-fg)_16%)] [--btn-fill-active-start:color-mix(in_oklab,var(--color-bg)_84%,var(--color-fg)_16%)] [--btn-fill-active-end:color-mix(in_oklab,var(--color-bg)_78%,var(--color-fg)_22%)] [--btn-stroke-start:color-mix(in_oklab,var(--color-border)_55%,transparent)] [--btn-stroke-end:color-mix(in_oklab,var(--color-border)_80%,transparent)] [--btn-shadow-ring:transparent] [--btn-fg:var(--color-fg)] [--btn-icon:var(--color-muted-fg)] [--btn-icon-active:var(--color-fg)]",
    },
    size: {
      xs: [
        "min-h-8 gap-x-1.5 px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm sm:min-h-7 sm:px-2 sm:py-[calc(--spacing(1.5)-1px)] sm:text-xs/4",
        "*:data-[slot=icon]:-mx-px *:data-[slot=icon]:size-3.5 sm:*:data-[slot=icon]:size-3",
        "*:data-[slot=loader]:-mx-px *:data-[slot=loader]:size-3.5 sm:*:data-[slot=loader]:size-3",
      ],
      sm: [
        "min-h-9 gap-x-1.5 px-3 py-[calc(--spacing(2)-1px)] sm:min-h-8 sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/5",
        "*:data-[slot=icon]:size-4.5 sm:*:data-[slot=icon]:size-4",
        "*:data-[slot=loader]:size-4.5 sm:*:data-[slot=loader]:size-4",
      ],
      md: [
        "min-h-10 gap-x-2 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:min-h-9 sm:px-3 sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6",
        "*:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:size-4",
        "*:data-[slot=loader]:size-5 sm:*:data-[slot=loader]:size-4",
      ],
      lg: [
        "min-h-10 gap-x-2 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(3)-1px)] sm:min-h-9 sm:px-3 sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/7",
        "*:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:size-4.5",
        "*:data-[slot=loader]:size-5 sm:*:data-[slot=loader]:size-4.5",
      ],
      "sq-xs": [
        "touch-target size-8 sm:size-7",
        "*:data-[slot=icon]:size-3.5 sm:*:data-[slot=icon]:size-3",
        "*:data-[slot=loader]:size-3.5 sm:*:data-[slot=loader]:size-3",
      ],
      "sq-sm": [
        "touch-target size-10 sm:size-8",
        "*:data-[slot=icon]:size-4.5 sm:*:data-[slot=icon]:size-4",
        "*:data-[slot=loader]:size-4.5 sm:*:data-[slot=loader]:size-4",
      ],
      "sq-md": [
        "touch-target size-11 sm:size-9",
        "*:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:size-4.5",
        "*:data-[slot=loader]:size-5 sm:*:data-[slot=loader]:size-4.5",
      ],
      "sq-lg": [
        "touch-target size-12 sm:size-10",
        "*:data-[slot=icon]:size-6 sm:*:data-[slot=icon]:size-5",
        "*:data-[slot=loader]:size-6 sm:*:data-[slot=loader]:size-5",
      ],
    },

    isCircle: {
      true: "rounded-full",
      false: "rounded-(--btn-radius)",
    },
  },
  defaultVariants: {
    intent: "primary",
    size: "md",
    isCircle: false,
  },
});

export interface ButtonProps
  extends ButtonPrimitiveProps, VariantProps<typeof buttonStyles> {
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  intent,
  size,
  isCircle,
  ref,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      ref={ref}
      {...props}
      className={cx(
        buttonStyles({
          intent,
          size,
          isCircle,
        }),
        className,
      )}
    />
  );
}
