import Inter400Regular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf';
import Inter500Medium from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf';
import Inter600SemiBold from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf';
import Inter700Bold from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf';

export const fontAssets = {
  Inter_400Regular: Inter400Regular,
  Inter_500Medium: Inter500Medium,
  Inter_600SemiBold: Inter600SemiBold,
  Inter_700Bold: Inter700Bold,
} as const;

export const fontFamily = {
  bold: 'Inter_700Bold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const;
