import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/Button";
import { useTheme, type Theme } from "./ThemeProvider";

const options: Array<{ value: Theme; label: string; icon: typeof Monitor }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** `className` lets a host (such as the sidebar) restyle the trigger for its surface. */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === theme) ?? options[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className={cn("h-9 w-9 rounded-full p-0", className)}
        aria-label={`Theme: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <SelectedIcon className="size-4" aria-hidden="true" />
      </Button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-10 mb-2 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          role="menu"
          aria-label="Choose theme"
        >
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{label}</span>
              {theme === value && <Check className="ml-auto size-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
