"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center min-w-0 overflow-hidden">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
      >
        <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className={`flex items-center min-w-0 ${isLast ? "overflow-hidden" : "shrink-0"}`}>
            <ChevronRight className="w-3.5 h-3.5 mx-0.5 sm:mx-1 text-muted-foreground shrink-0" />
            {item.href ? (
              <Link
                href={item.href}
                className="text-[11px] sm:text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[11px] sm:text-sm text-foreground font-medium truncate" aria-current="page">
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
