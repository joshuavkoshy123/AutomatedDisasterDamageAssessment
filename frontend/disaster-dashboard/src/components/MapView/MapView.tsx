import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Chip, Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { COLORS } from '../../theme';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ChatMessage } from '../../types';
import { doc, DocumentData, DocumentSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { GeoJsonObject } from 'geojson';
function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAWER_WIDTH = 400;
const TILES = ['00000003', '00000011', '00000018', '00000023', '00000033', '00000036', '00000037', '00000044', '00000058', '00000062', '00000063', '00000064', '00000068', '00000078', '00000096', '00000097', '00000103', '00000105', '00000112', '00000120', '00000122', '00000127', '00000131', '00000133', '00000135', '00000139', '00000143', '00000150', '00000155', '00000161', '00000162', '00000163', '00000173', '00000179', '00000182', '00000185', '00000191', '00000192', '00000202', '00000211', '00000223', '00000225', '00000227', '00000230', '00000250', '00000252', '00000259', '00000276', '00000283', '00000287', '00000297', '00000298', '00000301', '00000303', '00000304', '00000305', '00000308', '00000310', '00000326', '00000328', '00000331', '00000339', '00000340', '00000341', '00000342', '00000353', '00000355', '00000360', '00000364', '00000368', '00000370', '00000377', '00000378', '00000390', '00000394', '00000407', '00000415', '00000416', '00000420', '00000424', '00000428', '00000441', '00000445', '00000453', '00000456', '00000458', '00000460', '00000464', '00000465', '00000466', '00000468', '00000476', '00000479', '00000483', '00000485', '00000498', '00000504', '00000510', '00000516'];

const SUGGESTED_QUERIES = [
  'How many buildings were destroyed on Gulf Freeway?',
  'What is the damage level at 1245 Almeda Rd?',
  'Show streets with major damage',
  'Compare model accuracy for destroyed class',
  'Which areas had the highest flood impact?',
];

const MOCK_RESPONSES: Record<string, string> = {
  default: `I'm the DisasterSight Query Bot. Click any building on the map to see its damage assessment, or ask me about specific addresses, streets, or damage categories for Hurricane Harvey (Houston, TX 2017).`,
  alameda: `📍 1245 Almeda Rd, Houston TX 77054\n\nFEMA Label: DESTROYED\nModel Prediction: DESTROYED ✓ (Correct)\nConfidence: 94%\n\nNotes: Complete structural failure reported. Located in the Almeda corridor which experienced severe inundation (est. 60+ inches water depth).`,
  gulf: `🛣️ Gulf Freeway Corridor Analysis\n\n8823 Gulf Freeway — Major Damage (model: Major ✓)\n\nThe Gulf Freeway corridor showed significant damage concentration, with 68% of assessed structures reporting major or destroyed classification. Primary cause: storm surge + extended flooding.`,
  destroyed: `📊 Destroyed Class Performance\n\nPrecision: 88% | Recall: 85% | F1: 86.5%\nTrue Positives: 173 | Total Labeled: 203\n\nThe VLM performs best on the "Destroyed" category — likely because total structural collapse presents unambiguous visual features in post-event imagery.`,
};

const DAMAGE_DESCRIPTIONS: Record<string, string> = {
  'no-damage':    'No structural damage detected. Building appears intact in post-disaster imagery.',
  'minor-damage': 'Minor damage observed — possible roof or exterior damage, structure remains sound.',
  'major-damage': 'Significant structural damage detected. Building likely unsafe for occupancy.',
  'destroyed':    'Complete structural failure. Building is a total loss.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDamageColor = (subtype: string): string => ({
  'no-damage':    '#22c55e',
  'minor-damage': '#facc15',
  'major-damage': '#f97316',
  'destroyed':    '#ef4444',
}[subtype] ?? '#94a3b8');

// function getTextResponse(query: string): string {
//   const q = query.toLowerCase();
//   if (q.includes('almeda') || q.includes('1245')) return MOCK_RESPONSES.alameda;
//   if (q.includes('gulf') || q.includes('freeway'))  return MOCK_RESPONSES.gulf;
//   if (q.includes('destroy') || q.includes('accuracy')) return MOCK_RESPONSES.destroyed;
//   return MOCK_RESPONSES.default;
// }

function getBuildingResponse(props: Record<string, unknown>): string {
  const subtype = (props?.subtype as string) || 'unknown';
  const uid = (props?.uid ?? props?.id ?? 'N/A') as string;
  const desc = DAMAGE_DESCRIPTIONS[subtype] || 'Classification data unavailable.';
  return `📍 Building Selected\n\nID: ${uid}\nClassification: ${subtype.replace(/-/g, ' ').toUpperCase()}\n\n${desc}\n\nAsk me anything about this building or the surrounding area.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MapView: React.FC = () => {
  // Map refs
  const mapRef             = useRef<HTMLDivElement>(null);
  const mapInstanceRef     = useRef<L.Map | null>(null);
  const geojsonLayerRef    = useRef<L.GeoJSON[]>([]);
  const imageLayersRef     = useRef<L.ImageOverlay[]>([]);
  const cloudinaryUrlsRef  = useRef<Record<string, string>>({});
  const chatBottomRef      = useRef<HTMLDivElement>(null);
  const sessionIdRef       = useRef<string>(createSessionId());

  // Map state
  const [imageMode, setImageMode] = useState<'pre' | 'post'>('post');
  const [mapLoading, setMapLoading] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Record<string, unknown> | null>(null);

  // Drawer is never shown while the map is loading, regardless of drawerOpen state
  const effectiveDrawerOpen = drawerOpen && !mapLoading;

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: MOCK_RESPONSES.default,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Cloudinary URL map once
  useEffect(() => {
    fetch('/data/cloudinary_urls.json')
      .then(r => r.json())
      .then(data => { cloudinaryUrlsRef.current = data; })
      .catch(err => console.error('Failed to load cloudinary URLs:', err));
  }, []);

  // Init Leaflet map once
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

  // Reload GeoJSON + imagery when mode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    geojsonLayerRef.current.forEach(l => l.remove());
    geojsonLayerRef.current = [];

    imageLayersRef.current.forEach(l => l.remove());
    imageLayersRef.current = [];

    setDrawerOpen(false);
    setMapLoading(true);

    const tilePromises = TILES.map(tile => {
      const width = 1024;
      const height = 1024;
      const correctionLat = -0.00000;
      const correctionLng =  0.00000;

      const imagePromise = fetch('/data/metadata.json')
        .then(r => r.json())
        .then(data => {
          if (!mapInstanceRef.current) return;
          const image_name = `hurricane-harvey_${tile}_${imageMode}_disaster.png`;
          const imageUrl = cloudinaryUrlsRef.current[image_name];
          if (!imageUrl) { console.error('No cloudinary URL found for', image_name); return; }
          const coordinates = data[image_name][0];
          const startX = coordinates[0];
          const pixelWidth = coordinates[1];
          const startY = coordinates[3];
          const pixelHeight = coordinates[5];
          const endX = startX + pixelWidth * width;
          const endY = startY + pixelHeight * height;
          const bounds = L.latLngBounds(
            [endY + correctionLat, startX + correctionLng],
            [startY + correctionLat, endX + correctionLng]
          );
          const overlay = L.imageOverlay(imageUrl, bounds).addTo(mapInstanceRef.current!);
          imageLayersRef.current.push(overlay);
        })
        .catch(err => console.error('Failed to load metadata:', err));

      const collectionName = imageMode === 'post' ? 'prediction_labels' : 'pre_disaster_labels';
      const docId = imageMode === 'post'
        ? `hurricane-harvey_${tile}`
        : `output_hurricane-harvey_${tile}_pre_disaster`;

      const geojsonPromise = getDoc(doc(db, collectionName, docId))
        .then((snapshot: DocumentSnapshot<DocumentData>) => {
          if (!snapshot.exists()) throw new Error(`Document ${docId} not found`);
          return JSON.parse(snapshot.data()!.data);
        })
        .then((data: GeoJsonObject | GeoJsonObject[] | null | undefined) => {
          if (!mapInstanceRef.current) return;
          const layer = L.geoJSON(data, {
            style: (feature) => ({
              fillColor: getDamageColor(feature?.properties?.subtype),
              fillOpacity: 0.5,
              color: getDamageColor(feature?.properties?.subtype),
              weight: 1,
            }),
            onEachFeature: (feature, layer) => {
              layer.on('click', () => {
                if (mapLoading) return;
                const props = feature.properties as Record<string, unknown>;
                setSelectedFeature(props);
                setDrawerOpen(true);
                const botMsg: ChatMessage = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: getBuildingResponse(props),
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, botMsg]);
              });
            },
          }).addTo(mapInstanceRef.current!);

          geojsonLayerRef.current.push(layer);
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            mapInstanceRef.current!.fitBounds(bounds, { padding: [40, 40] });
          }
        })
        .catch((err: any) => console.error('Failed to load GeoJSON for ', docId, err));

      return Promise.allSettled([imagePromise, geojsonPromise]);
    });

    Promise.allSettled(tilePromises).then(() => setMapLoading(false));
  }, [imageMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chat send ──────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const botMsgId = (Date.now() + 1).toString();

    const loadingBotMsg: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '...',
      isLoading: true,
      timestamp: new Date(),
    };

    // display loading state
    setMessages(prev => [...prev, userMsg, loadingBotMsg]);
    setInput('');

    // Make API Request to GET model response
    const params = new URLSearchParams({
      q: text,
      session_id: sessionIdRef.current,
    });

    //fetch('https://automateddisasterdamageassessmentserver.onrender.com/query');
    const response = await fetch(`http://localhost:8000/query?${params.toString()}`,
                                  {
                                    method: 'GET'
                                  }
    );
    const data = await response.json();


    const modelOutput = data.response;

    // const botMsg: ChatMessage = {
    //   id: (Date.now() + 1).toString(),
    //   role: 'assistant',
    //   //content: getTextResponse(text),
    //   content: modelOutput,
    //   timestamp: new Date(),
    // };
    // setMessages(prev => [...prev, userMsg, botMsg]);
    // setInput('');

    // update bot message content when finished loading
    setMessages(prev =>
      prev.map(msg =>
        msg.id === botMsgId
          ? { ...msg, content: modelOutput, isLoading: false }
          : msg
      )
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Controls Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography sx={{
            fontSize: '0.65rem', color: COLORS.text.muted,
            letterSpacing: '0.1em', fontFamily: '"Space Mono", monospace',
          }}>
            MODE:
          </Typography>
          {(['pre', 'post'] as const).map((mode) => (
            <Box
              key={mode}
              onClick={() => setImageMode(mode)}
              sx={{
                px: 2, py: 0.8, borderRadius: 1, cursor: 'pointer',
                fontFamily: '"Space Mono", monospace', fontSize: '0.7rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                border: `1px solid ${imageMode === mode ? COLORS.accent.cyan : COLORS.bg.border}`,
                color: imageMode === mode ? COLORS.accent.cyan : COLORS.text.muted,
                background: imageMode === mode ? `${COLORS.accent.cyan}15` : 'transparent',
                transition: 'all 0.2s ease', userSelect: 'none',
                '&:hover': { borderColor: COLORS.accent.cyan, color: COLORS.accent.cyan },
              }}
            >
              {mode === 'pre' ? '◀ Pre' : 'Post ▶'}
            </Box>
          ))}
        </Box>

        <Box sx={{ width: '1px', height: 24, background: COLORS.bg.border }} />

        {/* Active mode badge */}
        <Box sx={{ ml: 'auto' }}>
          <Box sx={{
            px: 1.5, py: 0.5, borderRadius: 1,
            background: imageMode === 'post' ? '#ef444415' : '#22c55e15',
            border: `1px solid ${imageMode === 'post' ? '#ef444433' : '#22c55e33'}`,
          }}>
            <Typography sx={{
              fontFamily: '"Space Mono", monospace', fontSize: '0.6rem',
              color: imageMode === 'post' ? '#ef4444' : '#22c55e',
              letterSpacing: '0.1em',
            }}>
              {imageMode === 'post' ? '⚠ POST-DISASTER VIEW' : '✓ PRE-DISASTER VIEW'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Map + Drawer Container */}
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Leaflet Map — pinned to fill container so siblings can't affect its size */}
        <Box
          ref={mapRef}
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 2,
            border: `1px solid ${COLORS.bg.border}`,
            overflow: 'hidden',
          }}
        />

        {/* Loading overlay */}
        {mapLoading && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 998,
            backgroundColor: '#00d4ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 2,
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.75rem', letterSpacing: '0.15em',
                color: '#00151a', mb: 1,
              }}>
                LOADING {imageMode.toUpperCase()}-DISASTER DATA...
              </Typography>
              <Box sx={{
                width: 120, height: 2, backgroundColor: 'rgba(0,0,0,0.15)',
                borderRadius: 1, overflow: 'hidden', mx: 'auto',
              }}>
                <Box sx={{
                  height: '100%', backgroundColor: '#00151a',
                  borderRadius: 1,
                  animation: 'slide 1.2s ease-in-out infinite',
                  '@keyframes slide': {
                    '0%':   { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(200%)' },
                  },
                }} />
              </Box>
            </Box>
          </Box>
        )}

        {/* Legend — floating overlay bottom-left */}
        <Box sx={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 999,
          backgroundColor: `${COLORS.bg.panel}ee`,
          border: `1px solid ${COLORS.bg.border}`,
          borderRadius: 1,
          px: 1.5,
          py: 0.75,
          display: 'flex',
          gap: 1.5,
          flexWrap: 'wrap',
          pointerEvents: 'none',
        }}>
          {[
            { label: 'No Damage',    color: '#22c55e' },
            { label: 'Minor Damage', color: '#facc15' },
            { label: 'Major Damage', color: '#f97316' },
            { label: 'Destroyed',    color: '#ef4444' },
            { label: 'Unclassified', color: '#94a3b8' },
          ].map(({ label, color }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', background: color, opacity: 0.85 }} />
              <Typography sx={{
                fontSize: '0.6rem', color: COLORS.text.muted,
                fontFamily: '"Space Mono", monospace',
              }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Drawer Toggle Tab — always visible on right edge */}
        <Box
          onClick={() => setDrawerOpen(p => !p)}
          sx={{
            position: 'absolute',
            top: '50%',
            right: effectiveDrawerOpen ? DRAWER_WIDTH : 0,
            transform: 'translateY(-50%)',
            transition: 'right 0.3s ease',
            zIndex: 1001,
            cursor: 'pointer',
            width: 24,
            height: 64,
            backgroundColor: COLORS.bg.elevated,
            border: `1px solid ${COLORS.bg.border}`,
            borderRight: 'none',
            borderRadius: '6px 0 0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              backgroundColor: `${COLORS.accent.cyan}15`,
              borderColor: `${COLORS.accent.cyan}66`,
            },
          }}
        >
          <ChevronRightIcon
            sx={{
              fontSize: 16,
              color: COLORS.accent.cyan,
              transform: effectiveDrawerOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s ease',
            }}
          />
        </Box>

        {/* Right-side Drawer Panel */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: DRAWER_WIDTH,
            transform: effectiveDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: COLORS.bg.panel ?? COLORS.bg.elevated,
            border: `1px solid ${COLORS.bg.border}`,
            borderRadius: '0 8px 8px 0',
            borderLeft: `1px solid ${COLORS.accent.cyan}33`,
            overflow: 'hidden',
          }}
        >

          {/* Selected Building Header */}
          <Box sx={{
            px: 2, py: 1.5,
            borderBottom: `1px solid ${COLORS.bg.border}`,
            flexShrink: 0,
            background: selectedFeature
              ? `${getDamageColor(selectedFeature.subtype as string)}10`
              : 'transparent',
            borderLeft: selectedFeature
              ? `3px solid ${getDamageColor(selectedFeature.subtype as string)}`
              : `3px solid transparent`,
            transition: 'all 0.2s ease',
          }}>
            <Typography sx={{
              fontFamily: '"Space Mono", monospace', fontSize: '0.55rem',
              color: COLORS.text.muted, letterSpacing: '0.15em', mb: 0.5,
            }}>
              SELECTED BUILDING
            </Typography>
            {selectedFeature ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 8, height: 8, borderRadius: '2px', flexShrink: 0,
                  background: getDamageColor(selectedFeature.subtype as string),
                }} />
                <Typography sx={{
                  fontFamily: '"Space Mono", monospace', fontSize: '0.85rem',
                  color: getDamageColor(selectedFeature.subtype as string),
                  fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {(selectedFeature.subtype as string)?.replace(/-/g, ' ') || 'Unknown'}
                </Typography>
              </Box>
            ) : (
              <Typography sx={{
                fontFamily: '"Space Mono", monospace', fontSize: '0.75rem',
                color: COLORS.text.muted, fontStyle: 'italic',
              }}>
                Click a building on the map
              </Typography>
            )}
          </Box>

          {/* Chat Messages */}
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            px: 1.5,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            minHeight: 0,
          }}>
            {messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  gap: 1,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                <Avatar sx={{
                  width: 24, height: 24, flexShrink: 0,
                  backgroundColor: msg.role === 'assistant' ? `${COLORS.accent.cyan}22` : `${COLORS.accent.orange}22`,
                  border: `1px solid ${msg.role === 'assistant' ? COLORS.accent.cyan : COLORS.accent.orange}44`,
                }}>
                  {msg.role === 'assistant'
                    ? <SmartToyOutlinedIcon sx={{ fontSize: 13, color: COLORS.accent.cyan }} />
                    : <PersonOutlineIcon   sx={{ fontSize: 13, color: COLORS.accent.orange }} />}
                </Avatar>
                <Box sx={{
                  maxWidth: '82%',
                  backgroundColor: msg.role === 'assistant' ? COLORS.bg.elevated : `${COLORS.accent.orange}18`,
                  border: `1px solid ${msg.role === 'assistant' ? COLORS.bg.border : `${COLORS.accent.orange}33`}`,
                  borderRadius: 1.5,
                  px: 1.5, py: 1,
                }}>
                  <Typography sx={{
                    fontSize: '0.75rem', color: COLORS.text.primary,
                    whiteSpace: 'pre-line', lineHeight: 1.6,
                  }}>
                    {msg.content}
                  </Typography>
                  <Typography sx={{ fontSize: '0.55rem', color: COLORS.text.muted, mt: 0.5 }}>
                    {msg.timestamp.toLocaleTimeString('en-US', { hour12: false })}
                  </Typography>
                </Box>
              </Box>
            ))}
            <div ref={chatBottomRef} />
          </Box>

          {/* Suggested Queries */}
          <Box sx={{
            px: 1.5, py: 1,
            borderTop: `1px solid ${COLORS.bg.border}`,
            display: 'flex',
            gap: 0.75,
            flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            {SUGGESTED_QUERIES.map((q) => (
              <Chip
                key={q}
                label={q}
                size="small"
                onClick={() => sendMessage(q)}
                sx={{
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  fontSize: '0.6rem',
                  cursor: 'pointer',
                  backgroundColor: COLORS.bg.dark,
                  color: COLORS.text.secondary,
                  border: `1px solid ${COLORS.bg.border}`,
                  '&:hover': {
                    backgroundColor: `${COLORS.accent.cyan}12`,
                    color: COLORS.accent.cyan,
                    border: `1px solid ${COLORS.accent.cyan}33`,
                  },
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </Box>

          {/* Chat Input */}
          <Box sx={{
            px: 1.5, py: 1,
            borderTop: `1px solid ${COLORS.bg.border}`,
            display: 'flex',
            gap: 0.75,
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <TextField
              fullWidth
              size="small"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(input); }}
              placeholder="Ask about an address, street, or damage…"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  fontSize: '0.75rem',
                  backgroundColor: COLORS.bg.dark,
                  '& fieldset': { borderColor: COLORS.bg.border },
                  '&:hover fieldset': { borderColor: `${COLORS.accent.cyan}66` },
                  '&.Mui-focused fieldset': { borderColor: COLORS.accent.cyan },
                },
                '& input::placeholder': { color: COLORS.text.muted, opacity: 1 },
              }}
            />
            <IconButton
              onClick={() => sendMessage(input)}
              sx={{
                backgroundColor: `${COLORS.accent.cyan}22`,
                color: COLORS.accent.cyan,
                border: `1px solid ${COLORS.accent.cyan}44`,
                borderRadius: 1,
                flexShrink: 0,
                '&:hover': { backgroundColor: `${COLORS.accent.cyan}33` },
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>


    </Box>
  );
};
