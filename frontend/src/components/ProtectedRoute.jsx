// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAccessTokenExpired, getAccessToken } from "../utils/tokenUtils";

export default function ProtectedRoute({ redirectTo = "/login" }) {
  const token = getAccessToken();
  // token null or expired -> redirect
  if (!token || isAccessTokenExpired(token)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Outlet />;
}
