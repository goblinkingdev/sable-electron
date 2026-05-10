import { style, globalStyle } from '@vanilla-extract/css';
import { config } from 'folds';

export const BioEditorContainer = style({
  backgroundColor: 'var(--sable-bg-container)',
  borderRadius: config.radii.R400,
  overflow: 'hidden',
});

globalStyle(`${BioEditorContainer} div[class*="EditorTextarea"]`, {
  backgroundColor: 'var(--sable-bg-container) !important',
  border: 'none !important',
});

globalStyle(`${BioEditorContainer} [class*="Toolbar"]`, {
  backgroundColor: 'var(--sable-bg-container) !important',
  padding: 'var(--space-S100) !important',
  borderTop: '1px solid var(--sable-outline-variant) !important',
});

globalStyle(`${BioEditorContainer} [class*="Toolbar"] button`, {
  backgroundColor: 'transparent !important',
  boxShadow: 'none !important',
});

globalStyle(`${BioEditorContainer} [class*="Toolbar"] button:hover`, {
  backgroundColor: 'var(--sable-surface-variant) !important',
});
