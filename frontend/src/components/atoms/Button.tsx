import React from "react";
import MuiButton, { ButtonProps as MuiButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export type PFButtonVariant = "primary" | "secondary" | "ghost";
export type PFButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends Omit<MuiButtonProps, "variant"> {
  variant?: PFButtonVariant;
  size?: PFButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * PF Button
 * - variant: primary | secondary | ghost
 * - loading: shows spinner and disables interactions
 */
const variantToMui = (v: PFButtonVariant | undefined) => {
  switch (v) {
    case "secondary":
      return { color: "inherit" as const, variant: "outlined" as const };
    case "ghost":
      // ghost: minimal, transparent background, subtle border on hover
      return { color: "inherit" as const, variant: "text" as const };
    case "primary":
    default:
      return { color: "primary" as const, variant: "contained" as const };
  }
};

const sizeMap: Record<PFButtonSize, MuiButtonProps["size"]> = {
  small: "small",
  medium: "medium",
  large: "large",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function PFButton(
  {
    children,
    variant = "primary",
    size = "medium",
    loading = false,
    startIcon,
    endIcon,
    disabled,
    fullWidth = false,
    sx,
    ...rest
  },
  ref
) {
  const { color, variant: muiVariant } = variantToMui(variant);
  const muiSize = sizeMap[size];

  const showSpinner = loading;
  const computedDisabled = disabled || loading;

  return (
    <MuiButton
      ref={ref}
      color={color}
      variant={muiVariant}
      size={muiSize}
      startIcon={showSpinner ? undefined : startIcon}
      endIcon={showSpinner ? undefined : endIcon}
      disabled={computedDisabled}
      fullWidth={fullWidth}
      sx={{
        textTransform: "none",
        borderRadius: 8,
        minWidth: 64,
        gap: 1,
        // Ghost tweaks
        ...(variant === "ghost" && {
          backgroundColor: "transparent",
          "&:hover": {
            backgroundColor: "action.hover",
          },
        }),
        // Secondary subtle style
        ...(variant === "secondary" && {
          borderColor: "divider",
        }),
        ...sx,
      }}
      {...rest}
    >
      {showSpinner ? (
        <CircularProgress size={18} thickness={5} />
      ) : (
        children
      )}
    </MuiButton>
  );
});

export default Button;
