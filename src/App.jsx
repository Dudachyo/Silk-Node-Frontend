import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import GraphPage from "./pages/GraphPage";
import SettingsPage from "./pages/SettingsPage";
import { useAuth } from "./context/AuthContext";
import DataStatus from "./components/DataStatus";

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#161618",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#84848c",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
      }}
    >
      Загрузка…
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, sessionError, checkSession } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (sessionError) return <DataStatus error={sessionError} onRetry={() => checkSession().catch(() => {})} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Keeps an already-logged-in person off /login and /register — bounces them
// straight to /home instead of showing the auth form again.
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  return children;
}

// "/" is public regardless of auth state. "/login" and "/register" are
// public-only (see PublicOnlyRoute above). Everything else is the logged-in
// app shell, guarded by ProtectedRoute against the real session from AuthContext.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/graph"
          element={
            <ProtectedRoute>
              <GraphPage />
            </ProtectedRoute>
          }
        />
        <Route path="/favorites" element={<Navigate to="/graph" replace />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
