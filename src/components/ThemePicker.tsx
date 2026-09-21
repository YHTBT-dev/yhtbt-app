// Only the themes with real fonts loaded (see layout.tsx) are selectable —
// midnight-press/conservatory/terra-rosa from the first theming pass were
// token-only placeholders, not meant to be picked yet.
const THEME_OPTIONS = [
  { value: "editorial-classic", label: "Editorial Classic" },
  { value: "coastal-light", label: "Coastal Light" },
  { value: "midnight-edition", label: "Midnight Edition" },
] as const;

type ThemePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {THEME_OPTIONS.map((theme) => {
        const isSelected = value === theme.value;
        return (
          <button
            key={theme.value}
            type="button"
            data-theme={theme.value}
            onClick={() => {
              console.log("[ThemePicker] selected theme:", theme.value);
              onChange(theme.value);
            }}
            aria-pressed={isSelected}
            style={{
              // A selected swatch gets a background tint (its own accent
              // blended into its own bg) on top of the ring — a highlight
              // surface, not just an outline, matching how "active" is
              // shown elsewhere (e.g. the active-tab treatment).
              background: isSelected
                ? "color-mix(in srgb, var(--color-bg) 90%, var(--color-accent) 10%)"
                : "var(--color-bg)",
              boxShadow: isSelected ? "0 0 0 2px var(--color-accent)" : undefined,
            }}
            className="flex flex-col gap-4 border border-foreground/10 p-4 text-left transition-shadow"
          >
            <span
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
              className="text-xl"
            >
              {theme.label}
            </span>
            <span
              style={{ background: "var(--color-accent)" }}
              className="h-2 w-10"
            />
          </button>
        );
      })}
    </div>
  );
}
