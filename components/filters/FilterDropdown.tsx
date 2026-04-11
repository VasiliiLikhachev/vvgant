"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onApply: (selected: string[]) => void;
};

type DropdownPos = { top: number; left: number };

function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block flex-shrink-0"
    >
      <path
        d="M1 2h10L7 6.5V10.5L5 9.5V6.5L1 2Z"
        fill={active ? "#378ADD" : "none"}
        stroke={active ? "#378ADD" : "currentColor"}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FilterDropdown({ label, options, selected, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [buffer, setBuffer] = useState<string[]>(selected);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: Math.max(rect.bottom + 4, 100), left: rect.left });
    }
    setBuffer(selected);
    setOpen(true);
  }

  function handleToggle(option: string) {
    setBuffer((prev) =>
      prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]
    );
  }

  function handleApply() {
    onApply(buffer);
    setOpen(false);
  }

  function handleReset() {
    setBuffer([]);
    onApply([]);
    setOpen(false);
  }

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isActive = selected.length > 0;

  return (
    <div className="inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        ref={triggerRef}
        onClick={open ? () => setOpen(false) : handleOpen}
        className={`p-0.5 rounded transition-colors ${
          isActive
            ? "text-blue-500"
            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        }`}
        title="Фильтр"
      >
        <FunnelIcon active={isActive} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 100, maxHeight: "300px", overflowY: "auto" }}
          className="min-w-[180px] rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <ul className="max-h-52 overflow-y-auto py-1">
            {options.map((option) => (
              <li key={option}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={buffer.includes(option)}
                    onChange={() => handleToggle(option)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-blue-500"
                  />
                  {option}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <button
              onClick={handleApply}
              className="flex-1 rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Применить
            </button>
            <button
              onClick={handleReset}
              className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
