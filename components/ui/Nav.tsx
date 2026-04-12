"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Гант" },
  { href: "/products", label: "Продукты" },
  { href: "/template", label: "Шаблон" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-full bg-white border-b border-zinc-200 px-6 flex items-center gap-1 h-12 flex-shrink-0">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
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
  );
}
