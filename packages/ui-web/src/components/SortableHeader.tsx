'use client';

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (field: string, direction: SortDirection) => void;
  className?: string;
  align?: 'start' | 'end';
}

export function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  className,
  align = 'start',
}: SortableHeaderProps) {
  const isActive = currentSort === field;

  const handleClick = () => {
    if (!isActive) {
      onSort(field, 'asc');
    } else if (currentDirection === 'asc') {
      onSort(field, 'desc');
    } else {
      onSort(field, null); // Reset
    }
  };

  return (
    <th
      className={cn(
        'cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-gray-100/50',
        align === 'end' ? 'text-end' : 'text-start',
        isActive ? 'text-primary-700' : 'text-gray-500',
        className,
      )}
      onClick={handleClick}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'end' && 'flex-row-reverse')}>
        {label}
        <span className="inline-flex flex-col">
          {isActive ? (
            currentDirection === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
          )}
        </span>
      </span>
    </th>
  );
}

/**
 * Hook for managing sort state.
 * Usage: const { sortField, sortDir, handleSort, sortedData } = useSort(data, defaultField);
 */
export function sortData<T>(
  data: T[],
  field: string | null,
  direction: SortDirection,
  accessor?: (item: T, field: string) => unknown,
): T[] {
  if (!field || !direction) return data;

  return [...data].sort((a, b) => {
    const aVal = accessor ? accessor(a, field) : (a as Record<string, unknown>)[field];
    const bVal = accessor ? accessor(b, field) : (b as Record<string, unknown>)[field];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return direction === 'asc' ? 1 : -1;
    if (bVal == null) return direction === 'asc' ? -1 : 1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    const cmp = aStr.localeCompare(bStr);
    return direction === 'asc' ? cmp : -cmp;
  });
}
