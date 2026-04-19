import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at");
  if (error) console.error("getProjects error:", error.message);
  return data ?? [];
}
