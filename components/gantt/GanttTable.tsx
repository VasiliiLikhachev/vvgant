import { supabase } from "@/lib/supabase";
import GanttTableClient from "./GanttTableClient";

export default async function GanttTable({
  initialProductFilter,
}: {
  initialProductFilter?: number | null;
}) {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, product_id, status, plan_start, plan_end, fact_start, fact_end, template_tasks(name, order), products(name, image_url), manufacturers(name)"
    );

  if (error) {
    console.error("GanttTable fetch error:", error.message);
  }

  const rows = ((tasks ?? []) as Parameters<typeof GanttTableClient>[0]["tasks"]).sort(
    (a, b) => (a.template_tasks?.order ?? 0) - (b.template_tasks?.order ?? 0)
  );

  return <GanttTableClient tasks={rows} initialProductFilter={initialProductFilter} />;
}
