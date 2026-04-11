import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  status: string | null;
  plan_start: string | null;
  plan_end: string | null;
  template_tasks: { name: string; order: number | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  done: "Готово",
  blocked: "Заблокировано",
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function GanttTable() {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, status, plan_start, plan_end, template_tasks(name, order)");

  if (error) {
    console.error("GanttTable fetch error:", error.message);
  }

  const rows = ((tasks ?? []) as Task[]).sort(
    (a, b) => (a.template_tasks?.order ?? 0) - (b.template_tasks?.order ?? 0)
  );

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-3 font-medium">Название задачи</th>
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 font-medium">Дата начала (план)</th>
            <th className="px-4 py-3 font-medium">Дата конца (план)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500"
              >
                Задачи не найдены
              </td>
            </tr>
          ) : (
            rows.map((task) => (
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
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {formatDate(task.plan_start)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {formatDate(task.plan_end)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
