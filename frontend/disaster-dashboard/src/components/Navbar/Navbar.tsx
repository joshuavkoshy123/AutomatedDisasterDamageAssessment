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
import LogoutIcon from '@mui/icons-material/Logout';
import { COLORS } from '../../theme';
import { useAuth } from '../../AuthContext';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  title: string;
  subtitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ title, subtitle }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

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

        {/* Right-side cluster */}
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

          {/* Logout */}
          <Tooltip title="Sign out" placement="bottom">
            <Box
              component="button"
              onClick={handleLogout}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                border: '1px solid',
                borderColor: `${COLORS.text.muted}44`,
                borderRadius: 1,
                backgroundColor: 'transparent',
                color: COLORS.text.muted,
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: COLORS.accent.red,
                  color: COLORS.accent.red,
                  backgroundColor: `${COLORS.accent.red}0f`,
                },
              }}
            >
              <LogoutIcon sx={{ fontSize: '0.85rem' }} />
              Sign Out
            </Box>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
