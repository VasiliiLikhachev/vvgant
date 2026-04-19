import { supabase } from "@/lib/supabase";
import GanttTableClient from "./GanttTableClient";

export default async function GanttTable({
  initialProductFilter,
  projectSlug,
}: {
  initialProductFilter?: number | null;
  projectSlug?: string | null;
}) {
  // Если задан проект — фильтруем задачи по product_id через project
  let productIds: number[] | null = null;
  if (projectSlug) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", projectSlug)
      .single();

    if (project) {
      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("project_id", project.id);
      productIds = (products ?? []).map((p: { id: number }) => p.id);
    }
  }

  // Если проект выбран, но продуктов нет — возвращаем пустой стейт
  if (productIds !== null && productIds.length === 0) {
    return <GanttTableClient tasks={[]} initialProductFilter={initialProductFilter} />;
  }

  let query = supabase
    .from("tasks")
    .select(
      "id, product_id, status, plan_start, plan_end, fact_start, fact_end, template_tasks(name, order), products(name, image_url), manufacturers(name)"
    );

  if (productIds !== null) {
    query = query.in("product_id", productIds);
  }

  const { data: tasks, error } = await query;

  if (error) {
    console.error("GanttTable fetch error:", error.message);
  }

  const rows = (
    (tasks ?? []) as unknown as Parameters<typeof GanttTableClient>[0]["tasks"]
  ).sort((a, b) => (a.template_tasks?.order ?? 0) - (b.template_tasks?.order ?? 0));

  return (
    <GanttTableClient tasks={rows} initialProductFilter={initialProductFilter} />
  );
}
