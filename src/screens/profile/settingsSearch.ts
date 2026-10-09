/**
 * Search index for Settings. Each entry is one setting a person might look
 * for, wherever it lives in the stack, so "haptics" finds the toggle inside
 * Accessibility rather than only top-level rows.
 *
 * Keep this in step with the Settings screens: a new row worth finding gets
 * an entry here, with the words people would type for it (not just its label).
 */
import type { Ionicons } from '@expo/vector-icons';
import type { ProfileStackParamList } from './types';

type IconName = keyof typeof Ionicons.glyphMap;

/** Rows on the Settings root that run something instead of pushing a screen. */
export type SettingsAction = 'resetTips' | 'support' | 'privacyPolicy' | 'terms';

export type SettingsSearchEntry = {
  id: string;
  title: string;
  /** Where it lives, shown under the title ("Notifications › Daily"). */
  path: string;
  icon?: IconName;
  keywords: string[];
  target: { route: keyof ProfileStackParamList } | { action: SettingsAction };
};

const route = (r: keyof ProfileStackParamList) => ({ route: r });

export const SETTINGS_INDEX: SettingsSearchEntry[] = [
  // Membership
  { id: 'membership', title: 'Membership & credits', path: 'Settings', icon: 'diamond-outline', target: route('SettingsMembership'),
    keywords: ['plan', 'premium', 'subscription', 'billing', 'upgrade', 'balance', 'pro'] },
  { id: 'credits', title: 'Studio credits', path: 'Membership', icon: 'diamond-outline', target: route('SettingsMembership'),
    keywords: ['credits', 'balance', 'refill', 'buy'] },
  { id: 'costs', title: 'What things cost', path: 'Membership', icon: 'pricetag-outline', target: route('SettingsMembership'),
    keywords: ['price', 'pricing', 'credits', 'cost'] },
  { id: 'manageSub', title: 'Manage subscription', path: 'Membership', icon: 'card-outline', target: route('SettingsMembership'),
    keywords: ['cancel', 'subscription', 'billing', 'renew', 'premium'] },
  { id: 'restore', title: 'Restore purchases', path: 'Membership', icon: 'refresh-outline', target: route('SettingsMembership'),
    keywords: ['purchase', 'restore', 'subscription', 'reinstall'] },

  // Stylist
  { id: 'stylist', title: 'Stylist', path: 'Settings › Experience', icon: 'chatbubble-ellipses-outline', target: route('SettingsStylist'),
    keywords: ['ai', 'chat', 'assistant', 'tone'] },
  { id: 'answerLength', title: 'Answer length', path: 'Stylist', icon: 'chatbubble-ellipses-outline', target: route('SettingsStylist'),
    keywords: ['tone', 'concise', 'balanced', 'detailed', 'verbose', 'short', 'long', 'replies'] },
  { id: 'range', title: 'Styling range', path: 'Stylist', icon: 'color-wand-outline', target: route('SettingsStylist'),
    keywords: ['adventurous', 'bold', 'safe', 'experimental', 'risk'] },
  { id: 'shopLinks', title: 'Suggest pieces to buy', path: 'Stylist', icon: 'bag-outline', target: route('SettingsStylist'),
    keywords: ['shopping', 'shop', 'links', 'buy', 'products', 'recommendations'] },
  { id: 'home', title: 'Home location', path: 'Stylist › Home', icon: 'home-outline', target: route('SettingsStylist'),
    keywords: ['city', 'location', 'weather', 'stores', 'address'] },
  { id: 'temperature', title: 'Temperature units', path: 'Settings › Units · also in Stylist', icon: 'thermometer-outline', target: route('SettingsStylist'),
    keywords: ['celsius', 'fahrenheit', 'units', 'weather', 'metric', 'imperial'] },
  { id: 'currency', title: 'Currency', path: 'Stylist › Units', icon: 'cash-outline', target: route('SettingsStylist'),
    keywords: ['money', 'prices', 'dollars', 'euros', 'pounds', 'usd', 'eur', 'gbp'] },

  // Notifications
  { id: 'notifications', title: 'Notifications', path: 'Settings › Experience', icon: 'notifications-outline', target: route('SettingsNotifications'),
    keywords: ['alerts', 'reminders', 'push', 'nudges'] },
  { id: 'todaysLook', title: "Today's Look", path: 'Notifications › Daily', icon: 'sunny-outline', target: route('SettingsNotifications'),
    keywords: ['morning', 'daily', 'outfit', 'reminder', 'notification'] },
  { id: 'deliveryTime', title: 'Delivery time', path: 'Notifications › Daily', icon: 'time-outline', target: route('SettingsNotifications'),
    keywords: ['time', 'schedule', 'morning', 'when'] },
  { id: 'wearLog', title: 'Wear log reminder', path: 'Notifications › Daily', icon: 'shirt-outline', target: route('SettingsNotifications'),
    keywords: ['wore', 'log', 'evening', 'reminder', 'prompt'] },
  { id: 'eventOutfits', title: 'Event outfits', path: 'Notifications › Plans', icon: 'calendar-outline', target: route('SettingsNotifications'),
    keywords: ['calendar', 'events', 'plans', 'reminder'] },

  // Accessibility
  { id: 'accessibility', title: 'Accessibility', path: 'Settings › Experience', icon: 'accessibility-outline', target: route('SettingsAccessibility'),
    keywords: ['a11y'] },
  { id: 'reduceMotion', title: 'Reduce motion', path: 'Accessibility', icon: 'pulse-outline', target: route('SettingsAccessibility'),
    keywords: ['animation', 'motion', 'fades', 'dizzy', 'transitions'] },
  { id: 'haptics', title: 'Haptics', path: 'Accessibility', icon: 'phone-portrait-outline', target: route('SettingsAccessibility'),
    keywords: ['vibration', 'vibrate', 'taps', 'feedback', 'buzz'] },
  { id: 'tips', title: 'Show tips again', path: 'Settings › Experience', icon: 'help-circle-outline', target: { action: 'resetTips' },
    keywords: ['hints', 'tutorial', 'onboarding', 'help', 'coach', 'reset'] },

  // Your data
  { id: 'learned', title: 'What Styled has learned', path: 'Settings › Your data', icon: 'bulb-outline', target: route('SettingsLearned'),
    keywords: ['taste', 'preferences', 'memory', 'learned', 'profile', 'avoid', 'fingerprint'] },
  { id: 'notForMe', title: 'Products marked “Not for me”', path: 'What Styled has learned › Shopping', icon: 'eye-off-outline', target: route('SettingsHiddenProducts'),
    keywords: ['hidden', 'disliked', 'not for me', 'products', 'restore', 'shopping'] },
  { id: 'resetLearned', title: 'Reset everything learned', path: 'What Styled has learned', icon: 'refresh-outline', target: route('SettingsLearned'),
    keywords: ['reset', 'forget', 'clear', 'memory'] },
  { id: 'privacy', title: 'Privacy & data', path: 'Settings › Your data', icon: 'shield-checkmark-outline', target: route('SettingsPrivacy'),
    keywords: ['permissions', 'privacy', 'data'] },
  { id: 'location', title: 'Location', path: 'Privacy & data › Permissions', icon: 'location-outline', target: route('SettingsPrivacy'),
    keywords: ['gps', 'permission', 'weather', 'where'] },
  { id: 'analytics', title: 'Share usage analytics', path: 'Privacy & data', icon: 'analytics-outline', target: route('SettingsPrivacy'),
    keywords: ['tracking', 'analytics', 'telemetry', 'usage', 'opt out'] },
  { id: 'clearHistory', title: 'Clear stylist history', path: 'Privacy & data › Your stylist', icon: 'chatbubbles-outline', target: route('SettingsPrivacy'),
    keywords: ['chat', 'conversations', 'history', 'delete', 'messages'] },
  { id: 'export', title: 'Export my data', path: 'Privacy & data › Your data', icon: 'download-outline', target: route('SettingsPrivacy'),
    keywords: ['download', 'export', 'json', 'backup', 'gdpr', 'copy'] },

  // Account
  { id: 'account', title: 'Account', path: 'Settings › Your data', icon: 'person-circle-outline', target: route('SettingsAccount'),
    keywords: ['profile', 'login', 'email'] },
  { id: 'name', title: 'Name', path: 'Account', icon: 'person-outline', target: route('SettingsAccount'),
    keywords: ['name', 'nickname', 'call me', 'display'] },
  { id: 'email', title: 'Email & sign-in', path: 'Account › Sign-in', icon: 'mail-outline', target: route('SettingsAccount'),
    keywords: ['email', 'apple', 'google', 'login', 'sign in'] },
  { id: 'password', title: 'Change password', path: 'Account › Sign-in', icon: 'key-outline', target: route('SettingsAccount'),
    keywords: ['password', 'security', 'credentials'] },
  { id: 'quiz', title: 'Retake style quiz', path: 'Account', icon: 'sparkles-outline', target: route('SettingsAccount'),
    keywords: ['quiz', 'onboarding', 'style', 'redo', 'restart'] },
  { id: 'signOut', title: 'Sign out', path: 'Account', icon: 'log-out-outline', target: route('SettingsAccount'),
    keywords: ['logout', 'log out', 'sign off'] },
  { id: 'delete', title: 'Delete account', path: 'Account', icon: 'trash-outline', target: route('SettingsAccount'),
    keywords: ['remove', 'close', 'erase', 'delete', 'deactivate'] },

  // Support
  { id: 'support', title: 'Contact support', path: 'Settings › Support', icon: 'help-buoy-outline', target: { action: 'support' },
    keywords: ['help', 'contact', 'bug', 'feedback', 'email', 'problem'] },
  { id: 'privacyPolicy', title: 'Privacy Policy', path: 'Settings › Support', icon: 'document-text-outline', target: { action: 'privacyPolicy' },
    keywords: ['legal', 'policy', 'gdpr'] },
  { id: 'terms', title: 'Terms of Service', path: 'Settings › Support', icon: 'document-text-outline', target: { action: 'terms' },
    keywords: ['legal', 'tos', 'terms', 'conditions'] },
];

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'“”]/g, '');

const words = (text: string) => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Every query word must prefix-match a word in the entry. Title matches rank
 * above keyword matches, which rank above breadcrumb matches, so "not" finds
 * "Products marked Not for me" before anything that only lives under it.
 */
export function searchSettings(query: string, index = SETTINGS_INDEX): SettingsSearchEntry[] {
  const terms = words(query);
  if (!terms.length) return [];

  const scored: { entry: SettingsSearchEntry; score: number }[] = [];
  index.forEach((entry, order) => {
    const title = words(entry.title);
    const keywords = entry.keywords.flatMap(words);
    const path = words(entry.path);
    let score = 0;
    for (const term of terms) {
      const hit = (list: string[]) => list.some((word) => word.startsWith(term));
      if (title[0]?.startsWith(term)) score += 6;
      else if (hit(title)) score += 4;
      else if (hit(keywords)) score += 2;
      else if (hit(path)) score += 1;
      else return;
    }
    // Stable within a score: the order of the index mirrors the screens.
    scored.push({ entry, score: score * 1000 - order });
  });
  return scored.sort((a, b) => b.score - a.score).map(({ entry }) => entry);
}
