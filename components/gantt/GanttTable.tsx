import { supabase } from "@/lib/supabase";
import GanttTableClient from "./GanttTableClient";

export default async function GanttTable() {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, status, plan_start, plan_end, fact_start, fact_end, template_tasks(name, order)");

  if (error) {
    console.error("GanttTable fetch error:", error.message);
  }

  const rows = ((tasks ?? []) as Parameters<typeof GanttTableClient>[0]["tasks"]).sort(
    (a, b) => (a.template_tasks?.order ?? 0) - (b.template_tasks?.order ?? 0)
  );

  return <GanttTableClient tasks={rows} />;
}
