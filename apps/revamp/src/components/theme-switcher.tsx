import {
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

export function ThemeSwitcher() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Menu>
      <MenuTrigger aria-label="Toggle theme">
        <Button intent="plain" size="sq-sm">
          {resolvedTheme === "dark" ? (
            <MoonIcon className="size-4" />
          ) : (
            <SunIcon className="size-4" />
          )}
        </Button>
      </MenuTrigger>
      <MenuContent placement="top">
        <MenuItem onAction={() => setTheme("light")}>
          <SunIcon className="size-4" />
          Light
        </MenuItem>
        <MenuItem onAction={() => setTheme("dark")}>
          <MoonIcon className="size-4" />
          Dark
        </MenuItem>
        <MenuItem onAction={() => setTheme("system")}>
          <ComputerDesktopIcon className="size-4" />
          System
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function ThemeSwitcherSimple() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      intent="plain"
      size="sq-sm"
      onPress={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <MoonIcon className="size-4" />
      ) : (
        <SunIcon className="size-4" />
      )}
    </Button>
  );
}
