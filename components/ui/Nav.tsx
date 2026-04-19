"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";

const STORAGE_KEY = "currentProject";

const NAV_LINKS = [
  { href: "/", label: "Гант" },
  { href: "/products", label: "Продукты" },
  { href: "/template", label: "Шаблон" },
];

const TRANSLIT: Record<string, string> = {
  а: "a",  б: "b",  в: "v",  г: "g",  д: "d",  е: "e",  ё: "yo",
  ж: "zh", з: "z",  и: "i",  й: "y",  к: "k",  л: "l",  м: "m",
  н: "n",  о: "o",  п: "p",  р: "r",  с: "s",  т: "t",  у: "u",
  ф: "f",  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch",ъ: "",
  ы: "y",  ь: "",   э: "e",  ю: "yu", я: "ya",
};

function transliterate(str: string): string {
  return str
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("");
}

function toSlug(name: string): string {
  return transliterate(name)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase
        .from("projects")
        .select("id, name, slug, created_at")
        .order("created_at");
      const list: Project[] = data ?? [];
      setProjects(list);
      if (list.length === 0) return;

      const urlSlug = searchParams.get("project");
      const storedSlug =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

      let resolved: string | null = null;
      if (urlSlug && list.find((p) => p.slug === urlSlug)) {
        resolved = urlSlug;
      } else if (storedSlug && list.find((p) => p.slug === storedSlug)) {
        resolved = storedSlug;
      } else {
        resolved = list[0].slug;
      }

      setCurrentSlug(resolved);
      localStorage.setItem(STORAGE_KEY, resolved);

      if (!urlSlug || urlSlug !== resolved) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("project", resolved);
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Закрытие дропдауна по клику вне
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  // Авто-slug из названия
  useEffect(() => {
    setNewSlug(toSlug(newName));
  }, [newName]);

  function selectProject(slug: string) {
    setCurrentSlug(slug);
    localStorage.setItem(STORAGE_KEY, slug);
    setDropdownOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", slug);
    router.push(`${pathname}?${params.toString()}`);
  }

  function linkHref(href: string) {
    return currentSlug ? `${href}?project=${currentSlug}` : href;
  }

  async function createProject() {
    if (!newName.trim()) {
      setCreateError("Введите название проекта");
      return;
    }
    const slug = newSlug.trim() || toSlug(newName);
    if (!slug) {
      setCreateError("Введите slug");
      return;
    }
    setCreating(true);
    setCreateError(null);

    // 1. INSERT project
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({ name: newName.trim(), slug })
      .select("id, name, slug, created_at")
      .single();
    if (pErr) {
      setCreateError(
        pErr.code === "23505" && pErr.message.includes("projects_slug_key")
          ? "Проект с таким slug уже существует"
          : pErr.message
      );
      setCreating(false);
      return;
    }

    // 2. INSERT новый шаблон
    const { data: newTemplate, error: tmplErr } = await supabase
      .from("templates")
      .insert({ name: "Шаблон", project_id: project.id })
      .select("id")
      .single();
    if (tmplErr) {
      setCreateError(tmplErr.message);
      setCreating(false);
      return;
    }

    // 3. Копируем template_tasks из текущего проекта
    const srcProject = projects.find((p) => p.slug === currentSlug);
    if (srcProject) {
      const { data: srcTmpl } = await supabase
        .from("templates")
        .select("id")
        .eq("project_id", srcProject.id)
        .single();

      if (srcTmpl) {
        const { data: srcTasks } = await supabase
          .from("template_tasks")
          .select("id, name, duration_days, starts_after, order")
          .eq("template_id", srcTmpl.id)
          .order("order");

        if (srcTasks && srcTasks.length > 0) {
          // Вставляем по одному, чтобы корректно ремаппить starts_after
          const idMap = new Map<number, number>(); // oldId → newId
          for (const t of srcTasks) {
            const newStartsAfter =
              t.starts_after != null ? (idMap.get(t.starts_after) ?? null) : null;
            const { data: ins } = await supabase
              .from("template_tasks")
              .insert({
                template_id: newTemplate.id,
                name: t.name,
                duration_days: t.duration_days,
                starts_after: newStartsAfter,
                order: t.order,
              })
              .select("id")
              .single();
            if (ins) idMap.set(t.id, ins.id);
          }
        }
      }
    }

    // 4. Обновляем список и переключаемся
    setProjects((prev) => [...prev, project as Project]);
    setModalOpen(false);
    setNewName("");
    setNewSlug("");
    setCreating(false);
    selectProject((project as Project).slug);
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
    setNewName("");
    setNewSlug("");
    setCreateError(null);
  }

  const currentProject = projects.find((p) => p.slug === currentSlug);

  return (
    <>
      <nav className="w-full bg-white border-b border-zinc-200 px-6 flex items-center gap-1 h-12 flex-shrink-0">
        {/* Дропдаун проекта */}
        <div className="relative mr-2" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-colors max-w-[180px]"
          >
            <span className="truncate">
              {currentProject?.name ?? "Выбрать проект…"}
            </span>
            <svg
              className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 py-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.slug)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    p.slug === currentSlug
                      ? "bg-zinc-100 text-zinc-900 font-medium"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {p.name}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-4 py-2 text-sm text-zinc-400">Нет проектов</div>
              )}
            </div>
          )}
        </div>

        {/* Кнопка нового проекта */}
        <button
          onClick={() => {
            setDropdownOpen(false);
            setModalOpen(true);
          }}
          className="mr-3 px-2.5 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-500 rounded-lg hover:border-zinc-300 hover:text-zinc-700 transition-colors"
        >
          + Проект
        </button>

        {/* Разделитель */}
        <div className="w-px h-5 bg-zinc-200 mr-3" />

        {/* Навигационные ссылки */}
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={linkHref(href)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Модалка создания проекта */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <h2 className="text-base font-bold text-zinc-900 mb-4">Новый проект</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Название</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                    placeholder="Например: ВкусВилл Маркет"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Slug (URL)</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm font-mono focus:outline-none focus:border-zinc-500 transition-colors"
                    placeholder="vkusvill-market"
                  />
                </label>
                {currentProject && (
                  <p className="text-xs text-zinc-400">
                    Шаблон будет скопирован из «{currentProject.name}»
                  </p>
                )}
                {createError && (
                  <p className="text-sm text-red-500">{createError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={closeModal}
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 rounded-lg hover:border-zinc-400 disabled:opacity-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={createProject}
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Создаётся…" : "Создать"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
