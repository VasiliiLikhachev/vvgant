"use client";

import { useState } from "react";

type Task = {
  id: string;
  status: string | null;
  plan_start: string | null;
  plan_end: string | null;
  template_tasks: { name: string; order: number | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  "Не начата": "Не начата",
  "В процессе": "В процессе",
  "Готово": "Готово",
  "Задержка": "Задержка",
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

export default function GanttTableClient({ tasks }: { tasks: Task[] }) {
  const [showPlanStart, setShowPlanStart] = useState(true);
  const [showPlanEnd, setShowPlanEnd] = useState(true);

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

      <div className="w-full overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3 font-medium">Название задачи</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              {showPlanStart && (
                <th className="px-4 py-3 font-medium">Дата начала (план)</th>
              )}
              {showPlanEnd && (
                <th className="px-4 py-3 font-medium">Дата конца (план)</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + (showPlanStart ? 1 : 0) + (showPlanEnd ? 1 : 0)}
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
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDate(task.plan_start)}
                    </td>
                  )}
                  {showPlanEnd && (
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDate(task.plan_end)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
