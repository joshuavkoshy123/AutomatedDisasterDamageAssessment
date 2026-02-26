import { createTheme } from '@mui/material/styles';

// Dark tactical / emergency ops palette
const COLORS = {
  bg: {
    deepest: '#0a0c0f',
    dark: '#0f1318',
    panel: '#141920',
    card: '#1a2030',
    elevated: '#212d3d',
    border: '#2a3548',
  },
  accent: {
    cyan: '#00d4ff',
    cyanDim: '#0099bb',
    orange: '#ff6b2b',
    orangeDim: '#cc4400',
    green: '#00e676',
    greenDim: '#00a854',
    red: '#ff3d3d',
    redDim: '#cc2222',
    yellow: '#ffd600',
  },
  text: {
    primary: '#e8f0fe',
    secondary: '#8899bb',
    muted: '#4a5a7a',
    label: '#5a7a99',
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: COLORS.bg.deepest,
      paper: COLORS.bg.panel,
    },
    primary: {
      main: COLORS.accent.cyan,
      dark: COLORS.accent.cyanDim,
    },
    secondary: {
      main: COLORS.accent.orange,
    },
    success: {
      main: COLORS.accent.green,
    },
    error: {
      main: COLORS.accent.red,
    },
    warning: {
      main: COLORS.accent.yellow,
    },
    text: {
      primary: COLORS.text.primary,
      secondary: COLORS.text.secondary,
    },
    divider: COLORS.bg.border,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", sans-serif',
    h1: { fontFamily: '"Space Mono", monospace', fontWeight: 700 },
    h2: { fontFamily: '"Space Mono", monospace', fontWeight: 700 },
    h3: { fontFamily: '"Space Mono", monospace', fontWeight: 700 },
    h4: { fontFamily: '"Space Mono", monospace', fontWeight: 700 },
    h5: { fontFamily: '"Space Mono", monospace', fontWeight: 700 },
    h6: { fontFamily: '"Space Mono", monospace', fontWeight: 700 },
    overline: {
      fontFamily: '"Space Mono", monospace',
      letterSpacing: '0.15em',
      fontSize: '0.65rem',
    },
    caption: {
      fontFamily: '"Space Mono", monospace',
      fontSize: '0.7rem',
      letterSpacing: '0.05em',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: COLORS.bg.deepest,
          scrollbarColor: `${COLORS.bg.border} ${COLORS.bg.dark}`,
          '&::-webkit-scrollbar': { width: 6, height: 6 },
          '&::-webkit-scrollbar-track': { background: COLORS.bg.dark },
          '&::-webkit-scrollbar-thumb': {
            background: COLORS.bg.border,
            borderRadius: 3,
            '&:hover': { background: COLORS.bg.elevated },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: COLORS.bg.dark,
          borderRight: `1px solid ${COLORS.bg.border}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: COLORS.bg.dark,
          borderBottom: `1px solid ${COLORS.bg.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: COLORS.bg.card,
          border: `1px solid ${COLORS.bg.border}`,
          backgroundImage: 'none',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: '"Space Mono", monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.72rem',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${COLORS.bg.border}`,
        },
        head: {
          fontFamily: '"Space Mono", monospace',
          fontSize: '0.68rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLORS.text.label,
          backgroundColor: COLORS.bg.dark,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Space Mono", monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.05em',
        },
      },
    },
  },
});

export { COLORS };
