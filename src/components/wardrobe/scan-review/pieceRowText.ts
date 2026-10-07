import { colors, typography } from '../../../theme';

/** Type for piece rows in both review workspaces: a garment name over a quiet detail line. */
export const pieceRowText = {
  name: { ...typography.text.body, fontWeight: typography.weight.medium, color: colors.foreground },
  detail: { ...typography.text.caption, color: colors.mutedForeground },
} as const;
