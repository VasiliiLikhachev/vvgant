"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

type TemplateTask = {
  id: number;
  template_id: number;
  name: string;
  duration_days: number;
  starts_after: number | null;
  order: number;
};

// Добавляет days дней к ISO-дате, возвращает ISO-строку (YYYY-MM-DD)
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Вычисляет plan_start и plan_end для каждого template_task
// Возвращает Map<templateTaskId, { plan_start, plan_end }>
function calcDates(
  templateTasks: TemplateTask[],
  projectStart: string
): Map<number, { plan_start: string; plan_end: string }> {
  const result = new Map<number, { plan_start: string; plan_end: string }>();
  const byId = new Map(templateTasks.map((t) => [t.id, t]));

  function resolve(id: number): { plan_start: string; plan_end: string } {
    if (result.has(id)) return result.get(id)!;
    const task = byId.get(id);
    if (!task) return { plan_start: projectStart, plan_end: projectStart };

    let start: string;
    if (task.starts_after === null) {
      start = projectStart;
    } else {
      const prev = resolve(task.starts_after);
      start = addDays(prev.plan_end, 1);
    }
    const end = addDays(start, task.duration_days - 1);
    const dates = { plan_start: start, plan_end: end };
    result.set(id, dates);
    return dates;
  }

  for (const t of templateTasks) {
    resolve(t.id);
  }
  return result;
}

type ModalState = {
  open: boolean;
  productName: string;
  startDate: string;
  manufacturerName: string;
  creating: boolean;
  error: string | null;
};

const MODAL_INIT: ModalState = {
  open: false,
  productName: "",
  startDate: new Date().toISOString().slice(0, 10),
  manufacturerName: "",
  creating: false,
  error: null,
};

export default function TemplatePage() {
  return (
    <Suspense>
      <TemplateContent />
    </Suspense>
  );
}

function TemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectSlug = searchParams.get("project");

  const [templateId, setTemplateId] = useState<number>(1);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; productId: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(MODAL_INIT);

  // Отслеживаем, какие id были изменены
  const dirtyIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    async function init() {
      let tmplId = 1;
      let projId: number | null = null;

      if (projectSlug) {
        const { data: proj } = await supabase
          .from("projects")
          .select("id")
          .eq("slug", projectSlug)
          .single();
        if (proj) {
          projId = proj.id;
          const { data: tmpl } = await supabase
            .from("templates")
            .select("id")
            .eq("project_id", proj.id)
            .single();
          if (tmpl) tmplId = tmpl.id;
        }
      }

      setTemplateId(tmplId);
      setProjectId(projId);
      await load(tmplId);
    }
    init();
  }, [projectSlug]);

  async function load(tmplId = templateId) {
    setLoading(true);
    const { data, error } = await supabase
      .from("template_tasks")
      .select("id, template_id, name, duration_days, starts_after, order")
      .eq("template_id", tmplId)
      .order("order");
    if (error) {
      console.error("Ошибка загрузки шаблона:", error.message);
    } else {
      setTasks(data ?? []);
      dirtyIds.current.clear();
    }
    setLoading(false);
  }

  function handleChange(
    id: number,
    field: keyof Pick<TemplateTask, "name" | "duration_days" | "starts_after">,
    raw: string
  ) {
    let value: string | number | null = raw;
    if (field === "duration_days") value = raw === "" ? 1 : parseInt(raw, 10);
    if (field === "starts_after") value = raw === "" ? null : parseInt(raw, 10);

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    dirtyIds.current.add(id);
  }

  async function saveTemplate() {
    const ids = Array.from(dirtyIds.current);
    if (ids.length === 0) {
      setStatusMsg("Нет изменений");
      setTimeout(() => setStatusMsg(null), 2000);
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const results = await Promise.all(
      ids.map((id) => {
        const t = byId.get(id);
        if (!t) return Promise.resolve({ error: null });
        return supabase
          .from("template_tasks")
          .update({
            name: t.name,
            duration_days: t.duration_days,
            starts_after: t.starts_after,
          })
          .eq("id", id);
      })
    );
    const errors = results.filter((r) => r.error).map((r) => r.error!.message);
    if (errors.length > 0) {
      setStatusMsg(`Ошибка: ${errors[0]}`);
    } else {
      dirtyIds.current.clear();
      setStatusMsg("Сохранено");
      setTimeout(() => setStatusMsg(null), 2000);
    }
    setSaving(false);
  }

  async function applyToProducts() {
    setApplying(true);
    setStatusMsg(null);

    // 1. Загружаем manufacturers (у каждого есть product_id)
    const { data: manufacturers, error: mfErr } = await supabase
      .from("manufacturers")
      .select("id, product_id");
    if (mfErr) {
      setStatusMsg(`Ошибка: ${mfErr.message}`);
      setApplying(false);
      return;
    }

    // 2. Загружаем tasks с привязкой к template_task и plan_start первой задачи
    //    Нам нужен plan_start первого этапа (starts_after = null) чтобы знать дату старта продукта.
    //    Берём минимальный plan_start по каждой паре (product_id, manufacturer_id).
    const { data: existingTasks, error: tErr } = await supabase
      .from("tasks")
      .select("id, product_id, manufacturer_id, template_task_id, plan_start");
    if (tErr) {
      setStatusMsg(`Ошибка: ${tErr.message}`);
      setApplying(false);
      return;
    }

    // 3. Для каждой пары (product_id, manufacturer_id) найдём дату старта —
    //    минимальный plan_start среди задач этой пары
    type PairKey = string;
    const startByPair = new Map<PairKey, string>();
    for (const t of existingTasks ?? []) {
      if (!t.plan_start) continue;
      const key: PairKey = `${t.product_id}:${t.manufacturer_id}`;
      const cur = startByPair.get(key);
      if (!cur || t.plan_start < cur) startByPair.set(key, t.plan_start);
    }

    // 4. Пересчитываем даты по шаблону
    const updates: { id: string; plan_start: string; plan_end: string }[] = [];

    for (const t of existingTasks ?? []) {
      if (!t.template_task_id) continue;
      const key: PairKey = `${t.product_id}:${t.manufacturer_id}`;
      const projectStart = startByPair.get(key);
      if (!projectStart) continue;

      const dateMap = calcDates(tasks, projectStart);
      const dates = dateMap.get(t.template_task_id);
      if (!dates) continue;

      updates.push({ id: t.id, plan_start: dates.plan_start, plan_end: dates.plan_end });
    }

    if (updates.length === 0) {
      setStatusMsg("Нет задач для обновления");
      setApplying(false);
      return;
    }

    // 5. Батч UPDATE
    const results = await Promise.all(
      updates.map(({ id, plan_start, plan_end }) =>
        supabase.from("tasks").update({ plan_start, plan_end }).eq("id", id)
      )
    );
    const errors = results.filter((r) => r.error).map((r) => r.error!.message);
    if (errors.length > 0) {
      setStatusMsg(`Ошибка: ${errors[0]}`);
    } else {
      setStatusMsg(`Применено к ${updates.length} задачам`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
    setApplying(false);
  }

  async function createProduct() {
    const { productName, startDate, manufacturerName } = modal;
    if (!productName.trim()) {
      setModal((m) => ({ ...m, error: "Введите название продукта" }));
      return;
    }
    if (!startDate) {
      setModal((m) => ({ ...m, error: "Выберите дату старта" }));
      return;
    }
    if (!manufacturerName.trim()) {
      setModal((m) => ({ ...m, error: "Введите производителя" }));
      return;
    }

    setModal((m) => ({ ...m, creating: true, error: null }));

    // 1. INSERT product
    const { data: product, error: pErr } = await supabase
      .from("products")
      .insert({
        name: productName.trim(),
        ...(projectId !== null ? { project_id: projectId } : {}),
      })
      .select("id")
      .single();
    if (pErr) {
      setModal((m) => ({ ...m, creating: false, error: pErr.message }));
      return;
    }

    // 2. INSERT manufacturer
    const { data: manufacturer, error: mErr } = await supabase
      .from("manufacturers")
      .insert({ product_id: product.id, name: manufacturerName.trim() })
      .select("id")
      .single();
    if (mErr) {
      setModal((m) => ({ ...m, creating: false, error: mErr.message }));
      return;
    }

    // 3. Пересчёт дат
    const dateMap = calcDates(tasks, startDate);

    // 4. INSERT tasks
    const rows = tasks.map((t) => {
      const dates = dateMap.get(t.id) ?? { plan_start: startDate, plan_end: startDate };
      return {
        product_id: product.id,
        manufacturer_id: manufacturer.id,
        template_task_id: t.id,
        plan_start: dates.plan_start,
        plan_end: dates.plan_end,
        status: "Не начата",
      };
    });

    const { error: tErr } = await supabase.from("tasks").insert(rows);
    if (tErr) {
      setModal((m) => ({ ...m, creating: false, error: tErr.message }));
      return;
    }

    setModal(MODAL_INIT);
    setToast({ message: `Продукт «${productName.trim()}» создан`, productId: product.id });
  }

  async function addTask() {
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order ?? 0), 0);
    const { data, error } = await supabase
      .from("template_tasks")
      .insert({
        template_id: templateId,
        name: "",
        duration_days: 1,
        starts_after: null,
        order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) {
      console.error("Ошибка добавления этапа:", error.message);
      return;
    }
    setTasks((prev) => [...prev, data]);
  }

  async function deleteTask(id: number) {
    const { error } = await supabase
      .from("template_tasks")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Ошибка удаления:", error.message);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    dirtyIds.current.delete(id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-zinc-400">
        Загрузка шаблона…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Заголовок + кнопки */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-zinc-900">Редактор шаблона</h1>
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className="text-sm text-zinc-500">{statusMsg}</span>
          )}
          <button
            onClick={saveTemplate}
            disabled={saving || applying}
            className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Сохранение…" : "Сохранить шаблон"}
          </button>
          <button
            onClick={applyToProducts}
            disabled={saving || applying}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {applying ? "Применяется…" : "Применить к продуктам"}
          </button>
          <button
            onClick={() => setModal({ ...MODAL_INIT, open: true })}
            disabled={saving || applying}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            + Создать продукт
          </button>
        </div>
      </div>

      <div className="border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-16">Порядок</th>
              <th className="px-4 py-3 text-left">Название этапа</th>
              <th className="px-4 py-3 text-left w-36">Длит., дней</th>
              <th className="px-4 py-3 text-left w-56">Начинается после</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={`hover:bg-zinc-50 transition-colors ${
                  dirtyIds.current.has(task.id) ? "bg-amber-50" : "bg-white"
                }`}
              >
                {/* Порядок */}
                <td className="px-4 py-2 text-zinc-400 text-center">{task.order}</td>

                {/* Название */}
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={task.name}
                    onChange={(e) => handleChange(task.id, "name", e.target.value)}
                    className="w-full px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900"
                    placeholder="Название этапа"
                  />
                </td>

                {/* Длительность */}
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={1}
                    value={task.duration_days}
                    onChange={(e) => handleChange(task.id, "duration_days", e.target.value)}
                    className="w-full px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900 text-center"
                  />
                </td>

                {/* Начинается после */}
                <td className="px-4 py-2">
                  <select
                    value={task.starts_after ?? ""}
                    onChange={(e) => handleChange(task.id, "starts_after", e.target.value)}
                    className="w-full px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900 bg-white cursor-pointer"
                  >
                    <option value="">С начала</option>
                    {tasks
                      .filter((t) => t.id !== task.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.order}. {t.name || "—"}
                        </option>
                      ))}
                  </select>
                </td>

                {/* Удалить */}
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-zinc-300 hover:text-red-500 transition-colors font-bold text-base leading-none"
                    title="Удалить этап"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addTask}
        className="mt-4 px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 rounded-lg hover:border-zinc-400 hover:text-zinc-900 transition-colors"
      >
        + Добавить этап
      </button>

      {/* Модалка создания продукта */}
      {modal.open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => !modal.creating && setModal(MODAL_INIT)}
          />

          {/* Окно */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-zinc-900 mb-5">Создать продукт</h2>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Название продукта</span>
                  <input
                    type="text"
                    value={modal.productName}
                    onChange={(e) => setModal((m) => ({ ...m, productName: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                    placeholder="Например: Творог клубничный"
                    autoFocus
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Дата старта</span>
                  <input
                    type="date"
                    value={modal.startDate}
                    onChange={(e) => setModal((m) => ({ ...m, startDate: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Производитель</span>
                  <input
                    type="text"
                    value={modal.manufacturerName}
                    onChange={(e) => setModal((m) => ({ ...m, manufacturerName: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                    placeholder="Например: ООО Молочный завод"
                  />
                </label>

                {modal.error && (
                  <p className="text-sm text-red-500">{modal.error}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setModal(MODAL_INIT)}
                  disabled={modal.creating}
                  className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 rounded-lg hover:border-zinc-400 disabled:opacity-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={createProduct}
                  disabled={modal.creating}
                  className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                  {modal.creating ? "Создаётся…" : "Создать"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Перейти к Ганту"
          onAction={() =>
            router.push(
              `/?product=${toast.productId}${projectSlug ? `&project=${projectSlug}` : ""}`
            )
          }
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
