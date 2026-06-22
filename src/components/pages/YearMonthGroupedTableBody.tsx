'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';

interface MonthGroup<T> {
  key: string;
  label: string;
  records: T[];
  sortValue: string;
}

interface YearGroup<T> {
  key: string;
  label: string;
  months: MonthGroup<T>[];
  sortValue: string;
  total: number;
}

interface YearMonthGroupedTableBodyProps<T> {
  records: T[];
  loading: boolean;
  colSpan: number;
  loadingText: string;
  emptyText: string;
  getDate: (record: T) => string | null | undefined;
  renderRow: (record: T) => ReactNode;
}

function getDateParts(value: string | null | undefined) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})/);
  if (!match) {
    return {
      yearKey: 'unknown',
      yearLabel: '未分年份',
      yearSort: '0000',
      monthKey: 'unknown',
      monthLabel: '未分月份',
      monthSort: '00',
    };
  }

  const year = match[1];
  const month = match[2].padStart(2, '0');
  return {
    yearKey: year,
    yearLabel: `${year}年`,
    yearSort: year,
    monthKey: `${year}-${month}`,
    monthLabel: `${Number(month)}月`,
    monthSort: month,
  };
}

function buildGroups<T>(records: T[], getDate: (record: T) => string | null | undefined): YearGroup<T>[] {
  const years = new Map<string, YearGroup<T>>();

  for (const record of records) {
    const parts = getDateParts(getDate(record));
    let yearGroup = years.get(parts.yearKey);
    if (!yearGroup) {
      yearGroup = {
        key: parts.yearKey,
        label: parts.yearLabel,
        months: [],
        sortValue: parts.yearSort,
        total: 0,
      };
      years.set(parts.yearKey, yearGroup);
    }

    let monthGroup = yearGroup.months.find((group) => group.key === parts.monthKey);
    if (!monthGroup) {
      monthGroup = {
        key: parts.monthKey,
        label: parts.monthLabel,
        records: [],
        sortValue: parts.monthSort,
      };
      yearGroup.months.push(monthGroup);
    }

    monthGroup.records.push(record);
    yearGroup.total += 1;
  }

  return Array.from(years.values())
    .sort((left, right) => right.sortValue.localeCompare(left.sortValue))
    .map((yearGroup) => ({
      ...yearGroup,
      months: yearGroup.months.sort((left, right) => right.sortValue.localeCompare(left.sortValue)),
    }));
}

export default function YearMonthGroupedTableBody<T>({
  records,
  loading,
  colSpan,
  loadingText,
  emptyText,
  getDate,
  renderRow,
}: YearMonthGroupedTableBodyProps<T>) {
  const groups = useMemo(() => buildGroups(records, getDate), [getDate, records]);
  const [closedYears, setClosedYears] = useState<Set<string>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const yearKeys = useMemo(() => groups.map((group) => group.key), [groups]);
  const monthKeys = useMemo(() => groups.flatMap((group) => group.months.map((month) => month.key)), [groups]);

  useEffect(() => {
    setClosedYears((current) => new Set([...current].filter((key) => yearKeys.includes(key))));
    setOpenMonths((current) => new Set([...current].filter((key) => monthKeys.includes(key))));
  }, [monthKeys, yearKeys]);

  const toggleYear = (key: string) => {
    setClosedYears((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setOpenMonths((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <TableBody>
      {loading ? (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-slate-500">
            {loadingText}
          </TableCell>
        </TableRow>
      ) : records.length ? (
        groups.map((yearGroup) => {
          const yearOpen = !closedYears.has(yearGroup.key);
          return (
            <Fragment key={`year-group-${yearGroup.key}`}>
              <TableRow key={`year-${yearGroup.key}`} className="bg-slate-100 hover:bg-slate-100">
                <TableCell colSpan={colSpan} className="px-3 py-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-900"
                    onClick={() => toggleYear(yearGroup.key)}
                  >
                    {yearOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{yearGroup.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {yearGroup.total} 条
                    </span>
                    <span className="ml-auto text-xs font-normal text-slate-500">{yearOpen ? '收起年份' : '展开年份'}</span>
                  </button>
                </TableCell>
              </TableRow>
              {yearOpen && yearGroup.months.map((monthGroup) => {
                const monthOpen = openMonths.has(monthGroup.key);
                return (
                  <Fragment key={`month-group-${monthGroup.key}`}>
                    <TableRow key={`month-${monthGroup.key}`} className="bg-blue-50/70 hover:bg-blue-50">
                      <TableCell colSpan={colSpan} className="px-6 py-2">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-left text-sm font-medium text-blue-950"
                          onClick={() => toggleMonth(monthGroup.key)}
                        >
                          {monthOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span>{monthGroup.label}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700 ring-1 ring-blue-100">
                            {monthGroup.records.length} 条
                          </span>
                          <span className="ml-auto text-xs font-normal text-blue-600">{monthOpen ? '收起当月' : '展开当月'}</span>
                        </button>
                      </TableCell>
                    </TableRow>
                    {monthOpen && monthGroup.records.map(renderRow)}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })
      ) : (
        <TableRow>
          <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-slate-500">
            {emptyText}
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}
