'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Combobox: filter-as-you-type input + scrollable option list.
 * When `allowFreeText` is true, the user can type values not in the
 * options list (still committed via blur / Enter). Useful for make/
 * model fields where the master list may not cover every variant.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  allowFreeText = true,
  className = '',
  inputClassName = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync internal query with external value when it changes from outside
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Commit free-text on outside click if allowed
        if (allowFreeText && query !== value) onChange(query);
        else setQuery(value);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, value, allowFreeText, onChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const select = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
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
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIdx(0);
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
              select(filtered[highlightIdx]);
            } else if (allowFreeText) {
              select(query);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery(value);
          }
        }}
        className={`block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${inputClassName}`}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                select(opt);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`cursor-pointer px-3 py-1.5 ${
                idx === highlightIdx
                  ? 'bg-primary-50 text-primary-900'
                  : 'text-gray-900 hover:bg-gray-50'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && allowFreeText && query.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
          Press Enter to use &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
