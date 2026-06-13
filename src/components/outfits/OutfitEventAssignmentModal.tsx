import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAssignOutfitEvents } from '../../hooks/useOutfits';
import { getUpcomingEvents, parseEventDate } from '../../lib/outfitAssignments';
import { colors, radii, spacing, typography } from '../../theme';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';

export function OutfitEventAssignmentModal({
  outfit,
  outfits,
  events,
  visible,
  onClose,
}: {
  outfit: Outfit;
  outfits: Outfit[];
  events: Event[];
  visible: boolean;
  onClose: () => void;
}) {
  const assignEvents = useAssignOutfitEvents();
  const upcomingEvents = useMemo(() => getUpcomingEvents(events), [events]);
  const outfitNames = useMemo(() => new Map(outfits.map((entry) => [entry.id, entry.name])), [outfits]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(upcomingEvents.filter((event) => event.outfitId === outfit.id).map((event) => event.id)));
  }, [outfit.id, upcomingEvents, visible]);

  const toggle = (eventId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
      return next;
    });
  };

  const save = () => {
    const replacements = upcomingEvents.filter(
      (event) => selected.has(event.id) && event.outfitId != null && event.outfitId !== outfit.id,
    );
    const commit = () => assignEvents.mutate(
      { outfitId: outfit.id, eventIds: Array.from(selected) },
      { onSuccess: onClose },
    );

    if (replacements.length === 0) {
      commit();
      return;
    }

    Alert.alert(
      'Replace assigned outfits?',
      `${replacements.length} selected event${replacements.length === 1 ? '' : 's'} already ${replacements.length === 1 ? 'has' : 'have'} another outfit. Replace ${replacements.length === 1 ? 'it' : 'them'} with "${outfit.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', onPress: commit },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerSide}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add to events</Text>
          <TouchableOpacity
            onPress={save}
            disabled={assignEvents.isPending}
            style={[styles.headerSide, styles.headerRight]}
          >
            {assignEvents.isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.save}>Save</Text>}
          </TouchableOpacity>
        </View>

        {upcomingEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={28} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptyText}>Add an event in Calendar, then attach this outfit here.</Text>
          </View>
        ) : (
          <FlatList
            data={upcomingEvents}
            keyExtractor={(event) => String(event.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item: event }) => {
              const isSelected = selected.has(event.id);
              const otherOutfit = event.outfitId != null && event.outfitId !== outfit.id
                ? outfitNames.get(event.outfitId)
                : null;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => toggle(event.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${event.title}, ${parseEventDate(event.date).toLocaleDateString()}`}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? colors.primary : colors.mutedForeground}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {parseEventDate(event.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                    {otherOutfit ? <Text style={styles.replacement}>Currently uses {otherOutfit}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 70 },
  headerRight: { alignItems: 'flex-end' },
  cancel: { color: colors.mutedForeground, fontSize: typography.size.md },
  title: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  save: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  list: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  rowBody: { flex: 1, gap: 2 },
  eventTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  eventMeta: { color: colors.mutedForeground, fontSize: typography.size.xs },
  replacement: { color: colors.primary, fontSize: typography.size.xs, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  emptyText: { color: colors.mutedForeground, fontSize: typography.size.sm, textAlign: 'center' },
});
