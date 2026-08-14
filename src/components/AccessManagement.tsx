import React, { useState, useEffect } from "react";
import { Role } from "@/src/types";
import {
  ShieldCheck,
  UserPlus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  Edit2,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { InviteModal } from "./InviteModal";
import { OutletAssignment } from "./OutletAssignment";

interface Region {
  id: number;
  name: string;
}

interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  region_id?: number;
  region_name?: string;
  status?: string;
  is_active: boolean;
  created_at: string;
}

interface AccessManagementProps {
  activeRole: Role;
}

const DB_ROLE_OPTIONS = [
  { value: "HQ_ADMIN", label: "HQ Admin" },
  { value: "REGIONAL_MANAGER", label: "Regional Manager" },
  { value: "FRANCHISEE_OWNER", label: "Franchisee Owner" },
  { value: "FRANCHISEE_STAFF", label: "Franchisee Staff" },
];

export function AccessManagement({ activeRole }: AccessManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [assigningUser, setAssigningUser] = useState<UserProfile | null>(null);

  // Edit modal state
  const [editRole, setEditRole] = useState("");
  const [editRegionId, setEditRegionId] = useState<number | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Role filter
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use PostgREST directly — no edge function needed
      const { data, error: fetchError } = await supabase
        .from("user_profiles")
        .select(
          `
          id,
          email,
          full_name,
          role,
          region_id,
          is_active,
          created_at,
          region:regions(name)
        `
        )
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const normalized = (data || []).map((u: any) => ({
        ...u,
        region_name: u.region?.name,
      }));
      setUsers(normalized);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeRole !== "Franchisee") {
      fetchUsers();
    }
  }, [activeRole]);

  // Load regions for edit modal
  useEffect(() => {
    if (editingUser) {
      const fetchRegions = async () => {
        const { data } = await supabase
          .from("regions")
          .select("id, name")
          .order("name");
        if (data) setRegions(data);
      };
      fetchRegions();
    }
  }, [editingUser]);

  // ----- Edit User -----
  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditRegionId(user.region_id ?? null);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          role: editRole,
          region_id: editRegionId,
        })
        .eq("id", editingUser.id);

      if (updateError) throw updateError;

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                role: editRole,
                region_id: editRegionId ?? undefined,
                region_name: regions.find((r) => r.id === editRegionId)?.name,
              }
            : u
        )
      );
      setEditingUser(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to update user");
    } finally {
      setEditLoading(false);
    }
  };

  if (activeRole === "Franchisee") {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <ShieldCheck className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          You do not have permission to view or manage platform access. Please contact your
          Regional Manager if you require assistance.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "HQ_ADMIN":
        return "HQ";
      case "REGIONAL_MANAGER":
        return "Regional";
      case "FRANCHISEE_OWNER":
        return "Franchisee";
      case "FRANCHISEE_STAFF":
        return "Staff";
      default:
        return role;
    }
  };

  const getStatusDisplay = (user: UserProfile) => {
    if (user.is_active === false || user.status === "suspended") {
      return { label: "Suspended", isActive: false };
    }
    return { label: "Active", isActive: true };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User Access Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage roles, permissions, and platform access
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="rounded-md px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all flex items-center gap-2"
          >
            <Loader2 className={cn("w-3 h-3", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-64 rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="HQ_ADMIN">HQ</option>
              <option value="REGIONAL_MANAGER">Regional</option>
              <option value="FRANCHISEE_OWNER">Franchisee</option>
              <option value="FRANCHISEE_STAFF">Staff</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-500">Loading users...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchUsers} className="mt-2 text-xs text-red-600 hover:text-red-800 underline">
              Try again
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">System Role</th>
                  <th className="px-6 py-4 font-semibold">Region</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const roleDisplay = getRoleDisplay(user.role);
                  const statusDisplay = getStatusDisplay(user);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                            {user.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider border",
                            roleDisplay === "HQ"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : roleDisplay === "Regional"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-green-50 text-green-700 border-green-200"
                          )}
                        >
                          {roleDisplay}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {user.region_name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {statusDisplay.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-xs font-medium text-red-700">
                            <XCircle className="w-3 h-3" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Role */}
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors"
                            title="Edit user role/region"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {/* Assign Outlets */}
                          {(user.role === "FRANCHISEE_OWNER" ||
                            user.role === "FRANCHISEE_STAFF") && (
                            <button
                              onClick={() => setAssigningUser(user)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-green-600 rounded transition-colors"
                              title="Assign outlets"
                            >
                              <Store className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                      {searchQuery || roleFilter !== "all"
                        ? `No users found matching your filters`
                        : "No users found. Click 'Add New User' to invite the first user."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInviteSent={fetchUsers}
        />
      )}

      {editingUser && (
        /* Edit User Modal */
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Edit User</h2>
                  <p className="text-xs text-slate-500 truncate max-w-[180px]">{editingUser.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Current info */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-900">{editingUser.email}</p>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">System Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                >
                  {DB_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Region</label>
                <select
                  value={editRegionId ?? ""}
                  onChange={(e) => setEditRegionId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                >
                  <option value="">No region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Leave empty for HQ Admins with global access.</p>
              </div>

              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700">{editError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="h-9 px-5 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningUser && (
        <OutletAssignment
          user={assigningUser}
          onClose={() => setAssigningUser(null)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
}
