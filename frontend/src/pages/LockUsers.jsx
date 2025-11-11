// src/pages/LockUsers.jsx
import React, { useEffect, useState } from "react";
import { listUsers, getRoles, assignUserRole, listUserRoles, updateUserRole, deleteUserRole } from "../api/users";

export default function LockUsers({ lock }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // --- Helpers robustos para llamadas a la API (adapta a diferentes wrappers) ---
  const safeListUsers = async (q) => {
    // intentamos distintas firmas: listUsers({ search }), listUsers({ params: { search } }), listUsers(search)
    try { return await listUsers({ search: q }); } catch (e1) {}
    try { return await listUsers({ params: { search: q } }); } catch (e2) {}
    try { return await listUsers(q); } catch (e3) { throw e3; }
  };

  const safeListUserRoles = async (params) => {
    try { return await listUserRoles(params); } catch (e1) {}
    try { return await listUserRoles({ params }); } catch (e2) { throw e2; }
  };

  // --- load roles ---
  useEffect(() => {
    let mounted = true;
    const loadRoles = async () => {
      try {
        const r = await getRoles();
        if (!mounted) return;
        setRoles(r.data || []);
      } catch (e) {
        console.error("Error loading roles", e);
        setRoles([]);
      }
    };
    loadRoles();
    return () => { mounted = false; };
  }, []);

  // --- search users (debounced) ---
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search) { setUsers([]); return; }
      try {
        const res = await safeListUsers(search);
        setUsers(res?.data ?? []);
      } catch (e) {
        console.error("Error fetching users (safeListUsers)", e);
        setUsers([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // --- load userRoles for lock (group by user) ---
  useEffect(() => {
    let mounted = true;
    const loadUserRoles = async () => {
      if (!lock?.id) {
        setUserRoles([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await safeListUserRoles({ lock: lock.id });
        const items = res?.data ?? [];
        // Agrupar por user id (puede venir como 'user' number o como user_detail.id)
        const map = new Map();
        for (const ur of items) {
          const uid = ur.user ?? ur.user_detail?.id;
          if (!uid) continue;
          if (!map.has(uid)) {
            map.set(uid, ur);
          } else {
            // si ya existe, preferimos mantener el primer registro (evitar duplicados)
          }
        }
        if (mounted) setUserRoles(Array.from(map.values()));
      } catch (e) {
        console.error("Error loading user roles", e);
        setUserRoles([]);
        setError("Error cargando usuarios asignados.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadUserRoles();
    return () => { mounted = false; };
  }, [lock]);

  // --- assign or update ---
  const handleAssign = async () => {
    if (!selectedUser || !selectedRole || !lock?.id) return;
    setBusy(true);
    setError(null);

    try {
      // comprobar existencia por id
      const existing = userRoles.find((ur) => {
        const uid = ur.user ?? ur.user_detail?.id;
        return uid === selectedUser.id;
      });

      if (existing) {
        // PATCH
        await updateUserRole(existing.id, { role: selectedRole.id });
      } else {
        // POST
        await assignUserRole({ user: selectedUser.id, role: selectedRole.id, lock: lock.id });
      }

      // recargar la lista de userRoles
      const res = await safeListUserRoles({ lock: lock.id });
      const items = res?.data ?? [];
      const map = new Map();
      for (const ur of items) {
        const uid = ur.user ?? ur.user_detail?.id;
        if (!uid) continue;
        if (!map.has(uid)) map.set(uid, ur);
      }
      setUserRoles(Array.from(map.values()));
      setSelectedUser(null);
      setSelectedRole(null);
    } catch (e) {
      console.error("assign error", e);
      setError(e.response?.data || e.message || "Error al asignar rol.");
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (urId, newRoleId) => {
    setError(null);
    try {
      await updateUserRole(urId, { role: newRoleId });
      // refresh
      const res = await safeListUserRoles({ lock: lock.id });
      const items = res?.data ?? [];
      const map = new Map();
      for (const ur of items) {
        const uid = ur.user ?? ur.user_detail?.id;
        if (!uid) continue;
        if (!map.has(uid)) map.set(uid, ur);
      }
      setUserRoles(Array.from(map.values()));
    } catch (e) {
      console.error("handleRoleChange error", e);
      setError("No se pudo actualizar rol.");
    }
  };

  const handleRemove = async (urId) => {
    if (!confirm("Quitar usuario de esta cerradura?")) return;
    try {
      await deleteUserRole(urId);
      // recargar lista
      const res = await safeListUserRoles({ lock: lock.id });
      const items = res?.data ?? [];
      const map = new Map();
      for (const ur of items) {
        const uid = ur.user ?? ur.user_detail?.id;
        if (!uid) continue;
        if (!map.has(uid)) map.set(uid, ur);
      }
      setUserRoles(Array.from(map.values()));
    } catch (e) {
      console.error("remove error", e);
      setError("No se pudo eliminar la asignación.");
    }
  };

  // --- small debug helpers ---
  useEffect(() => {
    console.log("LockUsers mounted; lock:", lock, "userRoles:", userRoles);
  }, [lock, userRoles]);

  return (
    <div>
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar usuarios por nombre o email"
          className="w-full p-2 border rounded"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded max-h-96 overflow-auto">
          <h4 className="font-semibold mb-2">Resultados</h4>
          {users.length === 0 && <div className="text-sm text-gray-500">No hay resultados</div>}
          {users.map((u) => (
            <div
              key={u.id}
              className={`p-2 rounded cursor-pointer ${selectedUser?.id === u.id ? "bg-white border" : "bg-white/50"}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="font-medium">{u.username} <span className="text-xs text-gray-500">#{u.id}</span></div>
              <div className="text-xs text-gray-600">{u.email}</div>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-semibold mb-2">Roles</h4>
          {roles.map((r) => (
            <div
              key={r.id}
              className={`p-2 rounded cursor-pointer ${selectedRole?.id === r.id ? "bg-white border" : "bg-white/50"}`}
              onClick={() => setSelectedRole(r)}
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-600">{r.description}</div>
            </div>
          ))}

          <div className="mt-3">
            <button
              onClick={handleAssign}
              disabled={!selectedUser || !selectedRole || busy}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              {busy ? "Procesando..." : "Asignar rol"}
            </button>
            {error && <div className="text-red-600 mt-2">{JSON.stringify(error)}</div>}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold mb-2">Usuarios asignados</h4>
        <div className="space-y-2">
          {loading && <p className="text-sm text-gray-600">Cargando...</p>}
          {!loading && userRoles.length === 0 && <p className="text-sm text-gray-600">No hay usuarios asociados.</p>}
          {userRoles.map((ur) => {
            const uid = ur.user ?? ur.user_detail?.id;
            const username = ur.user_detail?.username ?? ur.user?.username ?? `Usuario ${uid}`;
            const email = ur.user_detail?.email ?? "";
            const currentRoleId = ur.role ?? ur.role_detail?.id ?? "";
            return (
              <div key={ur.id} className="p-2 bg-white rounded border flex items-center justify-between">
                <div>
                  <div className="font-medium">{username}</div>
                  <div className="text-xs text-gray-600">{email}</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500 mr-2">Rol:</div>
                  <select
                    value={currentRoleId}
                    onChange={(e) => handleRoleChange(ur.id, Number(e.target.value))}
                    className="border px-2 py-1 rounded text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button onClick={() => handleRemove(ur.id)} className="px-2 py-1 bg-red-500 text-white rounded text-sm">Quitar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
