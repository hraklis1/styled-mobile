import { confirmSheet } from '../primitives/ConfirmSheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { Conversation, timeAgo } from './ChatModel';
import { styles } from './ChatStyles';

// ── ConversationDrawer ────────────────────────────────────────────────────────

// Bucket threads by the user's *local* day. `updatedAt` is a UTC ISO string, so we
// parse it to an absolute instant and compare against local midnight (setHours on a
// local Date) rather than diffing raw UTC — otherwise an 11pm-local thread can land
// in the wrong bucket.
function groupConversations(list: Conversation[]): { label: string; items: Conversation[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 86_400_000;

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const earlier: Conversation[] = [];
  for (const c of list) {
    const t = new Date(c.updatedAt).getTime();
    if (!Number.isNaN(t) && t >= todayMs) today.push(c);
    else if (!Number.isNaN(t) && t >= yesterdayMs) yesterday.push(c);
    else earlier.push(c);
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
  registerOpenRow,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (id: number) => void;
  onRename: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  registerOpenRow: (row: SwipeableMethods | null) => void;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const close = () => swipeRef.current?.close();

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
        <Ionicons
          name={active ? 'chatbubble-ellipses' : 'chatbubble-outline'}
          size={16}
          color={active ? colors.primary : colors.mutedForeground}
        />
        <View style={styles.drawerRowCopy}>
          <Text style={[styles.drawerRowTitle, active && styles.drawerRowTitleActive]} numberOfLines={1}>
            {conversation.title || 'Conversation'}
          </Text>
          {conversation.preview ? (
            <Text style={styles.drawerRowPreview} numberOfLines={1}>
              {conversation.preview}
            </Text>
          ) : null}
          <Text style={styles.drawerRowMeta}>{timeAgo(conversation.updatedAt)}</Text>
        </View>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

export function ConversationDrawer({
  visible,
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
      title: `Delete “${c.title || 'this conversation'}”?`,
      message: 'This conversation will be removed from History. This can’t be undone.',
      confirmLabel: 'Delete conversation',
      destructive: true,
      onConfirm: () => onDelete(c.id),
    });
  };

  const groups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const matches = query
      ? conversations.filter((conversation) =>
          (conversation.title || 'Conversation').toLowerCase().includes(query)
          || (conversation.preview ?? '').toLowerCase().includes(query))
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

          <TouchableOpacity style={styles.drawerNewBtn} onPress={onNew}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
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
