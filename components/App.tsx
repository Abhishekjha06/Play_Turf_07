import React, { lazy, Suspense, Profiler } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { toast } from "sonner";

import { Toaster as Sonner } from "@/ui/sonner";
import { TooltipProvider } from "@/ui/tooltip";
import { AuthCallback } from "@/AuthCallback";
import { AdminRoute } from "@/components/AdminRoute";
import { ClientRoute } from "@/components/ClientRoute";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { RealtimeNotificationsProvider } from "@/components/RealtimeNotificationsProvider";
import { LuxuryThemeProvider } from "@/luxury/LuxuryThemeProvider";
import { MultiRoleLoginModal } from "@/components/MultiRoleLoginModal";

const ThemeSelect = lazy(() => import("@/pages/ThemeSelect"));
const Home = lazy(() => import("@/pages/Home"));
const TurfDetail = lazy(() => import("@/pages/TurfDetail"));
const Booking = lazy(() => import("@/pages/Booking"));
const BookingDetail = lazy(() => import("@/pages/BookingDetail"));
const Bookings = lazy(() => import("@/pages/Bookings"));
const Tournaments = lazy(() => import("@/pages/Tournaments"));
const Offers = lazy(() => import("@/pages/Offers"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const AuthCallbackRoute = lazy(() => import("@/pages/AuthCallbackRoute"));
const More = lazy(() => import("@/pages/More"));
const Admin = lazy(() => import("@/pages/Admin"));
const Receipt = lazy(() => import("@/pages/Receipt"));
const ClientLogin = lazy(() => import("@/pages/ClientLogin"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const ClientSlotManagement = lazy(() => import("@/pages/ClientSlotManagement"));
const ClientBookingManagement = lazy(() => import("@/pages/ClientBookingManagement"));
const ClientProfileSettings = lazy(() => import("@/pages/ClientProfileSettings"));
const ClientPlaceholder = lazy(() => import("@/pages/ClientPlaceholder"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[Query Error] ${query.queryKey[0]}:`, error);
      if (query?.meta?.errorMessage) {
        toast.error(query.meta.errorMessage as string);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error(`[Mutation Error]:`, error);
      toast.error(
        (mutation?.meta?.errorMessage as string) || "An unexpected error occurred."
      );
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes stale time for robust caching
      gcTime: 10 * 60 * 1000,   // 10 minutes cache time
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status === 401 || err?.status === 403 || err?.status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function AppLayout() {
  return <Outlet />;
}

function LoadingFallback() {
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg-primary, #000)" }}>
      <div
        className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "rgba(20,184,176,0.3)", borderTopColor: "transparent" }}
        aria-label="Loading"
      />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
        Loading…
      </span>
    </div>
  );
}

export default function App() {
  return (
    <LuxuryThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner position="top-center" theme="dark" />
          <BrowserRouter>
            <AuthCallback>
              <RealtimeNotificationsProvider>
                <Suspense fallback={<LoadingFallback />}>
                  <GlobalErrorBoundary>
                    <MultiRoleLoginModal />
                    <Routes>
                    {/* Public pages inside MobileShell */}
                    <Route element={<AppLayout />}>
                      <Route index element={<Home />} />
                      <Route path="/turf/:id" element={<TurfDetail />} />
                      <Route path="/booking/new/:turfId" element={<Booking />} />
                      <Route path="/booking/:id" element={<BookingDetail />} />
                      <Route path="/bookings" element={<Bookings />} />
                      <Route path="/tournaments" element={<Tournaments />} />
                      <Route path="/offers" element={<Offers />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/auth/callback" element={<AuthCallbackRoute />} />
                      <Route path="/more" element={<More />} />
                      <Route path="/receipt" element={<Receipt />} />
                      <Route path="/theme" element={<ThemeSelect />} />
                      <Route path="/luxury/theme" element={<ThemeSelect />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>

                    {/* Admin */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <Admin />
                        </AdminRoute>
                      }
                    />

                    {/* Client login */}
                    <Route path="/client/login" element={<ClientLogin />} />

                    {/* Client protected pages */}
                    <Route
                      path="/client/dashboard"
                      element={
                        <ClientRoute>
                            {import.meta.env.DEV ? (
                              <Profiler
                                id="ClientDashboard"
                                onRender={(id, phase, actualDuration) => {
                                  console.log(
                                    `[Profiler] ${id} ${phase} took ${actualDuration.toFixed(2)}ms`
                                  );
                                }}
                              >
                                <ClientDashboard />
                              </Profiler>
                            ) : (
                              <ClientDashboard />
                            )}
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/slots"
                      element={
                        <ClientRoute>
                          <ClientSlotManagement />
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/bookings"
                      element={
                        <ClientRoute>
                          <ClientBookingManagement />
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/settings"
                      element={
                        <ClientRoute>
                          <ClientProfileSettings />
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/photos"
                      element={
                        <ClientRoute>
                          <ClientPlaceholder />
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/pricing"
                      element={
                        <ClientRoute>
                          <ClientPlaceholder />
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/turf/edit"
                      element={
                        <ClientRoute>
                          <ClientPlaceholder />
                        </ClientRoute>
                      }
                    />

                    <Route
                      path="/client/rules"
                      element={
                        <ClientRoute>
                          <ClientPlaceholder />
                        </ClientRoute>
                      }
                    />
                    </Routes>
                  </GlobalErrorBoundary>
                </Suspense>
              </RealtimeNotificationsProvider>
            </AuthCallback>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LuxuryThemeProvider>
  );
}
