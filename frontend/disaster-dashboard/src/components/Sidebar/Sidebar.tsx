import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Tooltip,
} from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import { COLORS } from '../../theme';

const DRAWER_WIDTH = 240;

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    label: 'Geo Map',
    icon: <MapOutlinedIcon />,
    description: 'Aerial imagery & overlays',
  },
  {
    path: '/evaluation',
    label: 'Evaluation',
    icon: <AssessmentOutlinedIcon />,
    description: 'Model vs FEMA metrics',
  },
  {
    path: '/upload',
    label: 'Upload',
    icon: <ChatBubbleOutlineIcon />,
    description: 'Upload Pre and Post Disaster',
  },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: COLORS.bg.dark,
          borderRight: `1px solid ${COLORS.bg.border}`,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Logo / Brand */}
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: `1px solid ${COLORS.bg.border}`,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '4px',
            background: `linear-gradient(135deg, ${COLORS.accent.cyan} 0%, ${COLORS.accent.orange} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BoltIcon sx={{ fontSize: 18, color: '#000' }} />
        </Box>
        <Box>
          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: COLORS.text.primary,
              letterSpacing: '0.05em',
              lineHeight: 1.2,
            }}
          >
            DISASTERSIGHT
          </Typography>
          <Typography
            variant="overline"
            sx={{ color: COLORS.text.muted, fontSize: '0.55rem', lineHeight: 1 }}
          >
            DAMAGE ASSESSMENT
          </Typography>
        </Box>
      </Box>

      {/* Active Mission Badge */}
      <Box
        sx={{
          mx: 2,
          my: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 1,
          backgroundColor: `${COLORS.accent.orange}18`,
          border: `1px solid ${COLORS.accent.orangeDim}44`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: COLORS.accent.orange,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.3 },
            },
          }}
        />
        <Box>
          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.6rem',
              color: COLORS.accent.orange,
              letterSpacing: '0.1em',
              fontWeight: 700,
            }}
          >
            ACTIVE MISSION
          </Typography>
          <Typography
            sx={{ fontSize: '0.7rem', color: COLORS.text.secondary, lineHeight: 1.2 }}
          >
            Hurricane Harvey
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: COLORS.bg.border, mx: 2 }} />

      {/* Navigation */}
      <List sx={{ px: 1, py: 1.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip key={item.path} title={item.description} placement="right" arrow>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 1,
                    py: 1,
                    px: 1.5,
                    backgroundColor: isActive
                      ? `${COLORS.accent.cyan}15`
                      : 'transparent',
                    border: isActive
                      ? `1px solid ${COLORS.accent.cyan}33`
                      : '1px solid transparent',
                    '&:hover': {
                      backgroundColor: `${COLORS.accent.cyan}0d`,
                      border: `1px solid ${COLORS.accent.cyan}22`,
                    },
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: isActive ? COLORS.accent.cyan : COLORS.text.secondary,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.82rem',
                      fontFamily: '"Space Mono", monospace',
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? COLORS.accent.cyan : COLORS.text.secondary,
                      letterSpacing: '0.03em',
                    }}
                  />
                  {isActive && (
                    <Box
                      sx={{
                        width: 3,
                        height: 20,
                        borderRadius: 2,
                        backgroundColor: COLORS.accent.cyan,
                        boxShadow: `0 0 8px ${COLORS.accent.cyan}`,
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={{ borderColor: COLORS.bg.border, mx: 2 }} />

      {/* Footer stats */}
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography variant="overline" sx={{ color: COLORS.text.muted, display: 'block', mb: 1 }}>
          DATASET
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: COLORS.text.label }}>Buildings</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: COLORS.text.primary, fontFamily: '"Space Mono", monospace' }}>
            7,715
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: COLORS.text.label }}>Model Acc.</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: COLORS.accent.green, fontFamily: '"Space Mono", monospace' }}>
            62.8%
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.7rem', color: COLORS.text.label }}>Ground Truth</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: COLORS.accent.cyan, fontFamily: '"Space Mono", monospace' }}>
            FEMA
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};
