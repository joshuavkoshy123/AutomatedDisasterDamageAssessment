import React from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import { COLORS } from '../../theme';

export const MapView: React.FC = () => {
  return (
    <Box sx={{ p: 3, height: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="overline"
          sx={{ color: COLORS.accent.cyan, letterSpacing: '0.2em', fontSize: '0.65rem' }}
        >
          GEOSPATIAL DASHBOARD ／ AERIAL IMAGERY OVERLAY
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Space Mono", monospace',
            fontWeight: 700,
            fontSize: '1.4rem',
            color: COLORS.text.primary,
            mt: 0.5,
          }}
        >
          Interactive Damage Map
        </Typography>
      </Box>

      <Card
        sx={{
          height: 'calc(100vh - 220px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `repeating-linear-gradient(
            45deg,
            ${COLORS.bg.card},
            ${COLORS.bg.card} 10px,
            ${COLORS.bg.elevated} 10px,
            ${COLORS.bg.elevated} 20px
          )`,
          border: `2px dashed ${COLORS.bg.border}`,
        }}
      >
        <CardContent sx={{ textAlign: 'center' }}>
          <MapOutlinedIcon sx={{ fontSize: 64, color: COLORS.text.muted, mb: 2 }} />
          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              color: COLORS.text.secondary,
              mb: 1,
            }}
          >
            Geospatial Map — Coming Next Sprint
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: COLORS.text.muted, mb: 2 }}>
            Leaflet map with damage overlay markers will render here.
            <br />
            Connect to backend API to load building GeoJSON.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Leaflet.js', 'GeoJSON Overlay', 'Pre/Post Toggle', 'Address Search'].map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                sx={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '0.6rem',
                  backgroundColor: `${COLORS.accent.cyan}12`,
                  color: COLORS.accent.cyan,
                  border: `1px solid ${COLORS.accent.cyan}33`,
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
