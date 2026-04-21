import type { ReactNode } from "react";
import { Tab, TabsList } from "@/ui/tabs";

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps {
  value: string;
  options: SegmentedControlOption[];
  onChange: (value: string) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function SegmentedControl({
  value,
  options,
  onChange,
  size = "xs",
  className,
}: SegmentedControlProps) {
  return (
    <TabsList
      variant="segmented"
      className={className ?? "inline-flex w-fit max-w-full self-start"}
    >
      {options.map((option) => (
        <Tab
          key={option.value}
          isActive={value === option.value}
          variant="segmented"
          size={size}
          role="button"
          tabIndex={0}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onChange(option.value);
            }
          }}
        >
          {option.icon}
          <span>{option.label}</span>
        </Tab>
      ))}
    </TabsList>
  );
}
