// // ============================================================
// // AdminPage.tsx — Admin dashboard: stats + tables
// // Auth-gated — redirects to /login if no session
// // ============================================================

// import React, { useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { StatCard } from "../components/admin/StatCard";
// import { InquiryTable } from "../components/admin/InquiryTable";
// import { AppointmentTable } from "../components/admin/AppointmentTable";
// import { Spinner } from "../components/ui/ Spinner";
// import { ErrorBanner } from "../components/ui/ ErrorBanner";
// import { Button } from "../components/ui/Button";
// import { useAuth } from "../hooks/useAuth";
// import { useAdminData } from "../hooks/useAdminData";
// import { logger } from "../lib/logger";

// const CONTEXT = "AdminPage";

// const AdminPage: React.FC = () => {
//   console.log("[AdminPage] render");
//   logger.info(CONTEXT, "AdminPage mounted");

//   const navigate = useNavigate();
//   const { session, isLoading: authLoading, signOut } = useAuth();
//   const {
//     data,
//     isLoading: dataLoading,
//     error,
//     refetch,
//   } = useAdminData(session);

//   // Auth guard — redirect to login if no session
//   useEffect(() => {
//     if (!authLoading && !session) {
//       logger.warn(CONTEXT, "No session — redirecting to login");
//       navigate("/login", { replace: true });
//     }
//   }, [session, authLoading, navigate]);

//   const handleSignOut = async () => {
//     logger.info(CONTEXT, "Sign out clicked");
//     try {
//       await signOut();
//       navigate("/login", { replace: true });
//     } catch (err) {
//       logger.error(CONTEXT, "Sign out failed", err);
//     }
//   };

//   // Show spinner while checking auth
//   if (authLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50">
//         <Spinner size="lg" label="Checking authentication…" />
//       </div>
//     );
//   }

//   // Will redirect via useEffect — show nothing
//   if (!session) return null;

//   return (
//     <div className="min-h-screen bg-slate-50">
//       {/* Top Nav */}
//       <header className="border-b border-slate-200 bg-white shadow-sm">
//         <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white text-sm font-bold">
//               HC
//             </div>
//             <div>
//               <span className="font-bold text-slate-800">HealthSchedule</span>
//               <span className="text-slate-400 text-sm ml-2">Admin</span>
//             </div>
//           </div>
//           <div className="flex items-center gap-3">
//             <span className="text-sm text-slate-500 hidden sm:block">
//               {session.user?.email}
//             </span>
//             <Button
//               variant="secondary"
//               size="sm"
//               onClick={refetch}
//               disabled={dataLoading}
//             >
//               {dataLoading ? "Refreshing…" : "↻ Refresh"}
//             </Button>
//             <Button variant="ghost" size="sm" onClick={handleSignOut}>
//               Sign Out
//             </Button>
//           </div>
//         </div>
//       </header>

//       <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
//         <div>
//           <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
//           <p className="text-slate-500 text-sm mt-1">
//             Overview of patient inquiries and scheduled appointments
//           </p>
//         </div>

//         {/* Error state */}
//         {error && <ErrorBanner message={error} />}

//         {/* Loading state */}
//         {dataLoading && !data && (
//           <div className="flex items-center justify-center py-16">
//             <Spinner size="lg" label="Loading admin data…" />
//           </div>
//         )}

//         {data && (
//           <>
//             {/* Stats row */}
//             <section>
//               <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
//                 Overview
//               </h2>
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//                 <StatCard
//                   label="Total Inquiries"
//                   value={data.stats.totalInquiries}
//                   icon="📋"
//                   color="slate"
//                 />
//                 <StatCard
//                   label="Pending"
//                   value={data.stats.pendingInquiries}
//                   icon="⏳"
//                   color="amber"
//                 />
//                 <StatCard
//                   label="Appointments"
//                   value={data.stats.scheduledAppointments}
//                   icon="📅"
//                   color="teal"
//                 />
//                 <StatCard
//                   label="Therapists"
//                   value={data.stats.totalTherapists}
//                   icon="🩺"
//                   color="blue"
//                 />
//               </div>
//             </section>

//             {/* Inquiries table */}
//             <section>
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-lg font-semibold text-slate-700">
//                   Patient Inquiries
//                   <span className="ml-2 text-sm font-normal text-slate-400">
//                     ({data.inquiries.length})
//                   </span>
//                 </h2>
//               </div>
//               <InquiryTable inquiries={data.inquiries} />
//             </section>

//             {/* Appointments table */}
//             <section>
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-lg font-semibold text-slate-700">
//                   Booked Appointments
//                   <span className="ml-2 text-sm font-normal text-slate-400">
//                     ({data.appointments.length})
//                   </span>
//                 </h2>
//               </div>
//               <AppointmentTable appointments={data.appointments} />
//             </section>
//           </>
//         )}
//       </main>
//     </div>
//   );
// };

// export default AdminPage;

// ============================================================
// AdminPage.tsx — Admin dashboard: stats + tables
// Auth-gated — redirects to /login if no session
// ============================================================

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../components/admin/StatCard";
import { InquiryTable } from "../components/admin/InquiryTable";
import { AppointmentTable } from "../components/admin/AppointmentTable";
import { Spinner } from "../components/ui/ Spinner";
import { ErrorBanner } from "../components/ui/ ErrorBanner";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useAdminData } from "../hooks/useAdminData";
import { logger } from "../lib/logger";

const CONTEXT = "AdminPage";

const AdminPage: React.FC = () => {
  console.log("[AdminPage] render");
  logger.info(CONTEXT, "AdminPage mounted");

  const navigate = useNavigate();
  const { session, isLoading: authLoading, signOut } = useAuth();
  const {
    data,
    isLoading: dataLoading,
    error,
    refetch,
  } = useAdminData(session);

  useEffect(() => {
    if (!authLoading && !session) {
      logger.warn(CONTEXT, "No session — redirecting to login");
      navigate("/login", { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSignOut = async () => {
    logger.info(CONTEXT, "Sign out clicked");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      logger.error(CONTEXT, "Sign out failed", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" label="Checking authentication…" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 rounded-lg bg-teal-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
              HC
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 text-sm sm:text-base">
                HealthSchedule
              </span>
              <span className="text-slate-400 text-xs sm:text-sm ml-1 sm:ml-2">
                Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-xs sm:text-sm text-slate-500 hidden md:block truncate max-w-[160px]">
              {session.user?.email}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={refetch}
              disabled={dataLoading}
            >
              {dataLoading ? "…" : "↻"}
              <span className="hidden sm:inline">
                {dataLoading ? " Refreshing" : " Refresh"}
              </span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Dashboard
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Overview of patient inquiries and scheduled appointments
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        {dataLoading && !data && (
          <div className="flex items-center justify-center py-12 sm:py-16">
            <Spinner size="lg" label="Loading admin data…" />
          </div>
        )}

        {data && (
          <>
            {/* Stats row */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 sm:mb-4">
                Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  label="Total Inquiries"
                  value={data.stats.totalInquiries}
                  icon="📋"
                  color="slate"
                />
                <StatCard
                  label="Pending"
                  value={data.stats.pendingInquiries}
                  icon="⏳"
                  color="amber"
                />
                <StatCard
                  label="Appointments"
                  value={data.stats.scheduledAppointments}
                  icon="📅"
                  color="teal"
                />
                <StatCard
                  label="Therapists"
                  value={data.stats.totalTherapists}
                  icon="🩺"
                  color="blue"
                />
              </div>
            </section>

            {/* Inquiries table */}
            <section>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-slate-700">
                  Patient Inquiries
                  <span className="ml-2 text-xs sm:text-sm font-normal text-slate-400">
                    ({data.inquiries.length})
                  </span>
                </h2>
              </div>
              <InquiryTable inquiries={data.inquiries} />
            </section>

            {/* Appointments table */}
            <section>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-slate-700">
                  Booked Appointments
                  <span className="ml-2 text-xs sm:text-sm font-normal text-slate-400">
                    ({data.appointments.length})
                  </span>
                </h2>
              </div>
              <AppointmentTable appointments={data.appointments} />
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
