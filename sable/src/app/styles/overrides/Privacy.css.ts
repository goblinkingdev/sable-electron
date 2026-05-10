import { globalStyle } from '@vanilla-extract/css';

const blurEffect = {
  filter: 'blur(25px) grayscale(100%)',
  transition: 'filter 0.2s ease-in-out, opacity 0.2s ease-in-out',
  opacity: 0.7,
};

const unblurEffect = {
  filter: 'blur(0) grayscale(0)',
  opacity: 1,
};

// media blur
globalStyle(
  `.sable-blur-media img:not([class*="Avatar"]):not([class*="Emoticon"]), .sable-blur-media video`,
  blurEffect
);
globalStyle(
  `.sable-blur-media img:not([class*="Avatar"]):not([class*="Emoticon"]):hover, .sable-blur-media video:hover`,
  unblurEffect
);

// avatar blur
globalStyle(`.sable-blur-avatars [class*="Avatar"]`, blurEffect);
globalStyle(`.sable-blur-avatars [class*="Avatar"]:hover`, unblurEffect);

// emote blur
globalStyle(`.sable-blur-emotes [class*="Emoticon"]`, blurEffect);
globalStyle(`.sable-blur-emotes [class*="Emoticon"]:hover`, unblurEffect);
