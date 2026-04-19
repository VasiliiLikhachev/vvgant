"use client";

import React, { useEffect, useState } from "react";
import GanttBar from "./GanttBar";
import Tooltip from "@/components/ui/Tooltip";
import { supabase } from "@/lib/supabase";
import FilterDropdown from "@/components/filters/FilterDropdown";

type Task = {
  id: string;
  product_id: number | null;
  status: string | null;
  plan_start: string | null;
  plan_end: string | null;
  fact_start: string | null;
  fact_end: string | null;
  template_tasks: { name: string; order: number | null } | null;
  products: { name: string; image_url: string | null } | null;
  manufacturers: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  "Не начата": "#B4B2A9",
  "В процессе": "#378ADD",
  "Готово": "#1D9E75",
  "Задержка": "#E24B4A",
};

const STATUS_OPTIONS = ["Не начата", "В процессе", "Готово", "Задержка"];

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
        active
          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
          : "bg-white text-zinc-500 border-zinc-300 hover:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function toPercent(date: string, rangeStart: string, rangeEnd: string): number {
  const d = new Date(date).getTime();
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  return ((d - start) / (end - start)) * 100;
}

function getMondays(rangeStart: string, rangeEnd: string): string[] {
  const mondays: string[] = [];
  const cursor = new Date(rangeStart);
  const day = cursor.getDay();
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  cursor.setDate(cursor.getDate() + daysToMonday);
  const end = new Date(rangeEnd);
  while (cursor <= end) {
    mondays.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return mondays;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
}

type Scale = "days" | "weeks" | "months";

const SCALE_WINDOW: Record<Scale, number> = { days: 30, weeks: 84, months: 180 };
const SCALE_STEP: Record<Scale, number> = { days: 7, weeks: 28, months: 30 };

function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function initRange(scale: Scale, anchor?: string): { start: string; end: string } {
  const half = Math.floor(SCALE_WINDOW[scale] / 2);
  const base = anchor ?? new Date().toISOString().slice(0, 10);
  const start = isoAddDays(base, -half);
  const end = isoAddDays(start, SCALE_WINDOW[scale]);
  return { start, end };
}

function getScaleLabels(rangeStart: string, rangeEnd: string, scale: Scale): string[] {
  if (scale === "weeks") return getMondays(rangeStart, rangeEnd);
  const labels: string[] = [];
  const cursor = new Date(rangeStart);
  if (scale === "days") {
    while (cursor.toISOString().slice(0, 10) <= rangeEnd) {
      labels.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    // months: 1-е числа каждого месяца
    // Если rangeStart не 1-е — стартуем с 1-го числа следующего месяца
    if (cursor.getUTCDate() !== 1) {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    cursor.setUTCDate(1);
    while (cursor.toISOString().slice(0, 10) <= rangeEnd) {
      labels.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return labels;
}

function getGridLines(rangeStart: string, rangeEnd: string, scale: Scale): string[] {
  return getScaleLabels(rangeStart, rangeEnd, scale);
}

function formatLabel(iso: string, scale: Scale): string {
  if (scale === "months") return formatMonthYear(iso);
  return formatDateShort(iso);
}

function groupTasks(tasks: Task[]): Map<string, Map<string, Task[]>> {
  const result = new Map<string, Map<string, Task[]>>();
  for (const task of tasks) {
    const product = task.products?.name ?? "Без продукта";
    const manufacturer = task.manufacturers?.name ?? "Без производителя";
    if (!result.has(product)) result.set(product, new Map());
    const mfMap = result.get(product)!;
    if (!mfMap.has(manufacturer)) mfMap.set(manufacturer, []);
    mfMap.get(manufacturer)!.push(task);
  }
  return result;
}

function TaskNameCell({
  task,
  indent,
}: {
  task: Task;
  indent: number;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const name = task.template_tasks?.name ?? "—";
  return (
    <td
      className="py-3 font-medium text-zinc-900 dark:text-zinc-100"
      style={{ paddingLeft: indent, paddingRight: 16, width: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTip(null)}
    >
      {name}
      {tip && task.plan_start && task.plan_end && (
        <Tooltip
          taskName={name}
          status={task.status ?? "Не начата"}
          planStart={task.plan_start}
          planEnd={task.plan_end}
          factStart={task.fact_start}
          factEnd={task.fact_end}
          productName={task.products?.name ?? ""}
          manufacturerName={task.manufacturers?.name ?? ""}
          x={tip.x}
          y={tip.y}
        />
      )}
    </td>
  );
}

const SETTINGS_KEY = "gantt_settings";

function loadSetting<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    return key in parsed ? parsed[key] : defaultValue;
  } catch {
    return defaultValue;
  }
}

export default function GanttTableClient({
  tasks: initialTasks,
  initialProductFilter,
}: {
  tasks: Task[];
  initialProductFilter?: number | null;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isMounted, setIsMounted] = useState(false);
  const [showPlanStart, setShowPlanStart] = useState(true);
  const [showPlanEnd, setShowPlanEnd] = useState(true);
  const [showFactStart, setShowFactStart] = useState(true);
  const [showFactEnd, setShowFactEnd] = useState(true);
  const [showProduct, setShowProduct] = useState(false);
  const [showManufacturer, setShowManufacturer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>(() => {
    if (!initialProductFilter) return [];
    const match = initialTasks.find((t) => t.product_id === initialProductFilter);
    return match?.products?.name ? [match.products.name] : [];
  });
  const [taskNameFilter, setTaskNameFilter] = useState<string[]>([]);
  const [manufacturerFilter, setManufacturerFilter] = useState<string[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [showWeekends, setShowWeekends] = useState(false);
  const [scale, setScale] = useState<Scale>("weeks");
  const [rangeStart, setRangeStart] = useState(() => initRange("weeks").start);
  const [rangeEnd, setRangeEnd] = useState(() => initRange("weeks").end);
  const [groupMode, setGroupMode] = useState<"product" | "manufacturer">("product");
  const [imgTooltip, setImgTooltip] = useState<{ url: string; x: number; y: number } | null>(null);

  // Читаем настройки из localStorage только после монтирования (избегаем hydration mismatch)
  useEffect(() => {
    const v = loadSetting<Record<string, boolean>>("visibleColumns", {});
    if ("planStart" in v) setShowPlanStart(v.planStart);
    if ("planEnd" in v) setShowPlanEnd(v.planEnd);
    if ("factStart" in v) setShowFactStart(v.factStart);
    if ("factEnd" in v) setShowFactEnd(v.factEnd);
    if ("product" in v) setShowProduct(v.product);
    if ("manufacturer" in v) setShowManufacturer(v.manufacturer);

    const savedScale = loadSetting<Scale>("scale", "weeks");
    const savedGrid = loadSetting<boolean>("showGrid", false);
    const savedWeekends = loadSetting<boolean>("showWeekends", false);
    const savedGroupBy = loadSetting<"product" | "manufacturer">("groupBy", "product");

    setScale(savedScale);
    setRangeStart(initRange(savedScale).start);
    setRangeEnd(initRange(savedScale).end);
    setShowGrid(savedGrid);
    setShowWeekends(savedWeekends);
    setGroupMode(savedGroupBy);

    setStatusFilter(loadSetting<string[]>("selectedStatuses", []));
    setProductFilter(loadSetting<string[]>("selectedProducts", []));
    setManufacturerFilter(loadSetting<string[]>("selectedManufacturers", []));
    setTaskNameFilter(loadSetting<string[]>("selectedTaskNames", []));

    setIsMounted(true);
  }, []);

  // Сохраняем настройки при каждом изменении (только после монтирования)
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          visibleColumns: {
            planStart: showPlanStart,
            planEnd: showPlanEnd,
            factStart: showFactStart,
            factEnd: showFactEnd,
            product: showProduct,
            manufacturer: showManufacturer,
          },
          scale,
          showGrid,
          showWeekends,
          groupBy: groupMode,
          selectedStatuses: statusFilter,
          selectedProducts: productFilter,
          selectedManufacturers: manufacturerFilter,
          selectedTaskNames: taskNameFilter,
        })
      );
    } catch {
      // localStorage недоступен — игнорируем
    }
  }, [isMounted, showPlanStart, showPlanEnd, showFactStart, showFactEnd, showProduct, showManufacturer, scale, showGrid, showWeekends, groupMode, statusFilter, productFilter, manufacturerFilter, taskNameFilter]);

  async function updateStatus(id: string, value: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: value })
      .eq("id", id);
    if (error) {
      console.error("Ошибка обновления статуса:", error.message);
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: value } : t))
    );
  }

  async function updateDate(id: string, field: "plan_start" | "plan_end" | "fact_start" | "fact_end", value: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ [field]: value || null })
      .eq("id", id);
    if (error) {
      console.error("Ошибка обновления даты:", error.message);
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  function applyScale(newScale: Scale) {
    const { start, end } = initRange(newScale, rangeStart);
    setScale(newScale);
    setRangeStart(start);
    setRangeEnd(end);
  }

  function shiftRange(dir: 1 | -1) {
    const step = SCALE_STEP[scale] * dir;
    setRangeStart(isoAddDays(rangeStart, step));
    setRangeEnd(isoAddDays(rangeEnd, step));
  }

  function goToToday() {
    const { start, end } = initRange(scale);
    setRangeStart(start);
    setRangeEnd(end);
  }

  const taskNames = Array.from(
    new Set(tasks.map((t) => t.template_tasks?.name).filter(Boolean) as string[])
  ).sort();

  // Базовый фильтр по статусу и задаче (без продукта и производителя)
  function matchesBaseFilters(t: Task) {
    if (statusFilter.length > 0 && (t.status === null || !statusFilter.includes(t.status))) return false;
    if (taskNameFilter.length > 0 && (t.template_tasks?.name == null || !taskNameFilter.includes(t.template_tasks.name))) return false;
    return true;
  }

  const tasksFilteredWithoutProduct = tasks.filter((t) => {
    if (!matchesBaseFilters(t)) return false;
    if (manufacturerFilter.length > 0 && (t.manufacturers?.name == null || !manufacturerFilter.includes(t.manufacturers.name))) return false;
    return true;
  });

  const tasksFilteredWithoutManufacturer = tasks.filter((t) => {
    if (!matchesBaseFilters(t)) return false;
    if (productFilter.length > 0 && (t.products?.name == null || !productFilter.includes(t.products.name))) return false;
    return true;
  });

  const productNames = Array.from(
    new Set(tasksFilteredWithoutProduct.map((t) => t.products?.name).filter(Boolean) as string[])
  ).sort();

  const manufacturerNames = Array.from(
    new Set(tasksFilteredWithoutManufacturer.map((t) => t.manufacturers?.name).filter(Boolean) as string[])
  ).sort();

  const filteredTasks = tasks.filter((t) => {
    if (!matchesBaseFilters(t)) return false;
    if (productFilter.length > 0 && (t.products?.name == null || !productFilter.includes(t.products.name))) return false;
    if (manufacturerFilter.length > 0 && (t.manufacturers?.name == null || !manufacturerFilter.includes(t.manufacturers.name))) return false;
    return true;
  });

  const scaleLabels = getScaleLabels(rangeStart, rangeEnd, scale);
  const gridLines = showGrid ? getGridLines(rangeStart, rangeEnd, scale) : [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayInRange = todayIso >= rangeStart && todayIso <= rangeEnd;
  const todayLeft = todayInRange ? toPercent(todayIso, rangeStart, rangeEnd) : null;

  // Пары [leftPercent, widthPercent] для каждых выходных (сб+вс) в диапазоне
  const weekendBands = (() => {
    if (!showWeekends) return [];
    const bands: { left: number; width: number }[] = [];
    const cursor = new Date(rangeStart);
    const end = new Date(rangeEnd);
    while (cursor <= end) {
      const day = cursor.getDay();
      if (day === 6) { // суббота — начало полосы (сб+вс = 2 дня)
        const satIso = cursor.toISOString().slice(0, 10);
        const sunDate = new Date(cursor);
        sunDate.setDate(sunDate.getDate() + 1);
        const sunIso = sunDate.toISOString().slice(0, 10);
        const left = toPercent(satIso, rangeStart, rangeEnd);
        const right = toPercent(sunIso, rangeStart, rangeEnd) + (100 / ((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / 86400000 || 1));
        bands.push({ left, width: Math.min(right, 100) - left });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return bands;
  })();

  const grouped = groupTasks(filteredTasks);

  // Группировка по производителю → продукту, задачи отсортированы по order
  const groupedByMf = filteredTasks.reduce<Map<string, Map<string, Task[]>>>((acc, task) => {
    const mf = task.manufacturers?.name ?? "Без производителя";
    const product = task.products?.name ?? "Без продукта";
    if (!acc.has(mf)) acc.set(mf, new Map());
    const productMap = acc.get(mf)!;
    if (!productMap.has(product)) productMap.set(product, []);
    productMap.get(product)!.push(task);
    return acc;
  }, new Map());
  // Сортируем задачи внутри каждой группы по order
  for (const productMap of groupedByMf.values()) {
    for (const [key, taskList] of productMap.entries()) {
      productMap.set(key, [...taskList].sort(
        (a, b) => (a.template_tasks?.order ?? 0) - (b.template_tasks?.order ?? 0)
      ));
    }
  }

  const totalCols = 3
    + (showPlanStart ? 1 : 0)
    + (showPlanEnd ? 1 : 0)
    + (showFactStart ? 1 : 0)
    + (showFactEnd ? 1 : 0)
    + (showProduct ? 1 : 0)
    + (showManufacturer ? 1 : 0);

  function renderTaskCells(task: Task, nameIndent: number) {
    return (
      <>
        <TaskNameCell task={task} indent={nameIndent} />
        <td className="px-2 py-2" style={{ width: 120 }}>
          <select
            value={task.status ?? "Не начата"}
            onChange={(e) => updateStatus(task.id, e.target.value)}
            style={{ color: STATUS_COLORS[task.status ?? "Не начата"] ?? "#B4B2A9" }}
            className="w-full text-xs font-medium bg-transparent border border-transparent rounded px-2 py-1 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none cursor-pointer transition-colors"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} style={{ color: STATUS_COLORS[s] }}>
                {s}
              </option>
            ))}
          </select>
        </td>
        {showProduct && (
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 overflow-hidden text-ellipsis" style={{ width: 150 }}>
            {task.products?.name ?? "—"}
          </td>
        )}
        {showManufacturer && (
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 overflow-hidden text-ellipsis" style={{ width: 150 }}>
            {task.manufacturers?.name ?? "—"}
          </td>
        )}
        {showPlanStart && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.plan_start ?? ""}
              onChange={(e) => updateDate(task.id, "plan_start", e.target.value)}
              className="text-xs text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        {showPlanEnd && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.plan_end ?? ""}
              onChange={(e) => updateDate(task.id, "plan_end", e.target.value)}
              className="text-xs text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        {showFactStart && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.fact_start ?? ""}
              onChange={(e) => updateDate(task.id, "fact_start", e.target.value)}
              className="text-xs text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        {showFactEnd && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.fact_end ?? ""}
              onChange={(e) => updateDate(task.id, "fact_end", e.target.value)}
              className="text-xs text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        <td className="px-4 py-3" style={{ minWidth: 400 }}>
          <div className="relative" style={{ overflow: "hidden" }}>
            {task.plan_start && task.plan_end ? (
              <GanttBar
                planStart={task.plan_start}
                planEnd={task.plan_end}
                factStart={task.fact_start}
                factEnd={task.fact_end}
                status={task.status ?? "Не начата"}
                color="#378ADD"
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                taskName={task.template_tasks?.name ?? ""}
                productName={task.products?.name ?? ""}
                manufacturerName={task.manufacturers?.name ?? ""}
              />
            ) : (
              <div style={{ height: 32, background: "#f5f5f5" }} />
            )}
            {/* Выходные */}
            {weekendBands.map((band, i) => (
              <div
                key={i}
                className="absolute inset-y-0 pointer-events-none"
                style={{ left: `${band.left}%`, width: `${band.width}%`, background: "#FFF9C4", zIndex: 0 }}
              />
            ))}
            {/* Сетка */}
            {gridLines.map((iso) => (
              <div
                key={iso}
                className="absolute inset-y-0 w-px pointer-events-none"
                style={{ left: `${toPercent(iso, rangeStart, rangeEnd)}%`, background: "rgba(0,0,0,0.1)", zIndex: 0 }}
              />
            ))}
            {todayLeft !== null && (
              <div
                className="absolute inset-y-0 w-px bg-red-500 pointer-events-none"
                style={{ left: `${todayLeft}%`, zIndex: 3 }}
              />
            )}
          </div>
        </td>
      </>
    );
  }

  const thSticky0: React.CSSProperties = {
    position: "sticky", top: 0, zIndex: 4, background: "white",
    height: 48, boxShadow: "0 1px 0 #e5e7eb",
  };
  const thSticky48: React.CSSProperties = {
    position: "sticky", top: 48, zIndex: 4, background: "white",
  };

  return (
    <>
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
          <button
            onClick={() => setGroupMode("product")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              groupMode === "product"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            По продукту
          </button>
          <button
            onClick={() => setGroupMode("manufacturer")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              groupMode === "manufacturer"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            По производителю
          </button>
        </div>
        {/* Навигация по таймлайну */}
        <div className="flex items-center gap-2">
          {/* Масштаб */}
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
            {(["days", "weeks", "months"] as Scale[]).map((s) => (
              <button
                key={s}
                onClick={() => applyScale(s)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  scale === s
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                {s === "days" ? "Дни" : s === "weeks" ? "Недели" : "Месяцы"}
              </button>
            ))}
          </div>
          {/* Пагинация */}
          <button
            onClick={() => shiftRange(-1)}
            className="px-2 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 text-sm transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="px-2.5 py-1 rounded border border-zinc-200 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 transition-colors"
          >
            Сегодня
          </button>
          <button
            onClick={() => shiftRange(1)}
            className="px-2 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 text-sm transition-colors"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Колонки:</span>
          <ToggleButton active={showProduct} onClick={() => setShowProduct((v) => !v)}>
            Продукт
          </ToggleButton>
          <ToggleButton active={showManufacturer} onClick={() => setShowManufacturer((v) => !v)}>
            Производитель
          </ToggleButton>
          <ToggleButton active={showPlanStart} onClick={() => setShowPlanStart((v) => !v)}>
            Дата начала (план)
          </ToggleButton>
          <ToggleButton active={showPlanEnd} onClick={() => setShowPlanEnd((v) => !v)}>
            Дата конца (план)
          </ToggleButton>
          <ToggleButton active={showFactStart} onClick={() => setShowFactStart((v) => !v)}>
            Факт начало
          </ToggleButton>
          <ToggleButton active={showFactEnd} onClick={() => setShowFactEnd((v) => !v)}>
            Факт конец
          </ToggleButton>
          <span className="text-xs text-zinc-300 dark:text-zinc-600 mx-1">|</span>
          <ToggleButton active={showGrid} onClick={() => setShowGrid((v) => !v)}>
            Сетка
          </ToggleButton>
          <ToggleButton active={showWeekends} onClick={() => setShowWeekends((v) => !v)}>
            Выходные
          </ToggleButton>
        </div>
      </div>

      <div
        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
      >
        <table className="w-full text-xs text-left" style={{ tableLayout: "fixed", width: "100%" }}>
          <thead className="text-zinc-600 dark:text-zinc-400 uppercase text-xs tracking-wide">
            {/* Строка 1: заголовки колонок */}
            <tr>
              <th className="px-4 font-medium" style={{ ...thSticky0, width: 180 }}>
                <FilterDropdown
                  label="Задача"
                  options={taskNames}
                  selected={taskNameFilter}
                  onApply={setTaskNameFilter}
                />
              </th>
              <th className="px-4 font-medium" style={{ ...thSticky0, width: 120 }}>
                <FilterDropdown
                  label="Статус"
                  options={["Не начата", "В процессе", "Готово", "Задержка"]}
                  selected={statusFilter}
                  onApply={setStatusFilter}
                />
              </th>
              {showProduct && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 150 }}>
                  <FilterDropdown
                    label="Продукт"
                    options={productNames}
                    selected={productFilter}
                    onApply={setProductFilter}
                  />
                </th>
              )}
              {showManufacturer && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 150 }}>
                  <FilterDropdown
                    label="Производитель"
                    options={manufacturerNames}
                    selected={manufacturerFilter}
                    onApply={setManufacturerFilter}
                  />
                </th>
              )}
              {showPlanStart && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 140 }}>Дата начала (план)</th>
              )}
              {showPlanEnd && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 140 }}>Дата конца (план)</th>
              )}
              {showFactStart && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 140 }}>Факт начало</th>
              )}
              {showFactEnd && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 140 }}>Факт конец</th>
              )}
              <th className="px-4 font-medium" style={{ ...thSticky0, minWidth: 400 }}>Гант</th>
            </tr>
            {/* Строка 2: шкала дат */}
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th colSpan={totalCols - 1} style={thSticky48} />
              <th className="px-4 py-1 w-full font-normal" style={thSticky48}>
                <div className="relative w-full" style={{ height: 24 }}>
                  {scaleLabels.map((iso) => (
                    <span
                      key={iso}
                      className="absolute text-[10px] text-zinc-400 dark:text-zinc-500 -translate-x-1/2"
                      style={{ left: `${toPercent(iso, rangeStart, rangeEnd)}%`, top: 4 }}
                    >
                      {formatLabel(iso, scale)}
                    </span>
                  ))}
                  {todayLeft !== null && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: `${todayLeft}%` }} />
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500">
                  Задачи не найдены
                </td>
              </tr>
            ) : groupMode === "manufacturer" ? (
              Array.from(groupedByMf.entries()).map(([mfName, productMap]) => (
                <React.Fragment key={mfName}>
                  {/* Заголовок производителя */}
                  <tr>
                    <td colSpan={totalCols} className="px-4 py-2 font-bold text-zinc-800 text-sm" style={{ background: "#f0f0f0" }}>
                      {mfName}
                    </td>
                  </tr>
                  {Array.from(productMap.entries()).map(([productName, productTasks]) => {
                    const imageUrlMf = productTasks[0]?.products?.image_url ?? null;
                    return (
                    <React.Fragment key={`${mfName}-${productName}`}>
                      {/* Подзаголовок продукта */}
                      <tr>
                        <td colSpan={totalCols} className="py-1.5 text-xs text-zinc-500 italic" style={{ background: "#f8f8f8", paddingLeft: 32 }}>
                          {productName}
                          {imageUrlMf && (
                            <span
                              className="ml-2 cursor-pointer select-none not-italic"
                              onClick={(e) =>
                                setImgTooltip(
                                  imgTooltip?.url === imageUrlMf
                                    ? null
                                    : { url: imageUrlMf, x: e.clientX, y: e.clientY }
                                )
                              }
                            >
                              📷
                            </span>
                          )}
                        </td>
                      </tr>
                      {productTasks.map((task) => (
                        <tr key={task.id} className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                          {renderTaskCells(task, 48)}
                        </tr>
                      ))}
                    </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))
            ) : (
              Array.from(grouped.entries()).map(([productName, mfMap]) => {
                const imageUrl = Array.from(mfMap.values()).flat()[0]?.products?.image_url ?? null;
                return (
                <React.Fragment key={productName}>
                  {/* Заголовок продукта */}
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="px-4 py-2 font-bold text-zinc-800 text-sm"
                      style={{ background: "#f0f0f0" }}
                    >
                      {productName}
                      {imageUrl && (
                        <span
                          className="ml-2 cursor-pointer select-none"
                          onClick={(e) =>
                            setImgTooltip(
                              imgTooltip?.url === imageUrl
                                ? null
                                : { url: imageUrl, x: e.clientX, y: e.clientY }
                            )
                          }
                        >
                          📷
                        </span>
                      )}
                    </td>
                  </tr>

                  {Array.from(mfMap.entries()).map(([mfName, mfTasks]) => (
                    <React.Fragment key={`${productName}-${mfName}`}>
                      {/* Заголовок производителя */}
                      <tr>
                        <td
                          colSpan={totalCols}
                          className="py-1.5 text-xs text-zinc-500 italic"
                          style={{ background: "#f8f8f8", paddingLeft: 32 }}
                        >
                          {mfName}
                        </td>
                      </tr>

                      {/* Строки задач */}
                      {mfTasks.map((task) => (
                        <tr key={task.id} className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                          {renderTaskCells(task, 48)}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
                );
              })
            )}
          </tbody>

        </table>
      </div>
    </div>

    {/* Тултип с картинкой продукта */}
    {imgTooltip && (
      <>
        {/* Overlay для закрытия по клику вне */}
        <div
          className="fixed inset-0"
          style={{ zIndex: 9998 }}
          onClick={() => setImgTooltip(null)}
        />
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl p-2"
          style={{
            left: imgTooltip.x + 12,
            top: imgTooltip.y - 12,
            transform: "translateY(-100%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <img src={imgTooltip.url} alt="Фото продукта" width={200} className="rounded" />
        </div>
      </>
    )}
    </>
  );
}
