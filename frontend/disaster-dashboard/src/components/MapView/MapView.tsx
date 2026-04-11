import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { COLORS } from '../../theme';
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const getDamageColor = (subtype: string): string => ({
  'no-damage':    '#22c55e',
  'minor-damage': '#facc15',
  'major-damage': '#f97316',
  'destroyed':    '#ef4444',
}[subtype] ?? '#94a3b8');

const API_URL = 'http://localhost:8000';
const TILES = ['00000003', '00000011', '00000018', '00000023', '00000033'];

export const MapView: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);

  const [imageMode, setImageMode] = useState<'pre' | 'post'>('post');
  const [activeTile, setActiveTile] = useState('00000003');

  // Init map once
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    const map = L.map(mapRef.current).setView([29.760, -95.458], 16);
    mapInstanceRef.current = map;

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri' }
    ).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Reload GeoJSON when tile or mode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove old layer
    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.remove();
      geojsonLayerRef.current = null;
    }

    // Overlay pre and post disaster images on map

    // image dimensions
    const width = 1024;
    const height = 1024;

    const correctionLat = -0.00000;
    const correctionLng =  0.00000;

    // fetch image metadata (top left corner coordinates)
    fetch(`${API_URL}/data/metadata.json`)
    .then(r => r.json())
    .then(data => {
      // ensure mapInstanceRef.current is not null
      if (!mapInstanceRef.current) return;

      const image_name = `hurricane-harvey_${activeTile}_${imageMode}_disaster.png`;

      console.log(image_name);

      const img = new Image();
      img.onload = () => {
        console.log(img.width, img.height);
      };
      img.src = `${API_URL}/images/${image_name}`;

      const coordinates = data[image_name][0];

      const startX = coordinates[0];
      const pixelWidth = coordinates[1];
      const startY = coordinates[3];
      const pixelHeight = coordinates[5];

      const endX = startX + pixelWidth * (width);
      const endY = startY + pixelHeight * (height);

      const bounds = L.latLngBounds(
        [endY + correctionLat, startX + correctionLng],  //southwest
        [startY + correctionLat, endX + correctionLng]  //northeast
      );

      // Overlay the image
      L.imageOverlay(`${API_URL}/images/${image_name}`, bounds).addTo(mapInstanceRef.current);
    })
    .catch((err => console.error('Failed to load metadata:', err)));

    fetch(`${API_URL}/files/output_hurricane-harvey_${activeTile}_${imageMode}_disaster.geojson`)
      .then(r => r.json())
      .then(data => {
        if (!mapInstanceRef.current) return;

        const layer = L.geoJSON(data, {
          style: (feature) => ({
            fillColor: getDamageColor(feature?.properties?.subtype),
            //fillOpacity: 0.5,
            fillOpacity: 0,
            color: getDamageColor(feature?.properties?.subtype),
            weight: 1,
          }),
          onEachFeature: (feature, layer) => {
            layer.on('click', () => {
              console.log('clicked:', feature.properties);
            });
          }
        }).addTo(mapInstanceRef.current);

        geojsonLayerRef.current = layer;

        // Auto-pan map to where the new tile's buildings are
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
        }
      })
      .catch(err => console.error('Failed to load GeoJSON:', err));

  }, [activeTile, imageMode]);

  return (
    <Box sx={{ p: 3, height: '100%' }}>

      {/* Header */}
      <Box sx={{ mb: 2 }}>
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

      {/* Controls Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Pre/Post Toggle */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.65rem', color: COLORS.text.muted, letterSpacing: '0.1em', fontFamily: '"Space Mono", monospace' }}>
            MODE:
          </Typography>
          {(['pre', 'post'] as const).map((mode) => (
            <Box
              key={mode}
              onClick={() => setImageMode(mode)}
              sx={{
                px: 2, py: 0.8,
                borderRadius: 1,
                cursor: 'pointer',
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                border: `1px solid ${imageMode === mode ? COLORS.accent.cyan : COLORS.bg.border}`,
                color: imageMode === mode ? COLORS.accent.cyan : COLORS.text.muted,
                background: imageMode === mode ? `${COLORS.accent.cyan}15` : 'transparent',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                '&:hover': { borderColor: COLORS.accent.cyan, color: COLORS.accent.cyan },
              }}
            >
              {mode === 'pre' ? '◀ Pre' : 'Post ▶'}
            </Box>
          ))}
        </Box>

        {/* Divider */}
        <Box sx={{ width: '1px', height: 24, background: COLORS.bg.border }} />

        {/* Tile Selector */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.65rem', color: COLORS.text.muted, letterSpacing: '0.1em', fontFamily: '"Space Mono", monospace' }}>
            AREA:
          </Typography>
          {TILES.map((tile, index) => (
            <Box
              key={tile}
              onClick={() => setActiveTile(tile)}
              sx={{
                px: 1.5, py: 0.6,
                borderRadius: 1,
                cursor: 'pointer',
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.65rem',
                border: `1px solid ${activeTile === tile ? COLORS.accent.cyan : COLORS.bg.border}`,
                color: activeTile === tile ? COLORS.accent.cyan : COLORS.text.muted,
                background: activeTile === tile ? `${COLORS.accent.cyan}15` : 'transparent',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                '&:hover': { borderColor: COLORS.accent.cyan, color: COLORS.accent.cyan },
              }}
            >
              Zone {index + 1}
            </Box>
          ))}
        </Box>

        {/* Active mode badge */}
        <Box sx={{ ml: 'auto' }}>
          <Box sx={{
            px: 1.5, py: 0.5,
            borderRadius: 1,
            background: imageMode === 'post' ? '#ef444415' : '#22c55e15',
            border: `1px solid ${imageMode === 'post' ? '#ef444433' : '#22c55e33'}`,
          }}>
            <Typography sx={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.6rem',
              color: imageMode === 'post' ? '#ef4444' : '#22c55e',
              letterSpacing: '0.1em',
            }}>
              {imageMode === 'post' ? '⚠ POST-DISASTER VIEW' : '✓ PRE-DISASTER VIEW'}
            </Typography>
          </Box>
        </Box>

      </Box>

      {/* Map */}
      <Box
        ref={mapRef}
        sx={{
          height: 'calc(100vh - 280px)',
          width: '100%',
          borderRadius: 2,
          border: `1px solid ${COLORS.bg.border}`,
          overflow: 'hidden',
        }}
      />

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
        {[
          { label: 'No Damage',    color: '#22c55e' },
          { label: 'Minor Damage', color: '#facc15' },
          { label: 'Major Damage', color: '#f97316' },
          { label: 'Destroyed',    color: '#ef4444' },
          { label: 'Unclassified', color: '#94a3b8' },
        ].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: color, opacity: 0.8 }} />
            <Typography sx={{ fontSize: '0.65rem', color: COLORS.text.muted, fontFamily: '"Space Mono", monospace' }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

    </Box>
  );
};