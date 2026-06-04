export type User = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  isPremium: boolean;
  onboardingComplete: boolean;
  authProvider: 'local' | 'google' | 'apple' | null;
};
