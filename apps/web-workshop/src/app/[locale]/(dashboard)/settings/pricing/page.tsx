'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../parts/inventory-tabs';
import {
  usePricingSettings,
  useUpdatePricingSettings,
  usePriceGroups,
  useCreatePriceGroup,
  useUpdatePriceGroup,
  useDeletePriceGroup,
  useAddPriceGroupRule,
  useDeletePriceGroupRule,
  useCopyGroupRules,
  useBulkUpdateCategoryMarkup,
  useBulkRecalculateSellPrices,
  usePriceListPreview,
} from '@/hooks/use-pricing';
import { downloadXlsx } from '@/lib/csv';
import { useCatalogCategories } from '@/hooks/use-catalog';
import { useToast } from '@mecanix/ui-web';
import { SettingsPageHeader } from '@/components/settings/SettingsPrimitives';
import { LoyaltySection } from '@/components/settings/LoyaltySection';

function safe(val: unknown): number {
  return typeof val === 'number' ? val : Number(val) || 0;
}

export default function PricingSettingsPage() {
  const tc = useTranslations('common');
  const ts = useTranslations('settings');
  const tpg = useTranslations('settingsPricing');

  // Settings
  const { data: settings, isLoading: loadingSettings } = usePricingSettings();
  const updateSettings = useUpdatePricingSettings();

  // Price Groups
  const { data: groups, isLoading: loadingGroups } = usePriceGroups();
  const createGroup = useCreatePriceGroup();
  const updateGroup = useUpdatePriceGroup();
  const deleteGroup = useDeletePriceGroup();
  const addRule = useAddPriceGroupRule();
  const deleteRule = useDeletePriceGroupRule();
  const copyRules = useCopyGroupRules();
  const bulkUpdateCategory = useBulkUpdateCategoryMarkup();
  const bulkRecalculate = useBulkRecalculateSellPrices();

  // Catalog categories for dropdowns
  const { data: catalogCategories } = useCatalogCategories();
  const toast = useToast();

  // Local state for settings form
  const [pricingMode, setPricingMode] = useState<string | null>(null);
  const [defaultMarkup, setDefaultMarkup] = useState<string | null>(null);
  const [allowOverride, setAllowOverride] = useState<boolean | null>(null);
  const [costMethod, setCostMethod] = useState<string | null>(null);
  const [minimumMargin, setMinimumMargin] = useState<string | null>(null);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Copy rules state (per group)
  const [copyTargetId, setCopyTargetId] = useState<string | null>(null);

  // Bulk actions state
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [recalcCategory, setRecalcCategory] = useState('');

  // Margin calculator state
  const [calcCost, setCalcCost] = useState('');
  const [calcSell, setCalcSell] = useState('');

  // Price list preview state — pick (group, cost method) to project the
  // resulting catalogue sell prices live.
  const [previewGroupId, setPreviewGroupId] = useState<string>('');
  const [previewCostMethod, setPreviewCostMethod] = useState<string>('');
  const [previewSearch, setPreviewSearch] = useState('');
  const { data: previewRows, isLoading: previewLoading } = usePriceListPreview(
    previewGroupId || null,
    previewCostMethod || null,
  );
  const filteredPreview = (previewRows ?? []).filter((r) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.trim().toLowerCase();
    return (
      (r.part_number ?? '').toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.category ?? '').toLowerCase().includes(q)
    );
  });
  const previewExport = () => {
    if (filteredPreview.length === 0) return;
    const rows: (string | number)[][] = [
      ['Part #', 'Description', 'Category', 'Unit cost', 'Markup %', 'Sell price', 'Margin %'],
      ...filteredPreview.map((r) => [
        r.part_number ?? '',
        r.description,
        r.category ?? '',
        r.unit_cost,
        r.markup_pct,
        r.sell_price,
        r.margin_pct,
      ]),
    ];
    const groupName = previewGroupId
      ? (groups ?? []).find((g) => g.id === previewGroupId)?.name ?? 'group'
      : 'default';
    downloadXlsx(`price-list-${groupName}-${previewCostMethod || 'default'}`, rows);
  };

  // New group form
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupMarkup, setNewGroupMarkup] = useState('30');

  // Expanded group (for editing rules)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [newRuleMarkup, setNewRuleMarkup] = useState('');

  // Derived values (use server data until locally changed)
  const mode = pricingMode ?? settings?.pricingMode ?? 'manual';
  const markup = defaultMarkup ?? String(settings?.defaultMarkupPct ?? 0);
  const override = allowOverride ?? settings?.allowManualOverride ?? true;
  const costMeth = costMethod ?? settings?.defaultCostMethod ?? 'last_cost';
  const minMargin = minimumMargin ?? String(settings?.minimumMarginPct ?? 0);

  // Margin calculator derived
  const calcMarginPct = Number(calcCost) > 0 && Number(calcSell) > 0
    ? (((Number(calcSell) - Number(calcCost)) / Number(calcSell)) * 100)
    : null;

  const categoryOptions = Array.isArray(catalogCategories) ? catalogCategories : [];

  const handleSaveSettings = async () => {
    setSettingsMsg('');
    try {
      await updateSettings.mutateAsync({
        pricingMode: mode,
        defaultMarkupPct: Number(markup),
        allowManualOverride: override,
        defaultCostMethod: costMeth,
        minimumMarginPct: Number(minMargin),
      });
      setSettingsMsg('Saved');
      setTimeout(() => setSettingsMsg(''), 2000);
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCopyRules = async (sourceId: string) => {
    if (!copyTargetId) return;
    if (!confirm('This will copy all category markup rules from this group to the target group. Existing rules in the target group will not be removed. Continue?')) return;
    try {
      await copyRules.mutateAsync({ sourceId, targetId: copyTargetId });
      toast.success('Rules copied successfully');
      setCopyTargetId(null);
    } catch {
      toast.error('Failed to copy rules');
    }
  };

  const handleBulkCategoryMarkup = async () => {
    if (!bulkCategory || !bulkMarkup) return;
    if (!confirm(`This will update the "${bulkCategory}" markup to ${bulkMarkup}% across ALL price groups. Continue?`)) return;
    try {
      await bulkUpdateCategory.mutateAsync({ partCategory: bulkCategory, markupPct: Number(bulkMarkup) });
      toast.success(`Markup for "${bulkCategory}" updated across all groups`);
      setBulkCategory('');
      setBulkMarkup('');
    } catch {
      toast.error('Failed to update category markup');
    }
  };

  const handleBulkRecalculate = async () => {
    const msg = recalcCategory
      ? `This will recalculate sell prices for all parts in "${recalcCategory}" using their cost + markup rules. Continue?`
      : 'This will recalculate sell prices for ALL parts using their cost + markup rules. Continue?';
    if (!confirm(msg)) return;
    try {
      await bulkRecalculate.mutateAsync({ category: recalcCategory || undefined });
      toast.success('Sell prices recalculated');
      setRecalcCategory('');
    } catch {
      toast.error('Failed to recalculate sell prices');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup.mutateAsync({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
        defaultMarkupPct: Number(newGroupMarkup) || 0,
      });
      setShowNewGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupMarkup('30');
    } catch { /* handled by mutation state */ }
  };

  const handleAddRule = async (groupId: string) => {
    if (!newRuleCategory.trim() || !newRuleMarkup) return;
    try {
      await addRule.mutateAsync({
        groupId,
        partCategory: newRuleCategory.trim(),
        markupPct: Number(newRuleMarkup),
      });
      setNewRuleCategory('');
      setNewRuleMarkup('');
    } catch { /* handled */ }
  };

  if (loadingSettings || loadingGroups) {
    return <p className="text-gray-500">{tc('loading')}</p>;
  }

  const groupList = Array.isArray(groups) ? groups : [];

  return (
    <div className="pb-16">
      <InventoryTabs />

      <SettingsPageHeader
        eyebrow={ts('eyebrow')}
        title={tpg('title')}
        description={tpg('description')}
      />

      <div className="mb-8 max-w-3xl">
        <LoyaltySection />
      </div>

      <div className="max-w-3xl space-y-8">
        {/* ── Pricing Mode Settings ─────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Pricing Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Mode</label>
              <select
                value={mode}
                onChange={(e) => setPricingMode(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="manual">Manual — user enters sell price</option>
                <option value="automatic">Automatic — sell price = cost + markup %</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Default Markup %</label>
              <p className="text-xs text-gray-500 mb-1">Fallback when no price group or category rule applies</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={markup}
                  onChange={(e) => setDefaultMarkup(e.target.value)}
                  className="block w-24 rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>

            {mode === 'automatic' && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAllowOverride(!override)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                    override ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                      override ? 'translate-x-4' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">Allow manual price override on job card</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Margin %</label>
              <p className="text-xs text-gray-500 mb-1">Shows a warning when a manual price override results in margin below this threshold</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={minMargin}
                  onChange={(e) => setMinimumMargin(e.target.value)}
                  className="block w-24 rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={updateSettings.isPending}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {updateSettings.isPending ? tc('loading') : tc('save')}
              </button>
              {settingsMsg && (
                <span className={`text-sm ${settingsMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>
                  {settingsMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Cost Valuation Method ─────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Valuation Method</h2>
          <p className="text-sm text-gray-500 mb-4">
            Determines how the cost price is calculated when a part has multiple purchase records at different prices.
          </p>
          <div className="space-y-4">
            <select
              value={costMeth}
              onChange={(e) => setCostMethod(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="last_cost">Last Cost — uses the most recent purchase price</option>
              <option value="weighted_average">Weighted Average (WAC) — average of items in stock</option>
              <option value="fifo">FIFO — first-in, first-out</option>
              <option value="lifo">LIFO — last-in, first-out</option>
              <option value="highest_cost">Highest in stock — most expensive layer still on shelf</option>
            </select>
            <div className="rounded-md bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
              <p><strong>Last Cost:</strong> Simplest. Uses the price from the most recent purchase order. Best when prices are stable.</p>
              <p><strong>Weighted Average (WAC):</strong> Smooths out fluctuations. Recalculated on every new receipt. Recommended for most workshops.</p>
              <p><strong>FIFO:</strong> Matches costs to the order they were purchased. Required in some accounting jurisdictions.</p>
              <p><strong>LIFO:</strong> Charges the most recent receipts first. Useful when input prices keep rising and you want COGS to reflect that.</p>
              <p><strong>Highest in stock:</strong> Conservative — uses the highest-cost layer still on the shelf, so sell prices never undercut your most expensive purchase.</p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={updateSettings.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {updateSettings.isPending ? tc('loading') : tc('save')}
            </button>
          </div>
        </div>

        {/* ── Quick Margin Calculator ─────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Margin Check</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calcCost}
                onChange={(e) => setCalcCost(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Sell</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calcSell}
                onChange={(e) => setCalcSell(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <span className="text-sm text-gray-500">Margin:</span>
              {calcMarginPct !== null ? (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    calcMarginPct < Number(minMargin)
                      ? 'bg-red-100 text-red-700'
                      : calcMarginPct < 20
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {calcMarginPct.toFixed(1)}%
                </span>
              ) : (
                <span className="text-sm text-gray-400">--%</span>
              )}
            </div>
          </div>
          {calcMarginPct !== null && calcMarginPct < Number(minMargin) && (
            <p className="mt-2 text-xs text-red-600">
              Below minimum margin threshold of {minMargin}%
            </p>
          )}
        </div>

        {/* ── Resolution Priority ───────────────────────── */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">How markup is resolved (priority order)</h3>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li><strong>Price Group + Part Category</strong> — e.g. &quot;Fleet&quot; group has 15% for Filters</li>
            <li><strong>Price Group Default</strong> — e.g. &quot;Fleet&quot; group default = 20%</li>
            <li><strong>Company Default</strong> — the fallback above ({markup}%)</li>
          </ol>
        </div>

        {/* ── Price Groups ──────────────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Price Groups</h2>
            <button
              onClick={() => setShowNewGroup(true)}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              + New Group
            </button>
          </div>

          {/* New group form */}
          {showNewGroup && (
            <div className="mb-4 rounded-md border border-primary-200 bg-primary-50 p-4 space-y-3">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g. Retail, Fleet, Trade)"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Description (optional)"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Default Markup:</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newGroupMarkup}
                  onChange={(e) => setNewGroupMarkup(e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateGroup}
                  disabled={createGroup.isPending}
                  className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createGroup.isPending ? tc('loading') : tc('save')}
                </button>
                <button
                  onClick={() => setShowNewGroup(false)}
                  className="rounded-md border px-3 py-1.5 text-sm text-gray-600"
                >
                  {tc('cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Group list */}
          {groupList.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No price groups yet. Create your first group to start automatic pricing.
            </p>
          ) : (
            <div className="space-y-3">
              {groupList.map((group) => {
                const isExpanded = expandedGroupId === group.id;
                const rules = group.rules ?? [];
                return (
                  <div key={group.id} className="rounded-md border border-gray-200">
                    {/* Group header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${group.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <span className="font-semibold text-gray-900">{group.name}</span>
                          {group.description && (
                            <span className="ms-2 text-sm text-gray-500">{group.description}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700">
                          {safe(group.default_markup_pct)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          {rules.length} rule{rules.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded: rules + actions */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                        {/* Existing rules */}
                        {rules.length > 0 && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-start text-xs text-gray-500 uppercase">
                                <th className="py-1 pe-4 font-semibold">Part Category</th>
                                <th className="py-1 pe-4 font-semibold text-end">Markup %</th>
                                <th className="py-1 w-16"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rules.map((rule) => (
                                <tr key={rule.id} className="border-t border-gray-100">
                                  <td className="py-2 pe-4 text-gray-700">{rule.part_category}</td>
                                  <td className="py-2 pe-4 text-end font-medium">{safe(rule.markup_pct)}%</td>
                                  <td className="py-2 text-end">
                                    <button
                                      onClick={() => deleteRule.mutate(rule.id)}
                                      className="text-xs text-red-500 hover:text-red-700"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {/* Add rule form */}
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Part Category</label>
                            <input
                              value={newRuleCategory}
                              onChange={(e) => setNewRuleCategory(e.target.value)}
                              placeholder="e.g. Filters, Body Parts, Electrical"
                              className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="w-24">
                            <label className="block text-xs text-gray-500 mb-1">Markup %</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={newRuleMarkup}
                              onChange={(e) => setNewRuleMarkup(e.target.value)}
                              className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <button
                            onClick={() => handleAddRule(group.id)}
                            disabled={addRule.isPending}
                            className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>

                        {/* Group actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <button
                            onClick={() => updateGroup.mutate({ id: group.id, isActive: !group.is_active })}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            {group.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this price group? Customers assigned to it will lose their pricing.')) {
                                deleteGroup.mutate(group.id);
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete Group
                          </button>
                        </div>

                        {/* Copy Rules */}
                        {groupList.length > 1 && (
                          <div className="flex items-end gap-2 pt-2 border-t border-gray-200">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">Copy Rules To</label>
                              <select
                                value={copyTargetId ?? ''}
                                onChange={(e) => setCopyTargetId(e.target.value || null)}
                                className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                              >
                                <option value="">Select target group...</option>
                                {groupList
                                  .filter((g) => g.id !== group.id)
                                  .map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                              </select>
                            </div>
                            <button
                              onClick={() => handleCopyRules(group.id)}
                              disabled={!copyTargetId || copyRules.isPending}
                              className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                            >
                              {copyRules.isPending ? 'Copying...' : 'Copy'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bulk Pricing Actions ────────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bulk Pricing Actions</h2>

          <div className="space-y-5">
            {/* Bulk category markup */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Update Category Markup</h3>
              <p className="text-xs text-gray-500 mb-3">Set the same markup percentage for a part category across all price groups.</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Part Category</label>
                  {categoryOptions.length > 0 ? (
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Select category...</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      placeholder="e.g. Filters, Electrical"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">Markup %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={bulkMarkup}
                    onChange={(e) => setBulkMarkup(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={handleBulkCategoryMarkup}
                  disabled={!bulkCategory || !bulkMarkup || bulkUpdateCategory.isPending}
                  className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {bulkUpdateCategory.isPending ? 'Applying...' : 'Apply to All Groups'}
                </button>
              </div>
            </div>

            {/* Bulk recalculate sell prices */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Recalculate Sell Prices</h3>
              <p className="text-xs text-gray-500 mb-3">
                Applies the company default markup to all parts (or a specific category) and recalculates their sell prices from cost.
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Category (optional — leave empty for all)</label>
                  {categoryOptions.length > 0 ? (
                    <select
                      value={recalcCategory}
                      onChange={(e) => setRecalcCategory(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">All categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={recalcCategory}
                      onChange={(e) => setRecalcCategory(e.target.value)}
                      placeholder="Leave empty for all"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
                <button
                  onClick={handleBulkRecalculate}
                  disabled={bulkRecalculate.isPending}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {bulkRecalculate.isPending ? 'Recalculating...' : 'Recalculate'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Price List Preview ─────────────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Price list preview</h2>
              <p className="text-sm text-gray-500">
                Project the expected sell price for each part using the chosen
                customer price group and cost method. The math mirrors what the
                pricing engine applies on every new invoice line.
              </p>
            </div>
            <button
              type="button"
              onClick={previewExport}
              disabled={filteredPreview.length === 0}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Export to Excel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer price group</label>
              <select
                value={previewGroupId}
                onChange={(e) => setPreviewGroupId(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Default (tenant)</option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost method</label>
              <select
                value={previewCostMethod}
                onChange={(e) => setPreviewCostMethod(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Tenant default ({costMeth})</option>
                <option value="last_cost">Last cost</option>
                <option value="weighted_average">Weighted average (WAC)</option>
                <option value="fifo">FIFO</option>
                <option value="lifo">LIFO</option>
                <option value="highest_cost">Highest in stock</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Filter</label>
              <input
                type="text"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="Part #, description, category…"
                className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-start">Part #</th>
                  <th className="px-3 py-2 text-start">Description</th>
                  <th className="px-3 py-2 text-start">Category</th>
                  <th className="px-3 py-2 text-end">Unit cost</th>
                  <th className="px-3 py-2 text-end">Markup %</th>
                  <th className="px-3 py-2 text-end">Sell price</th>
                  <th className="px-3 py-2 text-end">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-400">
                      Computing…
                    </td>
                  </tr>
                ) : filteredPreview.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-400">
                      No matching parts.
                    </td>
                  </tr>
                ) : (
                  filteredPreview.slice(0, 500).map((r) => (
                    <tr key={r.part_id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-700">
                        {r.part_number ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900">{r.description}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{r.category ?? '—'}</td>
                      <td className="px-3 py-1.5 text-end tabular-nums text-gray-700">
                        {r.unit_cost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-end tabular-nums text-gray-700">
                        {r.markup_pct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-end tabular-nums font-medium text-gray-900">
                        {r.sell_price.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-end tabular-nums ${
                          r.margin_pct < 0
                            ? 'text-red-600'
                            : r.margin_pct < 10
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {r.margin_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredPreview.length > 500 && (
            <p className="mt-2 text-xs text-gray-500">
              Showing the first 500 rows. Use the filter or export to Excel to see the rest.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
