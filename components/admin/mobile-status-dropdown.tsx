"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

interface MobileStatusDropdownProps {
  currentStatus: string;
  statusOptions: string[];
}

export function MobileStatusDropdown({ currentStatus, statusOptions }: MobileStatusDropdownProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sm:hidden relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors w-full text-left"
      >
        <Filter className="h-4 w-4 text-slate-600" />
        <span className="text-sm font-medium text-slate-700">
          {currentStatus || "ALL"}
        </span>
        <span className="text-xs text-slate-500">
          ({currentStatus && currentStatus !== "ALL" ? "filtered" : "all"})
        </span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[150px] z-10">
          {statusOptions.map((s) => (
            <Link
              key={s}
              href={`/admin/orders?page=1&status=${s}${search ? `&search=${search}` : ""}`}
              className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                currentStatus === s
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => setIsOpen(false)}
            >
              {s}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
