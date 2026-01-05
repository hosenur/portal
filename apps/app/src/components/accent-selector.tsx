import { useTheme } from "@/providers/theme-provider";
import { type AccentColor } from "@/stores/accent-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const ACCENT_COLORS: { id: AccentColor; name: string; color: string }[] = [
  { id: "blue", name: "Blue", color: "oklch(0.546 0.245 262.881)" },
  { id: "zinc", name: "Zinc", color: "oklch(0.141 0.005 285.823)" },
  { id: "red", name: "Red", color: "oklch(0.577 0.245 27.325)" },
  { id: "orange", name: "Orange", color: "oklch(0.705 0.213 47.604)" },
  { id: "amber", name: "Amber", color: "oklch(0.828 0.189 84.429)" },
  { id: "yellow", name: "Yellow", color: "oklch(0.905 0.182 98.111)" },
  { id: "lime", name: "Lime", color: "oklch(0.897 0.196 126.665)" },
  { id: "green", name: "Green", color: "oklch(0.627 0.194 149.214)" },
  { id: "emerald", name: "Emerald", color: "oklch(0.596 0.145 163.225)" },
];

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border border-border"
      style={{ backgroundColor: color }}
    />
  );
}

export function AccentSelector() {
  const { accentColor, setAccentColor } = useTheme();

  const currentAccent = ACCENT_COLORS.find((c) => c.id === accentColor);

  return (
    <Select
      value={accentColor}
      onChange={(color) => color && setAccentColor(color as AccentColor)}
    >
      <SelectTrigger className="w-36" aria-label="Select accent color">
        <span className="flex items-center gap-2">
          {currentAccent && <ColorSwatch color={currentAccent.color} />}
          <span className="truncate">{currentAccent?.name}</span>
        </span>
      </SelectTrigger>
      <SelectContent items={ACCENT_COLORS}>
        {(item) => (
          <SelectItem id={item.id} textValue={item.name}>
            <span className="flex items-center gap-2">
              <ColorSwatch color={item.color} />
              {item.name}
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

export function AccentSelectorSimple() {
  const { accentColor, setAccentColor } = useTheme();

  const accent = ACCENT_COLORS.find((c) => c.id === accentColor);

  return (
    <Button
      intent="plain"
      size="sq-sm"
      onPress={() => {
        const currentIndex = ACCENT_COLORS.findIndex(
          (c) => c.id === accentColor,
        );
        const nextIndex = (currentIndex + 1) % ACCENT_COLORS.length;
        setAccentColor(ACCENT_COLORS[nextIndex]!.id);
      }}
      aria-label={`Current accent: ${accent?.name}. Click to cycle through accent colors.`}
    >
      {accent && <ColorSwatch color={accent.color} />}
    </Button>
  );
}
