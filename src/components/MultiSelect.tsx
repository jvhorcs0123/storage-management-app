"use client";

import { useEffect, useRef, useState } from "react";

type MultiSelectProps = {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
};

export default function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = "Select",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };

  const summary =
    values.length === 0 ? placeholder : `${values.length} selected`;

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
      >
        <span>{summary}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {options.length === 0 && (
            <div className="px-2 py-2 text-xs text-slate-500">
              No options
            </div>
          )}
          {options.map((option) => {
            const checked = values.includes(option);
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(option)}
                  className="h-4 w-4"
                />
                <span className="flex-1">{option}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
