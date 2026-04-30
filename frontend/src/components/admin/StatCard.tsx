// ============================================================
// StatCard.tsx — Admin dashboard KPI card
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
      className={`rounded-xl border p-3 sm:p-5 flex items-center gap-3 sm:gap-4 ${colorMap[color]}`}
    >
      <div className="text-xl sm:text-2xl">{icon}</div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        <p className="text-xs sm:text-sm opacity-70 truncate">{label}</p>
      </div>
    </div>
  );
};
