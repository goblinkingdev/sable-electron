import { useMemo } from 'react';
import { CaptionPosition } from '$state/settings';

export type MessageLayoutItem = {
  name: string;
  layout: CaptionPosition;
};

export const useCaptionPositionItems = (): MessageLayoutItem[] =>
  useMemo(
    () => [
      {
        layout: CaptionPosition.Above,
        name: 'Above',
      },
      {
        layout: CaptionPosition.Inline,
        name: 'Inline',
      },
      {
        layout: CaptionPosition.Hidden,
        name: 'Hidden',
      },
      {
        layout: CaptionPosition.Below,
        name: 'Below',
      },
    ],
    []
  );
