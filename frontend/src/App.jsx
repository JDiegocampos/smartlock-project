// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterLock from "./pages/RegisterLock";
import Dashboard from "./pages/Dashboard";
import LocksList from "./pages/LocksList";
import LockDetail from "./pages/LockDetail";
import PinsPage from "./pages/PinsPage";
import DevicesPage from "./pages/DevicesPage";
import AccessLogsPage from "./pages/AccessLogsPage";
import LockUsers from "./pages/LockUsers";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-lock" element={<RegisterLock />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/locks" element={<LocksList />} />
          <Route path="/locks/:uuid" element={<LockDetail />} />
          <Route path="/locks/:uuid/users" element={<LockUsers />} />
          <Route path="/pins" element={<PinsPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/accesslogs" element={<AccessLogsPage />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </div>
  );
}
