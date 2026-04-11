"use client";

import { useState } from "react";
import GanttBar from "./GanttBar";
import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  status: string | null;
  plan_start: string | null;
  plan_end: string | null;
  fact_start: string | null;
  fact_end: string | null;
  template_tasks: { name: string; order: number | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  "Не начата": "Не начата",
  "В процессе": "В процессе",
  "Готово": "Готово",
  "Задержка": "Задержка",
};


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
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);

  // Найти первый понедельник >= start
  const cursor = new Date(start);
  const day = cursor.getDay();
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  cursor.setDate(cursor.getDate() + daysToMonday);

  while (cursor <= end) {
    mondays.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return mondays;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export default function GanttTableClient({ tasks: initialTasks }: { tasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [showPlanStart, setShowPlanStart] = useState(true);
  const [showPlanEnd, setShowPlanEnd] = useState(true);

  async function updateDate(id: string, field: "plan_start" | "plan_end", value: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      console.error("Ошибка обновления даты:", error.message);
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  const rangeStart = tasks
    .map((t) => t.plan_start)
    .filter(Boolean)
    .sort()[0] ?? new Date().toISOString().slice(0, 10);

  const rangeEnd = tasks
    .map((t) => t.plan_end)
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date().toISOString().slice(0, 10);

  const mondays = getMondays(rangeStart, rangeEnd);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayInRange =
    todayIso >= rangeStart && todayIso <= rangeEnd;
  const todayLeft = todayInRange
    ? toPercent(todayIso, rangeStart, rangeEnd)
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">
          Колонки:
        </span>
        <ToggleButton
          active={showPlanStart}
          onClick={() => setShowPlanStart((v) => !v)}
        >
          Дата начала (план)
        </ToggleButton>
        <ToggleButton
          active={showPlanEnd}
          onClick={() => setShowPlanEnd((v) => !v)}
        >
          Дата конца (план)
        </ToggleButton>
      </div>

      <div
        className="w-full overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
        style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}
      >
        <table className="w-full text-sm text-left">
          <thead className="text-zinc-600 dark:text-zinc-400 uppercase text-xs tracking-wide">
            {/* Строка 1: заголовки колонок */}
            <tr>
              <th className="px-4 font-medium" style={{ position: "sticky", top: 0, zIndex: 10, background: "white", height: 48, boxShadow: "0 1px 0 #e5e7eb" }}>Название задачи</th>
              <th className="px-4 font-medium" style={{ position: "sticky", top: 0, zIndex: 10, background: "white", height: 48, boxShadow: "0 1px 0 #e5e7eb" }}>Статус</th>
              {showPlanStart && (
                <th className="px-4 font-medium" style={{ position: "sticky", top: 0, zIndex: 10, background: "white", height: 48, boxShadow: "0 1px 0 #e5e7eb" }}>Дата начала (план)</th>
              )}
              {showPlanEnd && (
                <th className="px-4 font-medium" style={{ position: "sticky", top: 0, zIndex: 10, background: "white", height: 48, boxShadow: "0 1px 0 #e5e7eb" }}>Дата конца (план)</th>
              )}
              <th className="px-4 font-medium w-full" style={{ position: "sticky", top: 0, zIndex: 10, background: "white", height: 48, boxShadow: "0 1px 0 #e5e7eb" }}>Гант</th>
            </tr>
            {/* Строка 2: шкала дат */}
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th colSpan={2 + (showPlanStart ? 1 : 0) + (showPlanEnd ? 1 : 0)} style={{ position: "sticky", top: 48, zIndex: 10, background: "white" }} />
              <th className="px-4 py-1 w-full font-normal" style={{ position: "sticky", top: 48, zIndex: 10, background: "white" }}>
                <div className="relative w-full" style={{ height: 24 }}>
                  {mondays.map((iso) => {
                    const left = toPercent(iso, rangeStart, rangeEnd);
                    return (
                      <span
                        key={iso}
                        className="absolute text-[10px] text-zinc-400 dark:text-zinc-500 -translate-x-1/2"
                        style={{ left: `${left}%`, top: 4 }}
                      >
                        {formatDateShort(iso)}
                      </span>
                    );
                  })}
                  {todayLeft !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + (showPlanStart ? 1 : 0) + (showPlanEnd ? 1 : 0)}
                  className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500"
                >
                  Задачи не найдены
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {task.template_tasks?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {task.status
                      ? (STATUS_LABELS[task.status] ?? task.status)
                      : "—"}
                  </td>
                  {showPlanStart && (
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={task.plan_start ?? ""}
                        onChange={(e) => updateDate(task.id, "plan_start", e.target.value)}
                        className="text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
                      />
                    </td>
                  )}
                  {showPlanEnd && (
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={task.plan_end ?? ""}
                        onChange={(e) => updateDate(task.id, "plan_end", e.target.value)}
                        className="text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 w-full">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
