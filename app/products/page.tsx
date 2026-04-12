"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Manufacturer = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  image_url: string | null;
  manufacturers: Manufacturer[];
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, image_url, manufacturers(id, name)")
      .order("id");
    if (error) {
      console.error("Ошибка загрузки продуктов:", error.message);
    } else {
      setProducts((data ?? []) as Product[]);
    }
    setLoading(false);
  }

  async function uploadImage(productId: number, file: File) {
    setUploadingId(productId);
    const ext = file.name.split(".").pop();
    const path = `${productId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("Ошибка загрузки файла:", uploadError.message);
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: publicUrl })
      .eq("id", productId);

    if (updateError) {
      console.error("Ошибка сохранения URL:", updateError.message);
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image_url: publicUrl } : p))
      );
    }
    setUploadingId(null);
  }

  async function deleteProduct(productId: number) {
    setDeletingId(productId);

    // Удаляем tasks
    await supabase.from("tasks").delete().eq("product_id", productId);
    // Удаляем manufacturers
    await supabase.from("manufacturers").delete().eq("product_id", productId);
    // Удаляем product
    const { error } = await supabase.from("products").delete().eq("id", productId);

    if (error) {
      console.error("Ошибка удаления:", error.message);
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-zinc-400">
        Загрузка продуктов…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Продукты</h1>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          ← Гант
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-zinc-400 text-sm">Продуктов пока нет. Создайте их в редакторе шаблона.</p>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-start gap-4 border border-zinc-200 rounded-xl p-4 bg-white"
            >
              {/* Картинка */}
              <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-zinc-300 text-3xl">📦</span>
                )}
              </div>

              {/* Инфо */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-zinc-900 text-base">{product.name}</div>
                <div className="mt-1 text-sm text-zinc-500">
                  {product.manufacturers.length > 0 ? (
                    <span>
                      Производители: {product.manufacturers.map((m) => m.name).join(", ")}
                    </span>
                  ) : (
                    <span className="italic">Производителей нет</span>
                  )}
                </div>
              </div>

              {/* Действия */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Link
                  href={`/?product=${product.id}`}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors text-center"
                >
                  Перейти к Ганту
                </Link>

                {/* Загрузить картинку */}
                <button
                  onClick={() => fileInputRefs.current[product.id]?.click()}
                  disabled={uploadingId === product.id}
                  className="px-3 py-1.5 text-xs font-medium border border-zinc-300 text-zinc-700 rounded-lg hover:border-zinc-400 disabled:opacity-50 transition-colors"
                >
                  {uploadingId === product.id
                    ? "Загрузка…"
                    : product.image_url
                    ? "Заменить фото"
                    : "Загрузить фото"}
                </button>
                <input
                  ref={(el) => { fileInputRefs.current[product.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(product.id, file);
                    e.target.value = "";
                  }}
                />

                {/* Удалить */}
                {confirmDeleteId === product.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => deleteProduct(product.id)}
                      disabled={deletingId === product.id}
                      className="flex-1 px-2 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === product.id ? "…" : "Да"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 px-2 py-1.5 text-xs font-medium border border-zinc-300 text-zinc-600 rounded-lg hover:border-zinc-400 transition-colors"
                    >
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(product.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
