import type { Item } from '../../types/item';
import type { StylistMode, StylistWorkflow } from './types';

export type StylistWorkflowKind = StylistWorkflow['kind'];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function formatLocalCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalCalendarDate(value: string): Date | null {
  if (!DATE_ONLY.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return null;
  return parsed;
}

export function workflowMode(workflow: StylistWorkflow): StylistMode {
  switch (workflow.kind) {
    case 'occasion':
    case 'style_piece':
      return 'from_closet';
    case 'trip':
      return 'trip';
    case 'wardrobe_audit':
      return 'wardrobe_audit';
    case 'wardrobe_build':
      return 'shop_list';
  }
}

export function validateStylistWorkflow(workflow: StylistWorkflow, items: Item[]): string | null {
  switch (workflow.kind) {
    case 'occasion':
      return clean(workflow.plan) ? null : 'Add the plan or setting.';
    case 'style_piece':
      return items.some((item) => item.id === workflow.itemId && item.condition !== 'needs_repair' && item.condition !== 'donate')
        ? null
        : 'Choose a piece from your wardrobe.';
    case 'trip': {
      if (!clean(workflow.destination)) return 'Add the destination.';
      const start = parseLocalCalendarDate(workflow.startDate);
      const end = parseLocalCalendarDate(workflow.endDate);
      if (!start || !end) return 'Choose valid trip dates.';
      return end.getTime() >= start.getTime() ? null : 'The return date must be after the departure date.';
    }
    case 'wardrobe_audit':
      return null;
    case 'wardrobe_build':
      return workflow.lifestyle.length > 0 ? null : 'Choose at least one part of your lifestyle.';
  }
}

function labelList(values: string[] | undefined, labels?: Record<string, string>): string | undefined {
  if (!values?.length) return undefined;
  return values.map((value) => labels?.[value] ?? value.replace(/_/g, ' ')).join(', ');
}

export function summarizeStylistWorkflow(
  workflow: StylistWorkflow,
  items: Item[],
  labels?: { styles?: Record<string, string>; budgets?: Record<string, string>; lifestyles?: Record<string, string> },
): string {
  switch (workflow.kind) {
    case 'occasion': {
      const details = [clean(workflow.dressCode), clean(workflow.feeling)].filter(Boolean).join(' · ');
      return `Dress me for ${workflow.plan.trim()}${details ? ` — ${details}` : ''}.`;
    }
    case 'style_piece': {
      const item = items.find((candidate) => candidate.id === workflow.itemId);
      const details = [clean(workflow.occasion), clean(workflow.direction)].filter(Boolean).join(' · ');
      return `Build a look around ${item?.name ?? 'this wardrobe piece'}${details ? ` — ${details}` : ''}.`;
    }
    case 'trip':
      return `Pack me for ${workflow.destination.trim()}, ${workflow.startDate} to ${workflow.endDate}${workflow.luggage && workflow.luggage !== 'not_sure' ? ` — ${workflow.luggage === 'carry_on' ? 'carry-on only' : 'checked bag'}` : ''}.`;
    case 'wardrobe_audit':
      return 'Give my wardrobe a thoughtful edit: what works, what is underused, and where should I invest next?';
    case 'wardrobe_build': {
      const lifestyle = labelList(workflow.lifestyle, labels?.lifestyles) ?? 'my lifestyle';
      const style = labelList(workflow.styleDirection, labels?.styles);
      const budget = labelList(workflow.budget, labels?.budgets);
      const details = [style, budget].filter(Boolean).join(' · ');
      return `Build a versatile wardrobe for ${lifestyle}${details ? ` — ${details}` : ''}.`;
    }
  }
}

export function deviceTimeContext(): { userTimeZone?: string; userUtcOffsetMinutes: number } {
  let userTimeZone: string | undefined;
  try {
    userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    userTimeZone = undefined;
  }
  return {
    ...(userTimeZone ? { userTimeZone } : {}),
    userUtcOffsetMinutes: -new Date().getTimezoneOffset(),
  };
}
