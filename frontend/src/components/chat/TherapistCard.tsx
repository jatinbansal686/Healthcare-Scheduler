// // ============================================================
// // TherapistCard.tsx — Displays therapist match in chat flow
// // ============================================================

// import React from 'react';
// import type { Therapist } from '../../types';

// interface TherapistCardProps {
//   therapist: Therapist;
//   matchedSpecialties?: string[];
//   onSelect?: (therapist: Therapist) => void;
// }

// export const TherapistCard: React.FC<TherapistCardProps> = ({
//   therapist,
//   matchedSpecialties = [],
//   onSelect,
// }) => {
//   console.log('[TherapistCard] render', { therapistId: therapist.id, name: therapist.name });

//   return (
//     <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 max-w-sm">
//       <div className="flex items-start gap-3">
//         {/* Avatar */}
//         <div className="h-12 w-12 flex-shrink-0 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-lg font-bold">
//           {therapist.name.charAt(0)}
//         </div>

//         <div className="flex-1 min-w-0">
//           <h3 className="font-semibold text-slate-800 truncate">{therapist.name}</h3>

//           {/* Specialties */}
//           <div className="mt-1 flex flex-wrap gap-1">
//             {therapist.specialties.slice(0, 4).map((spec) => (
//               <span
//                 key={spec}
//                 className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
//                   matchedSpecialties.includes(spec)
//                     ? 'bg-teal-100 text-teal-700'
//                     : 'bg-slate-100 text-slate-500'
//                 }`}
//               >
//                 {spec}
//               </span>
//             ))}
//           </div>

//           {/* Insurance */}
//           {therapist.accepted_insurance.length > 0 && (
//             <p className="mt-1.5 text-xs text-slate-500">
//               Accepts: {therapist.accepted_insurance.slice(0, 3).join(', ')}
//             </p>
//           )}
//         </div>
//       </div>

//       {/* Bio */}
//       {therapist.bio && (
//         <p className="mt-3 text-xs text-slate-600 line-clamp-2">{therapist.bio}</p>
//       )}

//       {/* Action */}
//       {onSelect && (
//         <button
//           onClick={() => onSelect(therapist)}
//           className="mt-3 w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
//         >
//           Select {therapist.name.split(' ')[0]}
//         </button>
//       )}
//     </div>
//   );
// };

// ============================================================
// TherapistCard.tsx — Displays therapist match in chat flow
// UI CHANGE: Removed fixed max-w-sm, now fluid. Responsive
//            padding and font sizes. Long name/bio handled safely.
// Logic unchanged.
// ============================================================

import React from "react";
import type { Therapist } from "../../types";

interface TherapistCardProps {
  therapist: Therapist;
  matchedSpecialties?: string[];
  onSelect?: (therapist: Therapist) => void;
}

export const TherapistCard: React.FC<TherapistCardProps> = ({
  therapist,
  matchedSpecialties = [],
  onSelect,
}) => {
  console.log("[TherapistCard] render", {
    therapistId: therapist.id,
    name: therapist.name,
  });

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-base sm:text-lg font-bold">
          {therapist.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <h3 className="font-semibold text-slate-800 text-sm sm:text-base break-words leading-snug">
            {therapist.name}
          </h3>

          {/* Specialties */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {therapist.specialties.slice(0, 4).map((spec) => (
              <span
                key={spec}
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                  matchedSpecialties.includes(spec)
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {spec}
              </span>
            ))}
          </div>

          {/* Insurance */}
          {therapist.accepted_insurance.length > 0 && (
            <p className="mt-1.5 text-xs text-slate-500 break-words">
              Accepts:{" "}
              {therapist.accepted_insurance.slice(0, 3).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {therapist.bio && (
        <p className="mt-2.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {therapist.bio}
        </p>
      )}

      {/* Action */}
      {onSelect && (
        <button
          onClick={() => onSelect(therapist)}
          className="mt-3 w-full rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-teal-700 active:bg-teal-800 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1"
        >
          Select {therapist.name.split(" ")[0]}
        </button>
      )}
    </div>
  );
};