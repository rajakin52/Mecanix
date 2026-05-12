'use client';

import { useEffect, useState } from 'react';
import { Button, useToast } from '@mecanix/ui-web';
import { api } from '@/lib/api';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

interface TenantSettings {
  materials_rate_refinish?: number | string | null;
  materials_rate_body?: number | string | null;
  shop_supplies_pct?: number | string | null;
  shop_supplies_cap?: number | string | null;
}

export default function MaterialsRatesPage() {
  const toast = useToast();
  const [refinish, setRefinish] = useState('');
  const [body, setBody] = useState('');
  const [suppliesPct, setSuppliesPct] = useState('');
  const [suppliesCap, setSuppliesCap] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ settings: TenantSettings }>('/tenants/me')
      .then((data) => {
        const s = data.settings ?? {};
        setRefinish(s.materials_rate_refinish != null ? String(s.materials_rate_refinish) : '');
        setBody(s.materials_rate_body != null ? String(s.materials_rate_body) : '');
        // shop_supplies_pct stored as decimal (0.05 = 5%) — show as percentage for the form
        setSuppliesPct(s.shop_supplies_pct != null ? String(Number(s.shop_supplies_pct) * 100) : '');
        setSuppliesCap(s.shop_supplies_cap != null ? String(s.shop_supplies_cap) : '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const writes: Array<Promise<unknown>> = [
        api.put('/tenants/me/settings/materials_rate_refinish', { value: refinish === '' ? null : Number(refinish) }),
        api.put('/tenants/me/settings/materials_rate_body', { value: body === '' ? null : Number(body) }),
        api.put('/tenants/me/settings/shop_supplies_pct', { value: suppliesPct === '' ? null : Number(suppliesPct) / 100 }),
        api.put('/tenants/me/settings/shop_supplies_cap', { value: suppliesCap === '' ? null : Number(suppliesCap) }),
      ];
      await Promise.all(writes);
      toast.success('Materials rates saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SettingsPageHeader
        eyebrow="Financial"
        title="Materials rates"
        description="Body-shop materials charge defaults. These rates auto-calculate paint, hardener, abrasives, polish and shop-supplies recovery from labour totals on every job card. Per-insurance and per-customer overrides take precedence over these defaults."
      />

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <SettingsSection
            title="Body shop"
            description="Per-labour-hour materials charge for refinish and body-repair work. Refinish covers paint booth consumables; body covers sandpaper, filler, masking, weld-through primer."
          >
            <SettingsField
              label="Refinish materials rate"
              hint="Per refinish labour hour. Industry typical: 20-50% of the refinish labour rate. Insurance companies in AO/MZ usually dictate this."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={refinish}
                  onChange={(e) => setRefinish(e.target.value)}
                  placeholder="e.g. 25.00"
                  className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">per refinish hour</span>
              </div>
            </SettingsField>

            <SettingsField
              label="Body materials rate"
              hint="Per body-repair labour hour. Lower than refinish — covers sandpaper, body filler, masking."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. 12.00"
                  className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">per body-repair hour</span>
              </div>
            </SettingsField>
          </SettingsSection>

          <SettingsSection
            title="Shop supplies (mechanical work)"
            description="Percentage of mechanical labour applied as a flat 'shop supplies' line on the invoice — covers rags, brake cleaner, gloves, zip ties, small fasteners. Capped to avoid runaway numbers on large jobs."
          >
            <SettingsField
              label="Percentage"
              hint="Typical workshop rate: 3-8%. Enter as a percentage (e.g. 5 = 5%)."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={suppliesPct}
                  onChange={(e) => setSuppliesPct(e.target.value)}
                  placeholder="5"
                  className="block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">% of mechanical labour</span>
              </div>
            </SettingsField>

            <SettingsField
              label="Cap"
              hint="Maximum shop-supplies charge per job. Leave empty for no cap."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={suppliesCap}
                  onChange={(e) => setSuppliesCap(e.target.value)}
                  placeholder="e.g. 50.00"
                  className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">max per job</span>
              </div>
            </SettingsField>
          </SettingsSection>

          {error && <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <SettingsFooter>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save rates'}
            </Button>
          </SettingsFooter>
        </>
      )}
    </div>
  );
}
