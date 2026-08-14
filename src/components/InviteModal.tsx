import React, { useState, useEffect } from 'react';
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface Region {
  id: number;
  name: string;
}

interface InviteModalProps {
  onClose: () => void;
  onInviteSent: () => void;
}

const ROLE_OPTIONS = [
  { value: 'HQ_ADMIN', label: 'HQ Admin', description: 'Full platform access' },
  { value: 'REGIONAL_MANAGER', label: 'Regional Manager', description: 'Regional oversight' },
  { value: 'FRANCHISEE_OWNER', label: 'Franchisee Owner', description: 'Franchise operations' },
  { value: 'FRANCHISEE_STAFF', label: 'Franchisee Staff', description: 'Outlet-level access' },
];

export function InviteModal({ onClose, onInviteSent }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('FRANCHISEE_OWNER');
  const [regionId, setRegionId] = useState<number | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch regions for REGIONAL_MANAGER role
  useEffect(() => {
    const fetchRegions = async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');

      if (!error && data) {
        setRegions(data);
      }
    };
    fetchRegions();
  }, []);

  const handleInvite = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Call Supabase built-in invite (sends email)
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        email.trim(),
        {
          data: {
            role,
            region_id: regionId,
          },
        }
      );

      if (inviteError) {
        throw inviteError;
      }

      // Step 2: Insert into user_invites table (for tracking)
      const { error: insertError } = await supabase.from('user_invites').insert({
        email: email.trim(),
        role,
        region_id: regionId,
        invite_token: crypto.randomUUID(),
        invited_by: (await supabase.auth.getUser()).data.user?.id,
        status: 'pending',
      });

      if (insertError) {
        console.warn('Invite tracked with error (non-fatal):', insertError.message);
        // Non-fatal - invite was sent even if tracking failed
      }

      setSuccess(true);
      setTimeout(() => {
        onInviteSent();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Invite error:', err);
      setError(err.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  const showRegionField = role === 'REGIONAL_MANAGER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Invite New User</h2>
              <p className="text-xs text-slate-500">Send an email invitation</p>
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
        <div className="p-6 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="h-14 w-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-slate-900">Invite sent successfully!</p>
              <p className="text-xs text-slate-500">An email has been sent to {email}</p>
            </div>
          ) : (
            <>
              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">System Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        role === option.value
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className={`text-xs font-medium ${role === option.value ? 'text-blue-700' : 'text-slate-700'}`}>
                        {option.label}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Region Field (conditional) */}
              {showRegionField && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={regionId ?? ''}
                    onChange={(e) => setRegionId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  >
                    <option value="">Select a region</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Regional Managers must be assigned to a region
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInvite}
              disabled={loading || !email.trim()}
              className="h-9 px-5 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Send Invite
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
