import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import GIVTDashboard from "./GIVTDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PeerReviewPage from "./pages/PeerReviewPage";

function DashboardWrapper() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Admins get the administration console rather than the agent workspace.
  if (user?.role === "Admin") return <Navigate to="/admin" replace />;
  const handleLogout = () => {
    logout();
    navigate("/");
  };
  return <GIVTDashboard authUser={user} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/verify/:token" element={<AuthPage />} />
          {/* The password-reset email links here. Without this route the link
              fell through to the "*" catch-all and silently went to "/". */}
          <Route path="/auth/reset/:token" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["Admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/peer-review"
            element={
              <ProtectedRoute roles={["Student"]}>
                <PeerReviewPage />
              </ProtectedRoute>
            }
          />
          {/* catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
