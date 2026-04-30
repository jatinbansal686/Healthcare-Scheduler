// // ============================================================
// // LoginPage.tsx — Admin login with Supabase email/password auth
// // ============================================================

// import React, { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { Button } from "../components/ui/Button";
// import { ErrorBanner } from "../components/ui/ ErrorBanner";
// import { useAuth } from "../hooks/useAuth";
// import { logger } from "../lib/logger";

// const CONTEXT = "LoginPage";

// const LoginPage: React.FC = () => {
//   console.log("[LoginPage] render");
//   logger.info(CONTEXT, "LoginPage mounted");

//   const navigate = useNavigate();
//   const { session, signIn, isLoading, error } = useAuth();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [localError, setLocalError] = useState<string | null>(null);

//   // Redirect if already authenticated
//   useEffect(() => {
//     if (session) {
//       logger.info(CONTEXT, "Already authenticated — redirecting to admin");
//       navigate("/admin", { replace: true });
//     }
//   }, [session, navigate]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     logger.info(CONTEXT, "Login form submitted", { email });
//     setLocalError(null);

//     if (!email.trim() || !password.trim()) {
//       setLocalError("Email and password are required.");
//       return;
//     }

//     try {
//       await signIn(email.trim(), password);
//       logger.info(CONTEXT, "Login successful — navigating to admin");
//       navigate("/admin", { replace: true });
//     } catch (err) {
//       logger.error(CONTEXT, "Login failed", err);
//       setLocalError(error ?? "Login failed. Please check your credentials.");
//     }
//   };

//   const displayError = localError ?? error;

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 px-4">
//       <div className="w-full max-w-md">
//         {/* Logo */}
//         <div className="text-center mb-8">
//           <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white text-2xl font-bold mb-4">
//             HC
//           </div>
//           <h1 className="text-2xl font-bold text-slate-800">Admin Portal</h1>
//           <p className="text-slate-500 text-sm mt-1">
//             HealthSchedule Dashboard
//           </p>
//         </div>

//         {/* Card */}
//         <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-8">
//           <h2 className="text-lg font-semibold text-slate-700 mb-6">
//             Sign in to continue
//           </h2>

//           <ErrorBanner
//             message={displayError}
//             onDismiss={() => setLocalError(null)}
//           />

//           <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
//             <div>
//               <label
//                 htmlFor="email"
//                 className="block text-sm font-medium text-slate-700 mb-1"
//               >
//                 Email address
//               </label>
//               <input
//                 id="email"
//                 type="email"
//                 autoComplete="email"
//                 required
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-colors"
//                 placeholder="admin@example.com"
//               />
//             </div>

//             <div>
//               <label
//                 htmlFor="password"
//                 className="block text-sm font-medium text-slate-700 mb-1"
//               >
//                 Password
//               </label>
//               <input
//                 id="password"
//                 type="password"
//                 autoComplete="current-password"
//                 required
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-colors"
//                 placeholder="••••••••"
//               />
//             </div>

//             <Button
//               type="submit"
//               isLoading={isLoading}
//               className="w-full mt-2"
//               size="lg"
//             >
//               Sign In
//             </Button>
//           </form>
//         </div>

//         <p className="text-center text-xs text-slate-400 mt-6">
//           Patient?{" "}
//           <a href="/" className="text-teal-600 hover:underline">
//             Use the chat →
//           </a>
//         </p>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;

// ============================================================
// LoginPage.tsx — Admin login with Supabase email/password auth
// ============================================================

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/ ErrorBanner";
import { useAuth } from "../hooks/useAuth";
import { logger } from "../lib/logger";

const CONTEXT = "LoginPage";

const LoginPage: React.FC = () => {
  console.log("[LoginPage] render");
  logger.info(CONTEXT, "LoginPage mounted");

  const navigate = useNavigate();
  const { session, signIn, isLoading, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      logger.info(CONTEXT, "Already authenticated — redirecting to admin");
      navigate("/admin", { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info(CONTEXT, "Login form submitted", { email });
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Email and password are required.");
      return;
    }

    try {
      await signIn(email.trim(), password);
      logger.info(CONTEXT, "Login successful — navigating to admin");
      navigate("/admin", { replace: true });
    } catch (err) {
      logger.error(CONTEXT, "Login failed", err);
      setLocalError(error ?? "Login failed. Please check your credentials.");
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 px-4 py-8 sm:py-0">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-600 text-white text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
            HC
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Admin Portal
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            HealthSchedule Dashboard
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 sm:p-8">
          <h2 className="text-base sm:text-lg font-semibold text-slate-700 mb-5 sm:mb-6">
            Sign in to continue
          </h2>

          <ErrorBanner
            message={displayError}
            onDismiss={() => setLocalError(null)}
          />

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-colors"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2"
              size="lg"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5 sm:mt-6">
          Patient?{" "}
          <a href="/" className="text-teal-600 hover:underline">
            Use the chat →
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
