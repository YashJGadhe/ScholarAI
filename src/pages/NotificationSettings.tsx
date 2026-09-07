/* ScholarAI — notification preferences page */

import { useEffect, useState } from "react";
import { fetchPreferences, updatePreferences } from "../lib/notifications";
import { PageHeader, Spinner, useToast } from "../components/ui";
import { IcCheck } from "../components/icons";

const PREF_LABELS: Record<string, string> = {
  new_publication: "New publication detected",
  scopus_indexed: "Paper indexed in Scopus",
  wos_indexed: "Paper indexed in Web of Science",
  google_scholar_indexed: "Paper indexed in Google Scholar",
  orcid_publication: "New ORCID publication",
  citation_update: "Citation count changes",
  h_index_change: "H-index changes",
  i10_index_change: "i10-index changes",
  profile_update: "Profile updates",
  data_collection_error: "Data collection errors",
  api_error: "API errors",
  api_rate_limit: "API rate limit warnings",
  identity_warning: "Identity verification warnings",
  system_alert: "System alerts",
};

export default function NotificationSettings() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences()
      .then(setPrefs)
      .catch(() => toast("error", "Failed to load preferences."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      await updatePreferences(prefs);
      toast("success", "Preferences saved.");
    } catch {
      toast("error", "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <div>
        <PageHeader title="Notification Preferences" sub="Choose which alerts you want to receive" />
        <div className="card p-8 text-center text-ink-400"><Spinner /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notification Preferences"
        sub="Choose which alerts you want to receive. Disabling a category stops delivery but does not stop data collection."
        actions={
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner light /> : <IcCheck size={16} />} Save preferences
          </button>
        }
      />

      <div className="card p-6">
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(PREF_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-ink-100 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[key] !== false}
                onChange={() => toggle(key)}
                className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span className="text-[13px] font-medium text-ink-700">{label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-400 mt-4 leading-relaxed">
          Preferences apply to in-app notifications. Email delivery (if enabled by the administrator) is controlled separately.
        </p>
      </div>
    </div>
  );
}
