import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { COLORS } from '../../theme';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mockBuildings, getDamageColor } from '../../data/mockData';
export const MapView: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    const map = L.map(mapRef.current).setView([29.7604, -95.3698], 12);
    mapInstanceRef.current = map;

    // Satellite tiles — free, no API key needed
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri' }
    ).addTo(map);
    // Convert your Building array to GeoJSON on the fly
mockBuildings.forEach((building) => {
  const color = getDamageColor(building.damageLevel);
  
  L.circleMarker([building.lat, building.lng], {
    radius: 10,
    fillColor: color,
    color: "#000",
    weight: 1,
    fillOpacity: 0.85,
  })
  .bindTooltip(building.address, { direction: 'top' })
  .on("click", () => {
    console.log("clicked:", building);
  })
  .addTo(map);
});
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

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

      {/* Map container — Leaflet owns this div */}
      <Box
        ref={mapRef}
        sx={{
          height: 'calc(100vh - 220px)',
          width: '100%',
          borderRadius: 2,
          border: `1px solid ${COLORS.bg.border}`,
          overflow: 'hidden',
        }}
      />
    </Box>
  );
};