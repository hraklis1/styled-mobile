import { confirmSheet } from '../primitives/ConfirmSheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { Conversation } from './ChatModel';
import { GarmentImage } from '../wardrobe/garment-image';
import type { Item } from '../../types/item';
import { styles } from './ChatStyles';

// ── ConversationDrawer ────────────────────────────────────────────────────────

// Bucket threads by the user's *local* day. `updatedAt` is a UTC ISO string, so we
// parse it to an absolute instant and compare against local midnight (setHours on a
// local Date) rather than diffing raw UTC — otherwise an 11pm-local thread can land
// in the wrong bucket. Today / Yesterday / weekday for the last week / month after.
const DAY_MS = 86_400_000;

function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupLabel(t: number, todayMs: number): string {
  if (Number.isNaN(t)) return 'Earlier';
  const day = startOfLocalDay(t);
  if (day >= todayMs) return 'Today';
  if (day >= todayMs - DAY_MS) return 'Yesterday';
  if (day > todayMs - 7 * DAY_MS) return new Date(t).toLocaleDateString('en', { weekday: 'long' });
  const date = new Date(t);
  const sameYear = date.getFullYear() === new Date(todayMs).getFullYear();
  return date.toLocaleDateString('en', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

function groupConversations(list: Conversation[]): { label: string; items: Conversation[] }[] {
  const todayMs = startOfLocalDay(Date.now());
  const groups: { label: string; items: Conversation[] }[] = [];
  for (const c of list) {
    const label = groupLabel(new Date(c.updatedAt).getTime(), todayMs);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(c);
    else groups.push({ label, items: [c] });
  }
  return groups;
}

// The group header already says which day; the row only needs the time.
function rowTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  if (Date.now() - t < 60_000) return 'Just now';
  return new Date(t).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

// Titles come from the first prompt, which may carry a calendar entry verbatim
// (`Dress me for "Regular | VH " on…`). Drop the quotes and pipes so the list reads
// as prose.
export function cleanConversationTitle(title: string | null | undefined): string {
  const cleaned = (title ?? '')
    .replace(/["“”]/g, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
  return cleaned || 'Conversation';
}

// Previews are the last message verbatim, so strip markdown emphasis, headings,
// bullets and links before showing them as one plain line.
export function plainPreview(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/^\s*(#{1,6}|[-•]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ConversationRow({
  conversation,
  lookItem,
  active,
  onSelect,
  onRename,
  onDelete,
  registerOpenRow,
}: {
  conversation: Conversation;
  /** First piece of the thread's latest look; the row's thumbnail. */
  lookItem?: Item;
  active: boolean;
  onSelect: (id: number) => void;
  onRename: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  registerOpenRow: (row: SwipeableMethods | null) => void;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const close = () => swipeRef.current?.close();
  const rawPreview = plainPreview(conversation.preview);
  const preview = rawPreview ? cleanConversationTitle(rawPreview) : '';

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      onSwipeableWillOpen={() => registerOpenRow(swipeRef.current)}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.drawerDeleteAction}
          onPress={() => {
            close();
            onDelete(conversation);
          }}
          accessibilityLabel="Delete conversation"
        >
          <Ionicons name="trash-outline" size={18} color={colors.white} />
          <Text style={styles.drawerDeleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={[styles.drawerRow, active && styles.drawerRowActive]}
        onPress={() => onSelect(conversation.id)}
        onLongPress={() => {
          close();
          Haptics.selectionAsync().catch(() => {});
          onRename(conversation);
        }}
        delayLongPress={300}
      >
        {lookItem ? (
          <GarmentImage item={lookItem} width={40} height={48} placeholderIconSize={14} />
        ) : (
          <View style={styles.drawerRowGlyph}>
            <Ionicons
              name={active ? 'chatbubble-ellipses' : 'chatbubble-outline'}
              size={16}
              color={active ? colors.primary : colors.mutedForeground}
            />
          </View>
        )}
        <View style={styles.drawerRowCopy}>
          <Text style={[styles.drawerRowTitle, active && styles.drawerRowTitleActive]} numberOfLines={1}>
            {cleanConversationTitle(conversation.title)}
          </Text>
          {conversation.lookName ? (
            <Text style={styles.drawerRowLook} numberOfLines={1}>
              {conversation.lookName}
            </Text>
          ) : preview ? (
            <Text style={styles.drawerRowPreview} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
          <Text style={styles.drawerRowMeta}>{rowTime(conversation.updatedAt)}</Text>
        </View>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

export function ConversationDrawer({
  visible,
  items,
  conversations,
  loading,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onNew,
  onClose,
}: {
  visible: boolean;
  items: Item[];
  conversations: Conversation[];
  loading: boolean;
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.82);
  const [searchText, setSearchText] = useState('');
  const translateX = useRef(new Animated.Value(-panelWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  // Track the currently-open swipe row so opening a second one closes the first.
  const openRowRef = useRef<SwipeableMethods | null>(null);
  const registerOpenRow = (row: SwipeableMethods | null) => {
    if (openRowRef.current && openRowRef.current !== row) openRowRef.current.close();
    openRowRef.current = row;
  };

  // Cross-platform rename: Alert.prompt is iOS-only, so use a small Modal + TextInput.
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [renameText, setRenameText] = useState('');
  const beginRename = (c: Conversation) => {
    setRenameText(c.title || '');
    setRenaming(c);
  };
  const commitRename = () => {
    if (renaming && renameText.trim()) onRename(renaming.id, renameText);
    setRenaming(null);
  };

  const confirmDelete = (c: Conversation) => {
    confirmSheet({
      title: `Delete “${cleanConversationTitle(c.title)}”?`,
      message: 'This conversation will be removed from History. This can’t be undone.',
      confirmLabel: 'Delete conversation',
      destructive: true,
      onConfirm: () => onDelete(c.id),
    });
  };

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const groups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const matches = query
      ? conversations.filter((conversation) =>
          cleanConversationTitle(conversation.title).toLowerCase().includes(query)
          || plainPreview(conversation.preview).toLowerCase().includes(query))
      : conversations;
    return groupConversations(matches);
  }, [conversations, searchText]);

  useEffect(() => {
    if (visible) {
      setSearchText('');
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -panelWidth, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, panelWidth, translateX, backdrop]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.drawerBackdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close history" />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              width: panelWidth,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Conversations</Text>
            <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Close history">
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.drawerSearch}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.drawerSearchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search conversations"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="Search conversation titles and previews"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                style={styles.drawerSearchClear}
                onPress={() => setSearchText('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.drawerNewBtn} onPress={onNew} accessibilityRole="button">
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.drawerNewText}>New conversation</Text>
          </TouchableOpacity>

          {loading && conversations.length === 0 ? (
            <View style={styles.drawerEmpty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.drawerEmpty}>
              <Text style={styles.drawerEmptyText}>No saved conversations yet.</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.drawerEmpty}>
              <Text style={styles.drawerEmptyText}>No matching conversations. Try another search.</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.drawerList}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
            >
              {groups.map((group) => (
                <View key={group.label} style={styles.drawerGroup}>
                  <Text style={styles.drawerGroupLabel}>{group.label}</Text>
                  {group.items.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      lookItem={c.lookItemIds?.map((id) => itemsById.get(id)).find((item) => !!item)}
                      active={c.id === activeId}
                      onSelect={onSelect}
                      onRename={beginRename}
                      onDelete={confirmDelete}
                      registerOpenRow={registerOpenRow}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
          <KeyboardAvoidingView
            style={styles.renameOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenaming(null)} />
            <View style={styles.renameCard}>
              <Text style={styles.renameTitle}>Rename conversation</Text>
              <TextInput
                style={styles.renameInput}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Conversation name"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={commitRename}
                maxLength={80}
              />
              <View style={styles.renameActions}>
                <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setRenaming(null)}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameSaveBtn, !renameText.trim() && styles.locationChoiceDisabled]}
                  onPress={commitRename}
                  disabled={!renameText.trim()}
                >
                  <Text style={styles.renameSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </GestureHandlerRootView>
    </Modal>
  );
}
