"use client";

import { useState } from "react";
import Tooltip from "@/components/ui/Tooltip";

const STATUS_COLORS: Record<string, string> = {
  "Не начата": "#B4B2A9",
  "В процессе": "#378ADD",
  "Готово": "#1D9E75",
  "Задержка": "#E24B4A",
};

const PLAN_HEIGHT = 20;
const FACT_HEIGHT = 12;
const CONTAINER_HEIGHT = 32;

function toPercent(date: string, rangeStart: string, rangeEnd: string): number {
  const d = new Date(date).getTime();
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  return ((d - start) / (end - start)) * 100;
}

type Props = {
  planStart: string;
  planEnd: string;
  factStart: string | null;
  factEnd: string | null;
  status: string;
  color: string;
  rangeStart: string;
  rangeEnd: string;
  taskName: string;
  productName: string;
  manufacturerName: string;
};

export default function GanttBar({
  planStart,
  planEnd,
  factStart,
  factEnd,
  status,
  color,
  rangeStart,
  rangeEnd,
  taskName,
  productName,
  manufacturerName,
}: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const planLeft = toPercent(planStart, rangeStart, rangeEnd);
  const planWidth = toPercent(planEnd, rangeStart, rangeEnd) - planLeft;

  const showFact = factStart !== null && factEnd !== null;
  const factLeft = showFact ? toPercent(factStart!, rangeStart, rangeEnd) : 0;
  const factWidth = showFact
    ? toPercent(factEnd!, rangeStart, rangeEnd) - factLeft
    : 0;

  const factColor = STATUS_COLORS[status] ?? "#B4B2A9";

  const planTop = (CONTAINER_HEIGHT - PLAN_HEIGHT) / 2;
  const factTop = (CONTAINER_HEIGHT - FACT_HEIGHT) / 2;

  return (
    <div
      className="relative w-full"
      style={{ height: CONTAINER_HEIGHT }}
      onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Плановая полоска — диагональная штриховка */}
      <div
        className="absolute rounded-sm"
        style={{
          left: `${planLeft}%`,
          width: `${planWidth}%`,
          top: planTop,
          height: PLAN_HEIGHT,
          backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0px, ${color} 2px, transparent 2px, transparent 7px)`,
          zIndex: 1,
        }}
      />

      {/* Фактическая полоска */}
      {showFact && (
        <div
          className="absolute rounded-sm"
          style={{
            left: `${factLeft}%`,
            width: `${factWidth}%`,
            top: factTop,
            height: FACT_HEIGHT,
            backgroundColor: factColor,
            opacity: 0.68,
            zIndex: 2,
          }}
        />
      )}

      {/* Тултип */}
      {tooltip && (
        <Tooltip
          taskName={taskName}
          status={status}
          planStart={planStart}
          planEnd={planEnd}
          factStart={factStart}
          factEnd={factEnd}
          productName={productName}
          manufacturerName={manufacturerName}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}
