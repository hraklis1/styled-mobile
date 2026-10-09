import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsScaffold, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import { PersonSheet } from '../../components/lending/PersonSheet';
import { useItems } from '../../hooks/useItems';
import {
  useDeleteLendContact, useLendContacts, useLoans, useReturnItem, useUpdateLendContact,
} from '../../hooks/useLendContacts';
import { itemThumbUri } from '../../lib/itemImage';
import {
  isLentNow, loanImageFields, localYmd, openLoanStatus, pastLoanRange, relationshipLabel,
  type ItemLoan, type LendContact,
} from '../../lib/lending';
import type { LentOutScreenProps } from '../../navigation/types';
import { colors, radii, spacing, typography } from '../../theme';

/** A piece that is out right now, whether or not it has a loan row (older lends don't). */
type OutRow = { itemId: number; name: string; uri?: string; loan: ItemLoan | null };

/**
 * Who has what, and who has had what. Pieces that are out now are grouped by
 * person (overdue first, then longest out); each person's past loans fold out
 * beneath. People with nothing out right now are listed with their history.
 */
export function LentOutScreen({ navigation }: LentOutScreenProps) {
  const { data: items = [] } = useItems();
  const { data: contacts = [] } = useLendContacts();
  const { data: loans = [], isLoading } = useLoans();
  const returnItem = useReturnItem();
  const updateContact = useUpdateLendContact();
  const deleteContact = useDeleteLendContact();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LendContact | null>(null);
  const today = localYmd();
  // SettingsScaffold is built for page sheets; a full-screen push needs the status-bar inset.
  const insets = useSafeAreaInsets();

  const { outGroups, pastByContact, idle } = useMemo(() => {
    const lentItems = items.filter(isLentNow);
    const lentIds = new Set(lentItems.map((i) => i.id));
    const openByItem = new Map(loans.filter((l) => !l.returnedAt && lentIds.has(l.itemId)).map((l) => [l.itemId, l]));
    const known = (id: number | null) => (id != null && contacts.some((c) => c.id === id) ? id : null);

    const out = new Map<number | null, OutRow[]>();
    for (const item of lentItems) {
      const loan = openByItem.get(item.id) ?? null;
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
    for (const loan of loans) {
      if (!loan.returnedAt) continue;
      const key = known(loan.contactId);
      pastByContact.set(key, [...(pastByContact.get(key) ?? []), loan]);
    }
    const idle = contacts.filter((c) => !out.has(c.id));
    return { outGroups, pastByContact, idle };
  }, [items, loans, contacts, today]);

  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

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
          <Text style={s.meta}>{pastLoanRange(loan)}</Text>
        </View>
      </Pressable>
    </GroupBlock>
  )) : null);

  const historyToggle = (key: string, count: number) => (count ? (
    <Pressable onPress={() => toggle(key)} style={s.action} accessibilityRole="button" accessibilityState={{ expanded: expanded.has(key) }}>
      <Text style={s.muted}>{expanded.has(key) ? 'Hide history' : `History (${count})`}</Text>
    </Pressable>
  ) : null);

  const totalOut = outGroups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
    <SettingsScaffold
      title="Lent out"
      lede={totalOut
        ? `${totalOut} ${totalOut === 1 ? 'piece is' : 'pieces are'} with other people. The stylist leaves them out until they're back.`
        : 'Nothing is lent out right now. Lend a piece from its options menu.'}
    >
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
                  <View style={s.row}>
                    <Pressable style={s.rowMain} onPress={() => openItem(row.itemId)} accessibilityRole="button" accessibilityLabel={`Open ${row.name}`}>
                      <View style={s.thumb}>{row.uri ? <Image source={{ uri: row.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
                      <View style={s.copy}>
                        <Text style={s.title} numberOfLines={2}>{row.name}</Text>
                        {status ? <Text style={[s.meta, status.overdue && s.overdue]}>{status.text}</Text> : null}
                      </View>
                    </Pressable>
                    <Pressable onPress={() => returnItem.mutate(row.itemId)} style={s.action} accessibilityRole="button" accessibilityLabel={`Mark ${row.name} as returned`}>
                      <Text style={s.link}>Returned</Text>
                    </Pressable>
                  </View>
                </GroupBlock>
              );
            })}
            {rows.length > 1 || past.length > 0 || contact ? (
            <GroupBlock>
              <View style={s.footerRow}>
                {rows.length > 1 ? (
                  <Pressable onPress={() => rows.forEach((r) => returnItem.mutate(r.itemId))} style={s.action} accessibilityRole="button">
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

      {idle.length > 0 ? (
        <Group title="Your people" footer="Nothing of yours is with them right now.">
          {idle.flatMap((contact) => {
            const key = String(contact.id);
            const past = pastByContact.get(contact.id) ?? [];
            return [
              <GroupBlock key={key}>
                <View style={s.row}>
                  <Pressable style={s.rowMain} onPress={() => setEditing(contact)} accessibilityRole="button" accessibilityLabel={`Edit ${contact.name}`}>
                    <View style={s.copy}>
                      <Text style={s.title}>{contact.name}</Text>
                      <Text style={s.meta}>
                        {relationshipLabel(contact.relationship)}
                        {past.length ? ` · borrowed ${past.length} ${past.length === 1 ? 'time' : 'times'}` : ''}
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
      ) : null}

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
});
