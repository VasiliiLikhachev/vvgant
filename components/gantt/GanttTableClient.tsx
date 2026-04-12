"use client";

import React, { useState } from "react";
import GanttBar from "./GanttBar";
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

export default function GanttTableClient({
  tasks: initialTasks,
  initialProductFilter,
}: {
  tasks: Task[];
  initialProductFilter?: number | null;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [showPlanStart, setShowPlanStart] = useState(true);
  const [showPlanEnd, setShowPlanEnd] = useState(true);
  const [showFactStart, setShowFactStart] = useState(true);
  const [showFactEnd, setShowFactEnd] = useState(true);
  const [showProduct, setShowProduct] = useState(false);
  const [showManufacturer, setShowManufacturer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>(() => {
    console.log('initialProductFilter:', initialProductFilter, typeof initialProductFilter);
    console.log('first task product_id:', initialTasks[0]?.product_id, typeof initialTasks[0]?.product_id);
    if (!initialProductFilter) return [];
    const match = initialTasks.find((t) => t.product_id === initialProductFilter);
    return match?.products?.name ? [match.products.name] : [];
  });
  const [groupMode, setGroupMode] = useState<"product" | "manufacturer">("product");
  const [imgTooltip, setImgTooltip] = useState<{ url: string; x: number; y: number } | null>(null);

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

  const productNames = Array.from(
    new Set(tasks.map((t) => t.products?.name).filter(Boolean) as string[])
  ).sort();

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter.length > 0 && (t.status === null || !statusFilter.includes(t.status))) return false;
    if (productFilter.length > 0 && (t.products?.name == null || !productFilter.includes(t.products.name))) return false;
    return true;
  });

  // rangeStart/rangeEnd — по всем задачам, не по отфильтрованным
  const rangeStart =
    tasks.map((t) => t.plan_start).filter(Boolean).sort()[0] ??
    new Date().toISOString().slice(0, 10);
  const rangeEnd =
    tasks.map((t) => t.plan_end).filter(Boolean).sort().at(-1) ??
    new Date().toISOString().slice(0, 10);

  const mondays = getMondays(rangeStart, rangeEnd);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayInRange = todayIso >= rangeStart && todayIso <= rangeEnd;
  const todayLeft = todayInRange ? toPercent(todayIso, rangeStart, rangeEnd) : null;

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
        <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100" style={{ paddingLeft: nameIndent, paddingRight: 16, width: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.template_tasks?.name ?? "—"}
        </td>
        <td className="px-2 py-2" style={{ width: 120 }}>
          <select
            value={task.status ?? "Не начата"}
            onChange={(e) => updateStatus(task.id, e.target.value)}
            style={{ color: STATUS_COLORS[task.status ?? "Не начата"] ?? "#B4B2A9" }}
            className="w-full text-sm font-medium bg-transparent border border-transparent rounded px-2 py-1 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none cursor-pointer transition-colors"
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
              className="text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        {showPlanEnd && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.plan_end ?? ""}
              onChange={(e) => updateDate(task.id, "plan_end", e.target.value)}
              className="text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        {showFactStart && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.fact_start ?? ""}
              onChange={(e) => updateDate(task.id, "fact_start", e.target.value)}
              className="text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        {showFactEnd && (
          <td className="px-4 py-2" style={{ width: 140 }}>
            <input
              type="date"
              value={task.fact_end ?? ""}
              onChange={(e) => updateDate(task.id, "fact_end", e.target.value)}
              className="text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
            />
          </td>
        )}
        <td className="px-4 py-3" style={{ minWidth: 400 }}>
          <div className="relative">
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
        </div>
      </div>

      <div
        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
      >
        <table className="w-full text-sm text-left" style={{ tableLayout: "fixed", width: "100%" }}>
          <thead className="text-zinc-600 dark:text-zinc-400 uppercase text-xs tracking-wide">
            {/* Строка 1: заголовки колонок */}
            <tr>
              <th className="px-4 font-medium" style={{ ...thSticky0, width: 180 }}>
                <FilterDropdown
                  label="Задача"
                  options={productNames}
                  selected={productFilter}
                  onApply={setProductFilter}
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
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 150 }}>Продукт</th>
              )}
              {showManufacturer && (
                <th className="px-4 font-medium" style={{ ...thSticky0, width: 150 }}>Производитель</th>
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
                  {mondays.map((iso) => (
                    <span
                      key={iso}
                      className="absolute text-[10px] text-zinc-400 dark:text-zinc-500 -translate-x-1/2"
                      style={{ left: `${toPercent(iso, rangeStart, rangeEnd)}%`, top: 4 }}
                    >
                      {formatDateShort(iso)}
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
