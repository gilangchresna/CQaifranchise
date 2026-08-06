import React, { useState, useEffect } from "react";
import { Role } from "@/src/types";
import { 
  ShieldCheck, 
  UserPlus, 
  MoreVertical, 
  CheckCircle2, 
  XCircle,
  Search,
  Loader2
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { callEdgeFunction } from "@/src/lib/supabase";

interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  outlet_id?: number;
  status?: string;
  is_active: boolean;
  created_at: string;
}

interface AccessManagementProps {
  activeRole: Role;
}

export function AccessManagement({ activeRole }: AccessManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callEdgeFunction('users-list', undefined, { method: 'GET' });
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(result.users || []);
      }
    } catch (err) {
      setError('Failed to load users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeRole !== "Franchisee") {
      fetchUsers();
    }
  }, [activeRole]);

  if (activeRole === "Franchisee") {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <ShieldCheck className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          You do not have permission to view or manage platform access. Please contact your Regional Manager if you require assistance.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Map role to display format
  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'HQ_ADMIN': return 'HQ';
      case 'REGIONAL_MANAGER': return 'Regional';
      case 'FRANCHISEE_OWNER': return 'Franchisee';
      default: return role;
    }
  };

  // Map status
  const getStatusDisplay = (user: UserProfile) => {
    if (user.is_active === false || user.status === 'suspended') {
      return { label: 'Suspended', isActive: false };
    }
    return { label: 'Active', isActive: true };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User Access Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage roles, permissions, and platform access</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchUsers}
            className="rounded-md px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all flex items-center gap-2"
          >
            Refresh
          </button>
          <button className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm">
            <UserPlus className="w-4 h-4" /> Add New User
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
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
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
              <option value="all">All Roles</option>
              <option value="HQ_ADMIN">HQ</option>
              <option value="REGIONAL_MANAGER">Regional</option>
              <option value="FRANCHISEE_OWNER">Franchisee</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-500">Loading users...</span>
          </div>
        )}

        {error && (
          <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
            <button 
              onClick={fetchUsers}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">System Role</th>
                  <th className="px-6 py-4 font-semibold">Access Scope</th>
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
                            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider border",
                          roleDisplay === 'HQ' ? "bg-purple-50 text-purple-700 border-purple-200" :
                          roleDisplay === 'Regional' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-green-50 text-green-700 border-green-200"
                        )}>
                          {roleDisplay}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        {user.outlet_id ? `Outlet: ${user.outlet_id}` : 'Global'}
                      </td>
                      <td className="px-6 py-4">
                        {statusDisplay.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-xs font-medium text-red-700">
                            <XCircle className="w-3 h-3" /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                      {searchQuery ? `No users found matching "${searchQuery}"` : 'No users found. Run the seed-data function to populate user profiles.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
