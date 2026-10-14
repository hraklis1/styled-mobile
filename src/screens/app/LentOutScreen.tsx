import { useEffect, useMemo, useRef, useState } from 'react';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsScaffold, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import { PersonSheet } from '../../components/lending/PersonSheet';
import { useReturnWithUndo } from '../../components/lending/useReturnWithUndo';
import { remindPerson } from '../../components/lending/remindPerson';
import { LendSheet } from '../../components/lending/LendSheet';
import { useLendItems, type LendInput } from '../../hooks/useLendContacts';
import { useItems } from '../../hooks/useItems';
import {
  useDeleteLendContact, useLendContacts, useLoans, useUpdateLendContact,
} from '../../hooks/useLendContacts';
import { itemThumbUri } from '../../lib/itemImage';
import {
  isLentNow, LEND_RELATIONSHIPS, loanImageFields, localYmd, openLoanOf, openLoanStatus, pastLoanSummary, relationshipLabel,
  type ItemLoan, type LendContact, type OpenLoanSummary,
} from '../../lib/lending';
import type { LentOutScreenProps } from '../../navigation/types';
import { colors, radii, spacing, typography } from '../../theme';

const RELATIONSHIP_GROUP_TITLES: Record<string, string> = {
  friend: 'Friends', family: 'Family', partner: 'Partner', colleague: 'Colleagues', other: 'Other people',
};

/** A piece that is out right now, whether or not it has a loan row (older lends don't). */
type OutRow = { itemId: number; name: string; uri?: string; loan: OpenLoanSummary | null };

/**
 * Who has what, and who has had what. Pieces that are out now are grouped by
 * person (overdue first, then longest out); each person's past loans fold out
 * beneath. People with nothing out right now are listed with their history.
 */
export function LentOutScreen({ navigation, route }: LentOutScreenProps) {
  const { data: items = [] } = useItems();
  const { data: contacts = [] } = useLendContacts();
  // What is out comes with the items; only the returned loans are fetched here.
  const { data: pastLoans = [], isLoading } = useLoans({ status: 'returned' });
  const { markReturned, toast } = useReturnWithUndo();
  const lendItems = useLendItems();
  // A piece lent without a name: naming it edits the open loan, dates kept.
  const [naming, setNaming] = useState<OutRow | null>(null);
  // One swiped-open row at a time.
  const openRow = useRef<SwipeableMethods | null>(null);
  const registerOpenRow = (row: SwipeableMethods | null) => {
    if (openRow.current && openRow.current !== row) openRow.current.close();
    openRow.current = row;
  };
  const updateContact = useUpdateLendContact();
  const deleteContact = useDeleteLendContact();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LendContact | null>(null);
  const today = localYmd();
  // SettingsScaffold is built for page sheets; a full-screen push needs the status-bar inset.
  const insets = useSafeAreaInsets();

  const { outGroups, pastByContact, idle } = useMemo(() => {
    const lentItems = items.filter(isLentNow);
    const known = (id: number | null) => (id != null && contacts.some((c) => c.id === id) ? id : null);

    const out = new Map<number | null, OutRow[]>();
    for (const item of lentItems) {
      const loan = openLoanOf(item);
      const key = known(loan?.contactId ?? null);
      out.set(key, [...(out.get(key) ?? []), { itemId: item.id, name: item.name, uri: itemThumbUri(item), loan }]);
    }
    const urgency = (row: OutRow) => {
      if (!row.loan) return '9';
      const overdue = row.loan.dueBack && row.loan.dueBack < today;
      return `${overdue ? '0' : '1'}${row.loan.dueBack && overdue ? row.loan.dueBack : row.loan.lentAt}`;
    };
    const outGroups = [...out.entries()]
      .map(([id, rows]) => ({
        contact: id == null ? null : contacts.find((c) => c.id === id) ?? null,
        rows: [...rows].sort((a, b) => urgency(a).localeCompare(urgency(b))),
      }))
      .sort((a, b) => (a.contact ? 0 : 1) - (b.contact ? 0 : 1) || urgency(a.rows[0]).localeCompare(urgency(b.rows[0])));

    const pastByContact = new Map<number | null, ItemLoan[]>();
    for (const loan of pastLoans) {
      const key = known(loan.contactId);
      pastByContact.set(key, [...(pastByContact.get(key) ?? []), loan]);
    }
    const idle = contacts.filter((c) => !out.has(c.id));
    return { outGroups, pastByContact, idle };
  }, [items, pastLoans, contacts, today]);

  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // Tapped a single-loan reminder: open the "remind them" message for it once
  // the items (which carry the open loans) are here.
  const nudge = route.params?.nudge;
  useEffect(() => {
    if (!nudge || !items.length) return;
    navigation.setParams({ nudge: undefined });
    const item = items.find((i) => openLoanOf(i)?.id === nudge);
    const loan = item ? openLoanOf(item) : null;
    if (item && loan) void remindPerson(loan.contactName, [{ name: item.name, dueBack: loan.dueBack }]);
  }, [nudge, items, navigation]);

  const remove = (contact: LendContact) => {
    setEditing(null);
    // Let the page sheet finish dismissing before the confirm sheet presents.
    setTimeout(() => confirmSheet({
      title: `Remove ${contact.name}?`,
      message: 'Their lending history stays, just without a name.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => deleteContact.mutate(contact.id),
    }), 350);
  };

  const openItem = (itemId: number) => navigation.navigate('ItemDetail', { itemId });

  const history = (key: string, past: ItemLoan[]) => (expanded.has(key) ? past.map((loan) => (
    <GroupBlock key={`past-${loan.id}`}>
      <Pressable style={s.rowMain} onPress={() => openItem(loan.itemId)} accessibilityRole="button" accessibilityLabel={`Open ${loan.itemName}`}>
        <View style={[s.thumb, s.thumbSmall]}>
          <Image source={{ uri: itemThumbUri(loanImageFields(loan)) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
        <View style={s.copy}>
          <Text style={s.title} numberOfLines={1}>{loan.itemName}</Text>
          <Text style={s.meta} numberOfLines={2}>{pastLoanSummary(loan)}</Text>
        </View>
      </Pressable>
    </GroupBlock>
  )) : null);

  const historyToggle = (key: string, count: number) => (count ? (
    <Pressable
      onPress={() => toggle(key)}
      style={s.action}
      accessibilityRole="button"
      accessibilityLabel={expanded.has(key) ? 'Hide lending history' : `Show lending history, ${count} ${count === 1 ? 'loan' : 'loans'}`}
      accessibilityState={{ expanded: expanded.has(key) }}
    >
      <Text style={s.muted}>{expanded.has(key) ? 'Hide history' : `History (${count})`}</Text>
    </Pressable>
  ) : null);

  const totalOut = outGroups.reduce((n, g) => n + g.rows.length, 0);
  const idleGroups = LEND_RELATIONSHIPS
    .map((r) => ({ id: r.id, title: RELATIONSHIP_GROUP_TITLES[r.id], people: idle.filter((c) => c.relationship === r.id) }))
    .filter((g) => g.people.length > 0);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
    <SettingsScaffold
      title="Lent out"
      lede={totalOut
        ? `${totalOut} ${totalOut === 1 ? 'piece is' : 'pieces are'} with other people. The stylist leaves them out until they're back.`
        : 'Nothing is lent out right now. When a friend borrows something, note it here and we\'ll remember who has it.'}
    >
      <Pressable
        onPress={() => navigation.navigate('ClosetMain', { lend: true })}
        style={s.lendButton}
        accessibilityRole="button"
        accessibilityHint="Opens your closet to choose pieces"
      >
        <Ionicons name="add" size={18} color={colors.primaryForeground} />
        <Text style={s.lendButtonLabel}>Lend something</Text>
      </Pressable>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {outGroups.map(({ contact, rows }) => {
        const key = String(contact?.id ?? 'unnamed');
        const past = pastByContact.get(contact?.id ?? null) ?? [];
        return (
          <Group key={key} title={contact ? `${contact.name} · ${relationshipLabel(contact.relationship)}` : 'No name given'}>
            {rows.map((row) => {
              const status = row.loan ? openLoanStatus(row.loan, today) : null;
              return (
                <GroupBlock key={row.itemId}>
                  <SwipeToReturn onReturn={() => markReturned([row.itemId], row.name)} registerOpen={registerOpenRow}>
                    <View style={s.row}>
                      <Pressable style={s.rowMain} onPress={() => openItem(row.itemId)} accessibilityRole="button" accessibilityLabel={`Open ${row.name}`}>
                        <View style={s.thumb}>{row.uri ? <Image source={{ uri: row.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
                        <View style={s.copy}>
                          <Text style={s.title} numberOfLines={2}>{row.name}</Text>
                          {status ? <Text style={[s.meta, status.overdue && s.overdue]}>{status.text}</Text> : null}
                          {row.loan?.note ? <Text style={s.meta} numberOfLines={1}>{row.loan.note}</Text> : null}
                          {!contact ? (
                            <Pressable onPress={() => setNaming(row)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add who has ${row.name}`}>
                              <Text style={[s.meta, s.inlineLink]}>Add a name</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </Pressable>
                      <Pressable onPress={() => markReturned([row.itemId], row.name)} style={s.returnPill} accessibilityRole="button" accessibilityLabel={`Mark ${row.name} as returned`}>
                        <Ionicons name="checkmark" size={14} color={colors.foreground} />
                        <Text style={s.returnPillLabel}>Returned</Text>
                      </Pressable>
                    </View>
                  </SwipeToReturn>
                </GroupBlock>
              );
            })}
            {rows.length > 1 || past.length > 0 || contact ? (
            <GroupBlock>
              <View style={s.footerRow}>
                {contact ? (
                  <Pressable
                    onPress={() => { void remindPerson(contact.name, rows.map((r) => ({ name: r.name, dueBack: r.loan?.dueBack }))); }}
                    style={s.action}
                    accessibilityRole="button"
                    accessibilityLabel={`Send ${contact.name} a reminder`}
                  >
                    <Text style={s.link}>Remind {contact.name.split(' ')[0]}</Text>
                  </Pressable>
                ) : null}
                {rows.length > 1 ? (
                  <Pressable
                    onPress={() => markReturned(rows.map((r) => r.itemId), `${rows.length} pieces`)}
                    style={s.action}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark all ${rows.length} pieces${contact ? ` from ${contact.name}` : ''} as returned`}
                  >
                    <Text style={s.link}>All returned</Text>
                  </Pressable>
                ) : null}
                {historyToggle(key, past.length)}
                {contact ? (
                  <Pressable onPress={() => setEditing(contact)} style={s.action} accessibilityRole="button" accessibilityLabel={`Edit ${contact.name}`}>
                    <Text style={s.muted}>Edit {contact.name}</Text>
                  </Pressable>
                ) : null}
              </View>
            </GroupBlock>
            ) : null}
            {history(key, past)}
          </Group>
        );
      })}

      {/* People with nothing out right now, grouped by how you know them. */}
      {idleGroups.map(({ id, title, people }, index) => (
        <Group
          key={`people-${id}`}
          title={title}
          footer={index === idleGroups.length - 1 ? 'Nothing of yours is with them right now.' : undefined}
        >
          {people.flatMap((contact) => {
            const key = String(contact.id);
            const past = pastByContact.get(contact.id) ?? [];
            return [
              <GroupBlock key={key}>
                <View style={s.row}>
                  <Pressable style={s.rowMain} onPress={() => setEditing(contact)} accessibilityRole="button" accessibilityLabel={`Edit ${contact.name}`}>
                    <View style={s.copy}>
                      <Text style={s.title}>{contact.name}</Text>
                      <Text style={s.meta}>
                        {past.length ? `Borrowed ${past.length} ${past.length === 1 ? 'time' : 'times'}` : 'Nothing borrowed yet'}
                      </Text>
                    </View>
                  </Pressable>
                  {historyToggle(key, past.length)}
                </View>
              </GroupBlock>,
              ...(history(key, past) ?? []),
            ];
          })}
        </Group>
      ))}

      {(pastByContact.get(null)?.length ?? 0) > 0 ? (
        <Group title="Past loans without a name">
          <GroupBlock>{historyToggle('past-unnamed', pastByContact.get(null)!.length)}</GroupBlock>
          {history('past-unnamed', pastByContact.get(null)!)}
        </Group>
      ) : null}
    </SettingsScaffold>
    <PersonSheet
      contact={editing}
      onClose={() => setEditing(null)}
      onSave={(patch) => { if (editing) updateContact.mutate({ id: editing.id, ...patch }); setEditing(null); }}
      onRemove={() => { if (editing) remove(editing); }}
    />
    <LendSheet
      visible={!!naming}
      items={naming ? [{ name: naming.name, uri: naming.uri }] : []}
      currentContactId={null}
      currentDueBack={naming?.loan?.dueBack ?? null}
      currentNote={naming?.loan?.note ?? null}
      lentAt={naming?.loan?.lentAt ?? null}
      onClose={() => setNaming(null)}
      onConfirm={(input: LendInput) => {
        if (naming) lendItems.mutate({ ...input, itemIds: [naming.itemId] });
        setNaming(null);
      }}
    />
    {toast}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  thumb: { width: 48, height: 60, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  thumbSmall: { width: 36, height: 45 },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.text.bodySmall, color: colors.foreground },
  meta: { ...typography.text.caption, color: colors.mutedForeground },
  overdue: { color: colors.destructive },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  link: { ...typography.text.bodySmall, color: colors.foreground, textDecorationLine: 'underline' },
  muted: { ...typography.text.bodySmall, color: colors.mutedForeground },
  inlineLink: { color: colors.foreground, textDecorationLine: 'underline' },
  returnPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.md,
    borderRadius: radii.full, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card,
  },
  returnPillLabel: { ...typography.text.caption, color: colors.foreground, fontWeight: '600' },
  swipeAction: {
    width: 96, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.primary,
  },
  swipeActionLabel: { ...typography.text.caption, color: colors.primaryForeground, fontWeight: '600' },
  lendButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, alignSelf: 'flex-start',
    minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: colors.primary,
  },
  lendButtonLabel: { ...typography.text.bodySmall, color: colors.primaryForeground, fontWeight: '600' },
});

/** Swipe a row left to mark it returned; the visible button does the same. */
function SwipeToReturn({ onReturn, registerOpen, children }: {
  onReturn: () => void;
  registerOpen: (row: SwipeableMethods | null) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => registerOpen(ref.current)}
      renderRightActions={() => (
        <Pressable
          style={s.swipeAction}
          onPress={() => { ref.current?.close(); onReturn(); }}
          accessibilityRole="button"
          accessibilityLabel="Mark as returned"
        >
          <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
          <Text style={s.swipeActionLabel}>Returned</Text>
        </Pressable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
