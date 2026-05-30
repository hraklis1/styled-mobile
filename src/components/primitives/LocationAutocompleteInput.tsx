import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NominatimResult {
  display_name: string;
  address: {
    amenity?: string;
    building?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    state?: string;
    region?: string;
    country_code?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNominatimResult(result: NominatimResult): string {
  const a = result.address;
  const parts: string[] = [];

  const primary = a.amenity || a.building || a.road || a.suburb || a.neighbourhood;
  const city = a.city || a.town || a.village || a.hamlet;
  const region = a.state || a.region;
  const country = a.country_code?.toUpperCase();

  if (primary) parts.push(primary);
  if (city && city !== primary) parts.push(city);
  if (region && region !== city) parts.push(region);
  if (country) parts.push(country);

  return parts.length > 0 ? parts.join(', ') : result.display_name;
}

function formatReverseGeocode(geo: Location.LocationGeocodedAddress): string {
  const parts: string[] = [];
  if (geo.city) parts.push(geo.city);
  else if (geo.subregion) parts.push(geo.subregion);
  if (geo.region) parts.push(geo.region);
  if (geo.isoCountryCode) parts.push(geo.isoCountryCode);
  return parts.join(', ');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocationAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (location: string) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

export function LocationAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  placeholder = 'Search location…',
  containerStyle,
  autoFocus,
}: LocationAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Styled-mobile/1.0' },
      });
      const data: NominatimResult[] = await res.json();
      const formatted = data.map(formatNominatimResult);
      // Deduplicate
      setSuggestions([...new Set(formatted)].slice(0, 5));
    } catch {
      // aborted or network error — leave suggestions as-is
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, search]);

  const handleSelect = useCallback(
    (loc: string) => {
      onSelect(loc);
      setSuggestions([]);
      setDropdownOpen(false);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const handleUseMyLocation = async () => {
    setGeolocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeolocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (results.length > 0) {
        const formatted = formatReverseGeocode(results[0]);
        if (formatted) handleSelect(formatted);
      }
    } catch {
      // silently fail — user can still type
    } finally {
      setGeolocating(false);
    }
  };

  const showDropdown = dropdownOpen && suggestions.length > 0;

  const handleBlur = () => {
    setTimeout(() => {
      setDropdownOpen(false);
    }, 150);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={autoFocus}
          style={styles.input}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.geoBtn}
          onPress={handleUseMyLocation}
          disabled={geolocating}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {geolocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="navigate-outline" size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
        {searching && !geolocating && (
          <ActivityIndicator size="small" color={colors.mutedForeground} style={styles.spinner} />
        )}
      </View>

      {showDropdown && (
        <ScrollView
          style={styles.dropdown}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {suggestions.map((loc, i) => (
            <TouchableOpacity
              key={`${loc}-${i}`}
              style={[styles.suggestion, i === suggestions.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => handleSelect(loc)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={13} color={colors.mutedForeground} style={styles.suggestionIcon} />
              <Text style={styles.suggestionText} numberOfLines={2}>{loc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  geoBtn: {
    marginLeft: spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginLeft: spacing.xs,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  suggestionIcon: {
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.4,
  },
});
