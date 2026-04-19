// ─── Справочники ────────────────────────────────────────────────────────────

export type Project = {
  id: number;
  name: string;
  slug: string;
  created_at: string;
};

export type Role = {
  id: number;
  name: string;
};

export type Person = {
  id: number;
  name: string;
  role_id: number | null;
  roles: Role | null;
};

// ─── Продукты и производители ───────────────────────────────────────────────

export type Manufacturer = {
  id: number;
  name: string;
  product_id: number;
};

export type Product = {
  id: number;
  name: string;
  image_url: string | null;
  project_id: number | null;
  manufacturers: Manufacturer[];
};

// ─── Шаблон ─────────────────────────────────────────────────────────────────

export type Template = {
  id: number;
  name: string;
  project_id: number | null;
};

export type TemplateTask = {
  id: number;
  template_id: number;
  name: string;
  duration_days: number;
  starts_after: number | null;
  order: number;
};

// ─── Задачи ─────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "Не начата"
  | "В процессе"
  | "Готово"
  | "Задержка";

export type TaskAssignee = {
  person_id: number;
  people: Person | null;
};

export type Task = {
  id: string;
  product_id: number | null;
  manufacturer_id: number | null;
  template_task_id: number | null;
  status: TaskStatus | null;
  plan_start: string | null;
  plan_end: string | null;
  fact_start: string | null;
  fact_end: string | null;
  updated_at: string | null;
  template_tasks: { name: string; order: number | null } | null;
  products: { name: string; image_url: string | null; project_id: number | null } | null;
  manufacturers: { name: string } | null;
  task_assignees?: TaskAssignee[];
};
