import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { COLORS } from '../../theme';

interface NavbarProps {
  title: string;
  subtitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ title, subtitle }) => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: COLORS.bg.dark,
        borderBottom: `1px solid ${COLORS.bg.border}`,
      }}
    >
      <Toolbar sx={{ minHeight: '56px !important', px: 3, gap: 2 }}>
        {/* Page title */}
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: COLORS.text.primary,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: '0.7rem', color: COLORS.text.secondary }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Status badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            label="VLM: ONLINE"
            size="small"
            sx={{
              backgroundColor: `${COLORS.accent.green}18`,
              color: COLORS.accent.green,
              border: `1px solid ${COLORS.accent.green}44`,
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.6rem',
              height: 22,
              '& .MuiChip-label': { px: 1 },
            }}
          />
          <Chip
            label="FEMA DATA: LOADED"
            size="small"
            sx={{
              backgroundColor: `${COLORS.accent.cyan}18`,
              color: COLORS.accent.cyan,
              border: `1px solid ${COLORS.accent.cyan}44`,
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.6rem',
              height: 22,
              '& .MuiChip-label': { px: 1 },
            }}
          />

          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.7rem',
              color: COLORS.text.muted,
              minWidth: 75,
              textAlign: 'right',
            }}
          >
            {timeStr}
          </Typography>

          <Tooltip title="Notifications">
            <IconButton size="small" sx={{ color: COLORS.text.secondary }}>
              <NotificationsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Help">
            <IconButton size="small" sx={{ color: COLORS.text.secondary }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
