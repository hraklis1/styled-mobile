# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Styled mobile app. Here's a summary of what was done:

- **`posthog-react-native`** was already installed; `react-native-svg` (required peer dependency) was added via `npx expo install`.
- **Environment variables** `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` are now set in `.env`.
- **`src/lib/analytics.ts`** was updated to read the host from `EXPO_PUBLIC_POSTHOG_HOST` and enable `captureAppLifecycleEvents`.
- **`App.tsx`** now wraps the app in `<PostHogProvider client={posthog} autocapture={{ captureScreens: false, captureTouches: true }}>`, enabling touch autocapture (screen tracking is handled manually, as required for React Navigation v7).
- **User identification** was already in place via `AuthContext.tsx` — `posthog.identify()` is called on every `SIGNED_IN` event and `posthog.reset()` on `SIGNED_OUT`.
- **13 new business events** were instrumented across 10 files.

## Events

| Event | Description | File |
|---|---|---|
| `item_scan_started` | User initiates an AI scan via camera or photo library | `src/components/wardrobe/ScanItemSheet.tsx` |
| `wardrobe_items_added` | AI-detected items confirmed and saved to wardrobe; includes `item_count` | `src/components/wardrobe/ScanItemSheet.tsx` |
| `wardrobe_item_added_manually` | Item saved via the manual entry form; includes `category` | `src/components/AddActionSheet.tsx` |
| `outfit_created` | Outfit saved in the Outfit Builder; includes `item_count` | `src/components/outfits/OutfitBuilderSheet.tsx` |
| `outfit_logged` | Outfit logged as worn via the Log Outfit sheet; includes `item_count` | `src/components/outfits/LogOutfitSheet.tsx` |
| `stylist_message_sent` | User sends a message to the AI Stylist; includes `input_type` (text/voice/photo) | `src/components/stylist/StylistChatView.tsx` |
| `outfit_saved_to_wishlist` | AI Stylist shop outfit saved to user's wishlist | `src/components/stylist/StylistChatView.tsx` |
| `outfit_suggestion_generated` | Outfit suggestion requested; includes `weather` and `occasion` | `src/screens/app/SuggestionsScreen.tsx` |
| `outfit_suggestion_saved` | Generated outfit suggestion saved; includes `occasion` | `src/screens/app/SuggestionsScreen.tsx` |
| `login_error` | Login attempt failed; includes `provider` (email/google/apple) and `error` message | `src/screens/auth/LoginScreen.tsx` |
| `profile_updated` | User saved style profile changes | `src/hooks/useProfileForm.ts` |
| `calendar_event_created` | Calendar event created; includes `occasion` | `src/components/calendar/EventFormModal.tsx` |
| `outfit_viewed` | Outfit detail screen opened (top of outfit engagement funnel); includes `outfit_id` | `src/screens/app/OutfitDetailScreen.tsx` |

Pre-existing events left untouched: `user_logged_in` (AuthContext), `onboarding_completed` (OnboardingScreen), `stylist_opened` (StylistScreen).

## Next steps

We've built a dashboard with five insights for you to keep an eye on user behavior:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/464149/dashboard/1694197)

### Insights

- [Wardrobe items added](https://us.posthog.com/project/464149/insights/xG4kdwwn) — AI scan vs manual entry over 30 days
- [Onboarding funnel](https://us.posthog.com/project/464149/insights/Xkf3UbDN) — Login → onboarding completion conversion
- [AI Stylist engagement](https://us.posthog.com/project/464149/insights/n6N00rLu) — Stylist opens, messages sent, outfits to wishlist
- [Outfit actions](https://us.posthog.com/project/464149/insights/B3pnif6h) — Outfits created vs logged as worn
- [Login errors by provider](https://us.posthog.com/project/464149/insights/SZ63VMgF) — Auth failures broken down by provider

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
