'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Either a list of strings (label === value) or {label, value} pairs.
   * The dropdown shows labels; the form stores values.
   */
  options: string[] | SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /**
   * When true, the user can submit a value not in the options list (via Enter
   * or blur). Default true. Set false for ID-based pickers where free text
   * makes no sense (e.g. the Part picker).
   */
  allowFreeText?: boolean;
  /**
   * Fired whenever the user types in the input. Use this to drive a
   * server-side search (debounce in the caller) when the catalogue is
   * too large to load up front. The internal client-side filter still
   * runs on whatever options the parent passes back.
   */
  onInputChange?: (query: string) => void;
  className?: string;
  inputClassName?: string;
}

function normalise(options: string[] | SearchableSelectOption[]): SearchableSelectOption[] {
  if (options.length === 0) return [];
  if (typeof options[0] === 'string') {
    return (options as string[]).map((s) => ({ label: s, value: s }));
  }
  return options as SearchableSelectOption[];
}

/**
 * Combobox: filter-as-you-type input + scrollable option list.
 * Display labels in the dropdown, store values via onChange.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  allowFreeText = true,
  onInputChange,
  className = '',
  inputClassName = '',
}: SearchableSelectProps) {
  const norm = useMemo(() => normalise(options), [options]);
  const labelForValue = useMemo(() => {
    const hit = norm.find((o) => o.value === value);
    return hit?.label ?? (allowFreeText ? value : '');
  }, [norm, value, allowFreeText]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(labelForValue);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync internal query with external value when not actively editing
  useEffect(() => {
    if (!open) setQuery(labelForValue);
  }, [labelForValue, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Commit free-text on outside click if allowed and the value differs
        if (allowFreeText && query !== labelForValue) {
          onChange(query);
        } else {
          setQuery(labelForValue);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, labelForValue, allowFreeText, onChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return norm;
    return norm.filter((o) => o.label.toLowerCase().includes(q));
  }, [norm, query]);

  const selectOption = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  const commitFreeText = () => {
    if (allowFreeText) {
      onChange(query);
      setOpen(false);
    } else {
      setQuery(labelForValue);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          setHighlightIdx(0);
          if (onInputChange) onInputChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[highlightIdx]) {
              selectOption(filtered[highlightIdx]);
            } else {
              commitFreeText();
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery(labelForValue);
          }
        }}
        className={`block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${inputClassName}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {filtered.map((opt, idx) => (
            <li
              key={opt.value}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`cursor-pointer px-3 py-1.5 ${
                idx === highlightIdx
                  ? 'bg-primary-50 text-primary-900'
                  : 'text-gray-900 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
          {allowFreeText && query.trim()
            ? <>Press Enter to use &ldquo;{query}&rdquo;</>
            : 'No matches'}
        </div>
      )}
    </div>
  );
}
