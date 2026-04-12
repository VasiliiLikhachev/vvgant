import GanttTable from "@/components/gantt/GanttTable";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <main className="w-full px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Гант — задачи
        </h1>
        <GanttTable />
      </main>
    </div>
  );
}
