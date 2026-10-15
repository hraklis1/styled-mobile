import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, type StyleProp, Text, TouchableOpacity, type ViewStyle, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { conversationLocation, type StylingLocationContext } from '../../lib/stylingLocation';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { colors, spacing } from '../../theme';
import { styles } from './ChatStyles';

type StylistOverlaySheetProps = {
  visible: boolean;
  bottomInset: number;
  onClose: () => void;
  onDismiss?: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared transparent sheet shell for Stylist overlays. The modal owns its
 * gesture root because React Native presents Modal content in a separate
 * native window from the screen that opened it.
 */
export function StylistOverlaySheet({
  visible,
  bottomInset,
  onClose,
  onDismiss,
  children,
  sheetStyle,
}: StylistOverlaySheetProps) {
  const [mounted, setMounted] = useState(visible);
  const sheetProgress = useSharedValue(0);
  const backdropProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closeNotifyRef = useRef(false);
  const pendingDismissRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const notifyDismiss = useCallback(() => {
    if (!pendingDismissRef.current) return;
    pendingDismissRef.current = false;
    onDismiss?.();
  }, [onDismiss]);

  useEffect(() => {
    if (!mounted && Platform.OS !== 'ios') notifyDismiss();
  }, [mounted, notifyDismiss]);

  const finishClose = useCallback(() => {
    pendingDismissRef.current = true;
    setMounted(false);
    sheetProgress.value = 0;
    backdropProgress.value = 0;
    dragY.value = 0;
    if (closeNotifyRef.current) {
      closeNotifyRef.current = false;
      onClose();
    }
  }, [backdropProgress, dragY, onClose, sheetProgress]);

  const animateClose = useCallback((notifyParent: boolean) => {
    closeNotifyRef.current = notifyParent;
    sheetProgress.value = withTiming(0, { duration: reducedMotion ? 0 : 220 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropProgress.value = withTiming(0, { duration: 180 });
    dragY.value = withTiming(0, { duration: 180 });
  }, [backdropProgress, dragY, finishClose, sheetProgress, reducedMotion]);

  useEffect(() => {
    if (visible) {
      closeNotifyRef.current = false;
      setMounted(true);
      sheetProgress.value = 0;
      backdropProgress.value = 0;
      dragY.value = 0;
      sheetProgress.value = withTiming(1, { duration: 260 });
      backdropProgress.value = withTiming(1, { duration: 260 });
    } else if (mounted) {
      animateClose(false);
    }
    // The controlled `visible` transition is the only event that should start
    // this animation; the animated values themselves update on the UI thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismissByDrag = useCallback(() => {
    closeNotifyRef.current = true;
    dragY.value = withTiming(440, { duration: 220 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropProgress.value = withTiming(0, { duration: 180 });
  }, [backdropProgress, dragY, finishClose]);

  const dragGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY(8)
      .failOffsetX([-24, 24])
      .onUpdate((event) => {
        dragY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        if (event.translationY > 72 || event.velocityY > 700) runOnJS(dismissByDrag)();
        else dragY.value = withSpring(0, { damping: 18, stiffness: 180 });
      }),
    [dismissByDrag, dragY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(sheetProgress.value, [0, 1], [440, 0]) + dragY.value,
    }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropProgress.value }));

  return (
    <Modal visible={mounted} transparent animationType="none" onDismiss={notifyDismiss} onRequestClose={() => animateClose(true)}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <View style={styles.stylistSheetModal}>
          <Reanimated.View style={[styles.stylistSheetBackdrop, backdropAnimatedStyle]} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose(true)} />
          </Reanimated.View>
          <Reanimated.View
            style={[styles.attachmentSheet, styles.stylistSheet, sheetStyle, { paddingBottom: bottomInset + spacing.lg }, sheetAnimatedStyle]}
          >
            <GestureDetector gesture={dragGesture}>
              <Reanimated.View
                style={styles.stylistSheetDragRegion}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Drag down to close sheet"
              >
                <View style={styles.sheetGrabber} />
              </Reanimated.View>
            </GestureDetector>
            {children}
          </Reanimated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function ConversationLocationPicker({
  visible,
  activeLocation,
  homeLocation,
  everydayLocation,
  permissionStatus,
  onRequestCurrent,
  onSelect,
  onClose,
}: {
  visible: boolean;
  activeLocation: StylingLocationContext;
  homeLocation?: string;
  everydayLocation: StylingLocationContext;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  onRequestCurrent: () => Promise<unknown>;
  onSelect: (location: StylingLocationContext | null) => void;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState('');
  const isElsewhere = activeLocation.source === 'conversation';
  const hereLabel = everydayLocation.label?.trim();
  // Home is only worth offering when it is somewhere other than where you are.
  const homeIsElsewhere = Boolean(
    homeLocation?.trim()
    && everydayLocation.source === 'current'
    && hereLabel
    && homeLocation.trim().toLowerCase() !== hereLabel.toLowerCase(),
  );

  useEffect(() => {
    if (visible) setDestination('');
  }, [visible]);

  const chooseHere = async () => {
    if (!hereLabel && permissionStatus !== 'granted') {
      const status = await onRequestCurrent();
      if (status !== 'granted') return;
    }
    onSelect(null);
  };

  const chooseElsewhere = (label: string) => {
    if (label.trim()) onSelect(conversationLocation(label));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.locationPicker} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.locationPickerHeader}>
          <View style={styles.locationPickerHeaderCopy}>
            <Text style={styles.locationPickerTitle}>Where are we dressing for?</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Close location picker">
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.locationChoice, !isElsewhere && styles.locationChoiceActive]}
          onPress={chooseHere}
          accessibilityState={{ selected: !isElsewhere }}
        >
          <Ionicons name="navigate-outline" size={18} color={colors.primary} />
          <View style={styles.locationChoiceCopy}>
            <Text style={styles.locationChoiceTitle}>{isElsewhere && hereLabel ? `Back to ${hereLabel.split(',')[0]}` : 'Where you are'}</Text>
            <Text style={styles.locationChoiceHint}>
              {hereLabel || (permissionStatus === 'granted' ? 'Finding you…' : 'Turn on location')}
            </Text>
          </View>
          {!isElsewhere ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
        </TouchableOpacity>

        {homeIsElsewhere ? (
          <TouchableOpacity style={styles.locationChoice} onPress={() => chooseElsewhere(homeLocation!)}>
            <Ionicons name="home-outline" size={18} color={colors.primary} />
            <View style={styles.locationChoiceCopy}>
              <Text style={styles.locationChoiceTitle}>Home</Text>
              <Text style={styles.locationChoiceHint}>{homeLocation}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.destinationCard, isElsewhere && styles.locationChoiceActive]}>
          <Text style={styles.locationChoiceTitle}>
            {isElsewhere ? activeLocation.label : 'Somewhere else'}
          </Text>
          <Text style={styles.locationChoiceHint}>Just for this chat. You can also mention a trip in your message.</Text>
          <LocationAutocompleteInput
            value={destination}
            onChangeText={setDestination}
            onSelect={chooseElsewhere}
            placeholder={isElsewhere ? 'Search another city' : 'Search a city'}
            showUseMyLocation={false}
          />
          {destination.trim() ? (
            <TouchableOpacity style={styles.destinationButton} onPress={() => chooseElsewhere(destination)}>
              <Text style={styles.destinationButtonText}>Style for {destination.trim().split(',')[0]}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
