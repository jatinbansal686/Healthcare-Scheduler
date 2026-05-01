// ============================================================
// StatCard.tsx — Admin dashboard KPI card
// UI CHANGE: Fluid layout, larger value on desktop, icon scales
//            properly, label never truncates on 2-col mobile grid.
// Logic unchanged.
// ============================================================

import React from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: "teal" | "blue" | "amber" | "slate";
}

const colorMap = {
  teal: "bg-teal-50 text-teal-700 border-teal-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = "slate",
}) => {
  console.log("[StatCard] render", { label, value });

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${colorMap[color]}`}
    >
      {/* Icon — larger on desktop */}
      <div className="text-2xl sm:text-3xl leading-none flex-shrink-0">
        {icon}
      </div>

      <div className="min-w-0">
        {/* Value */}
        <p className="text-2xl sm:text-3xl font-bold leading-none tabular-nums">
          {value}
        </p>
        {/* Label — allow wrap instead of truncating on mobile */}
        <p className="text-xs sm:text-sm opacity-70 mt-0.5 leading-snug">
          {label}
        </p>
      </div>
    </div>
  );
};
