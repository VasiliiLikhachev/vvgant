import GanttTable from "@/components/gantt/GanttTable";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; project?: string }>;
}) {
  const params = await searchParams;
  const productId = params.product ? parseInt(params.product, 10) : null;
  const projectSlug = params.project ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <main className="w-full px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Гант — задачи
        </h1>
        <GanttTable initialProductFilter={productId} projectSlug={projectSlug} />
      </main>
    </div>
  );
}
