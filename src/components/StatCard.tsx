import React from "react";
import { cn } from "@/src/lib/utils";
import { DivideIcon as LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: number;
  icon: React.ElementType;
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden",
        className,
      )}
    >
      <div className="relative z-10 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative z-10 mt-4 flex items-baseline gap-2">
        <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">
          {value}
        </h3>
        {trend !== undefined && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-md",
              trend > 0
                ? "bg-green-50 text-green-700"
                : trend < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-700",
            )}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      {description && (
        <p className="relative z-10 mt-1 text-sm text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}
