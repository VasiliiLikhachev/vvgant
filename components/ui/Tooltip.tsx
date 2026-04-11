"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const STATUS_COLORS: Record<string, string> = {
  "Не начата": "#B4B2A9",
  "В процессе": "#378ADD",
  "Готово": "#1D9E75",
  "Задержка": "#E24B4A",
};

type Props = {
  taskName: string;
  status: string;
  planStart: string;
  planEnd: string;
  factStart: string | null;
  factEnd: string | null;
  productName: string;
  manufacturerName: string;
  x: number;
  y: number;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Tooltip({
  taskName,
  status,
  planStart,
  planEnd,
  factStart,
  factEnd,
  productName,
  manufacturerName,
  x,
  y,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Сдвиг: чуть выше и правее курсора; если не влезает — зеркально
  const OFFSET_X = 12;
  const OFFSET_Y = -12;

  const style: React.CSSProperties = {
    position: "fixed",
    left: x + OFFSET_X,
    top: y + OFFSET_Y,
    transform: "translateY(-100%)",
    zIndex: 9999,
    pointerEvents: "none",
  };

  const badgeColor = STATUS_COLORS[status] ?? "#B4B2A9";

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm min-w-[220px] max-w-[300px]"
    >
      {/* Название задачи */}
      <div className="font-semibold text-gray-900 mb-2 leading-tight">{taskName}</div>

      {/* Статус */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: badgeColor }}
        />
        <span className="text-gray-700">{status}</span>
      </div>

      <div className="space-y-1 text-gray-600">
        {/* План */}
        <div>
          <span className="text-gray-400 text-xs uppercase tracking-wide">План</span>
          <div>
            {formatDate(planStart)} — {formatDate(planEnd)}
          </div>
        </div>

        {/* Факт */}
        {factStart && factEnd && (
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wide">Факт</span>
            <div>
              {formatDate(factStart)} — {formatDate(factEnd)}
            </div>
          </div>
        )}

        {/* Продукт и производитель */}
        <div className="pt-1 border-t border-gray-100 mt-1">
          <div>
            <span className="text-gray-400">Продукт: </span>
            {productName}
          </div>
          <div>
            <span className="text-gray-400">Производитель: </span>
            {manufacturerName}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
