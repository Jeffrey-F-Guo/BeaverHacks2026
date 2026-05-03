import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  DISPLAY_LG: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  HEADLINE_H1: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
  },
  HEADLINE_H2: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 22,
    lineHeight: 28,
  },
  BODY_READING: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 16,
    lineHeight: 26,
  },
  UI_LABEL: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  UI_BUTTON: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 13,
    letterSpacing: 0.26,
  },
  METADATA: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
};
