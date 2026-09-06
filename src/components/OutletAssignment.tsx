import React, { useState, useEffect } from 'react';
import { X, Store, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface Outlet {
  id: number;
  name: string;
  region_name?: string;
}

interface AssignedUser {
  id: number;
  email: string;
  full_name: string;
}

interface OutletAssignmentProps {
  user: AssignedUser;
  onClose: () => void;
  onSaved: () => void;
}

export function OutletAssignment({ user, onClose, onSaved }: OutletAssignmentProps) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlets, setSelectedOutlets] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch all outlets and current assignments
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch all outlets (join region for display)
      const { data: outletsData, error: outletsError } = await supabase
        .from('outlets')
        .select('id, name, region:regions(name)')
        .order('name');

      if (outletsError) {
        setError(outletsError.message);
        setLoading(false);
        return;
      }

      // Fetch user's current outlet assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('user_outlets')
        .select('outlet_id')
        .eq('user_id', user.id);

      if (assignmentsError) {
        setError(assignmentsError.message);
        setLoading(false);
        return;
      }

      const normalizedOutlets = (outletsData || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        region_name: o.region?.name,
      }));

      setOutlets(normalizedOutlets);
      setSelectedOutlets(new Set((assignmentsData || []).map((a) => a.outlet_id)));
      setLoading(false);
    };

    fetchData();
  }, [user.id]);

  const toggleOutlet = (outletId: number) => {
    setSelectedOutlets((prev) => {
      const next = new Set(prev);
      if (next.has(outletId)) {
        next.delete(outletId);
      } else {
        next.add(outletId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Get current assignments
      const { data: currentAssignments } = await supabase
        .from('user_outlets')
        .select('outlet_id')
        .eq('user_id', user.id);

      const currentIds = new Set((currentAssignments || []).map((a) => a.outlet_id));
      const newIds = selectedOutlets;

      // Compute diff
      const toInsert = [...newIds].filter((id) => !currentIds.has(id));
      const toDelete = [...currentIds].filter((id) => !newIds.has(id));

      // Delete removed assignments
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_outlets')
          .delete()
          .eq('user_id', user.id)
          .in('outlet_id', toDelete);

        if (deleteError) throw deleteError;
      }

      // Insert new assignments
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('user_outlets').insert(
          toInsert.map((outlet_id) => ({
            user_id: user.id,
            outlet_id,
          }))
        );

        if (insertError) throw insertError;
      }

      setSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to save outlet assignments');
    } finally {
      setSaving(false);
    }
  };

  // Group outlets by region for display
  const groupedOutlets = outlets.reduce<Record<string, Outlet[]>>((acc, outlet) => {
    const region = outlet.region_name || 'Unknown Region';
    if (!acc[region]) acc[region] = [];
    acc[region].push(outlet);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Assign Outlets</h2>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                {user.full_name} &lt;{user.email}&gt;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="h-14 w-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-slate-900">Outlets assigned successfully!</p>
              <p className="text-xs text-slate-500">
                {selectedOutlets.size} outlet{selectedOutlets.size !== 1 ? 's' : ''} assigned
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading outlets...</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4">
                Select the outlets this user can access. Their access scope will update immediately.
              </p>

              {outlets.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No outlets available.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedOutlets).map(([region, regionOutlets]: [string, Outlet[]]) => (
                    <div key={region}>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                        {region}
                      </p>
                      <div className="space-y-1">
                        {regionOutlets.map((outlet) => {
                          const isSelected = selectedOutlets.has(outlet.id);
                          return (
                            <label
                              key={outlet.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOutlet(outlet.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                  {outlet.name}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected count */}
              {selectedOutlets.size > 0 && (
                <p className="text-xs text-slate-500 mt-4 text-right">
                  {selectedOutlets.size} outlet{selectedOutlets.size !== 1 ? 's' : ''} selected
                </p>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mt-4">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && !loading && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Assignments'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
