export type User = {
  id: number;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  isPremium: boolean;
  onboardingComplete: boolean;
  authProvider: 'local' | 'google' | 'apple' | null;
};
