// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { currentUser, loading } = useAuth();

  // Still checking auth state — don't redirect yet
  if (loading) return null; // or a loading spinner

  // Not logged in — send to sign in
  if (!currentUser) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;