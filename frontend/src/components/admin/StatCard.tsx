// // ============================================================
// // StatCard.tsx — Admin dashboard KPI card
// // UI CHANGE: Fluid layout, larger value on desktop, icon scales
// //            properly, label never truncates on 2-col mobile grid.
// // Logic unchanged.
// // ============================================================

// import React from "react";

// interface StatCardProps {
//   label: string;
//   value: number | string;
//   icon: React.ReactNode;
//   color?: "teal" | "blue" | "amber" | "slate";
// }

// const colorMap = {
//   teal: "bg-teal-50 text-teal-700 border-teal-100",
//   blue: "bg-blue-50 text-blue-700 border-blue-100",
//   amber: "bg-amber-50 text-amber-700 border-amber-100",
//   slate: "bg-slate-50 text-slate-700 border-slate-200",
// };

// export const StatCard: React.FC<StatCardProps> = ({
//   label,
//   value,
//   icon,
//   color = "slate",
// }) => {
//   console.log("[StatCard] render", { label, value });

//   return (
//     <div
//       className={`rounded-xl border p-3 sm:p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${colorMap[color]}`}
//     >
//       {/* Icon — larger on desktop */}
//       <div className="text-2xl sm:text-3xl leading-none flex-shrink-0">
//         {icon}
//       </div>

//       <div className="min-w-0">
//         {/* Value */}
//         <p className="text-2xl sm:text-3xl font-bold leading-none tabular-nums">
//           {value}
//         </p>
//         {/* Label — allow wrap instead of truncating on mobile */}
//         <p className="text-xs sm:text-sm opacity-70 mt-0.5 leading-snug">
//           {label}
//         </p>
//       </div>
//     </div>
//   );
// };

// ============================================================
// StatCard.tsx — Admin dashboard KPI card
// CHANGE: Added optional onClick prop — when provided the card
//         renders as a button with hover/focus styles.
//         All existing props and styles unchanged.
// ============================================================

import React from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: "teal" | "blue" | "amber" | "slate";
  onClick?: () => void;
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
  onClick,
}) => {
  console.log("[StatCard] render", { label, value });

  const base = `rounded-xl border p-3 sm:p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${colorMap[color]}`;
  const clickable = onClick
    ? "cursor-pointer hover:brightness-95 hover:shadow-md active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-400"
    : "";

  const content = (
    <>
      <div className="text-2xl sm:text-3xl leading-none flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl font-bold leading-none tabular-nums">
          {value}
        </p>
        <p className="text-xs sm:text-sm opacity-70 mt-0.5 leading-snug">
          {label}
        </p>
      </div>
      {onClick && (
        <div className="ml-auto flex-shrink-0 opacity-50 text-xs">→</div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} ${clickable} w-full text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
};
