import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Divider,
} from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { COLORS } from '../theme';
import { mockMetrics, mockDisasterEvent } from '../data/mockData';

const DAMAGE_COLORS = {
  'no-damage': COLORS.accent.green,
  'minor-damage': COLORS.accent.yellow,
  'major-damage': COLORS.accent.orange,
  'destroyed': COLORS.accent.red,
  'un-classified': COLORS.text.muted,
};

const DAMAGE_LABELS = {
  'no-damage': 'No Damage',
  'minor-damage': 'Minor Damage',
  'major-damage': 'Major Damage',
  'destroyed': 'Destroyed',
  'un-classified': 'Unclassified',
};

export const Overview: React.FC = () => {
  const event = mockDisasterEvent;
  const total = event.totalBuildings;

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      {/* Mission header */}
      <Box
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: 1,
          backgroundColor: `${COLORS.accent.orange}0f`,
          border: `1px solid ${COLORS.accent.orange}33`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <WarningAmberIcon sx={{ color: COLORS.accent.orange, mt: 0.5, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontWeight: 700,
              fontSize: '1rem',
              color: COLORS.accent.orange,
              letterSpacing: '0.05em',
            }}
          >
            ACTIVE ASSESSMENT — {event.name.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: COLORS.text.secondary, mt: 0.5 }}>
            {event.location} · {new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Hurricane Category 4
          </Typography>
        </Box>
        <Chip
          label="ONGOING"
          size="small"
          sx={{
            backgroundColor: `${COLORS.accent.orange}22`,
            color: COLORS.accent.orange,
            fontFamily: '"Space Mono", monospace',
            fontSize: '0.6rem',
            border: `1px solid ${COLORS.accent.orange}44`,
          }}
        />
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Assessed', value: total.toLocaleString(), color: COLORS.accent.cyan, icon: <HomeOutlinedIcon /> },
          { label: 'Model Accuracy', value: `${(mockMetrics.accuracy * 100).toFixed(1)}%`, color: COLORS.accent.green, icon: <AssessmentOutlinedIcon /> },
          { label: 'Destroyed', value: event.damageSummary['destroyed'].toString(), color: COLORS.accent.red, icon: <WarningAmberIcon /> },
          { label: 'Area Covered', value: 'Houston, TX', color: COLORS.accent.yellow, icon: <MapOutlinedIcon /> },
        ].map((kpi) => (
          <Grid item xs={6} sm={3} key={kpi.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="overline" sx={{ color: COLORS.text.label }}>
                    {kpi.label}
                  </Typography>
                  <Box sx={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</Box>
                </Box>
                <Typography
                  sx={{
                    fontFamily: '"Space Mono", monospace',
                    fontWeight: 700,
                    fontSize: kpi.label === 'Area Covered' ? '1rem' : '1.8rem',
                    color: kpi.color,
                    lineHeight: 1.1,
                  }}
                >
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* Damage breakdown */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="overline" sx={{ color: COLORS.text.label, display: 'block', mb: 2 }}>
                Damage Category Breakdown
              </Typography>
              {(Object.entries(event.damageSummary) as [keyof typeof DAMAGE_COLORS, number][])
                .filter(([k]) => k !== 'un-classified')
                .sort(([, a], [, b]) => b - a)
                .map(([level, count]) => {
                  const pct = (count / total) * 100;
                  return (
                    <Box key={level} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: DAMAGE_COLORS[level] }} />
                          <Typography sx={{ fontSize: '0.78rem', color: COLORS.text.secondary }}>
                            {DAMAGE_LABELS[level]}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Typography sx={{ fontSize: '0.72rem', color: COLORS.text.muted }}>
                            {count.toLocaleString()}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: '"Space Mono", monospace',
                              fontSize: '0.72rem',
                              color: DAMAGE_COLORS[level],
                              minWidth: 38,
                              textAlign: 'right',
                            }}
                          >
                            {pct.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: COLORS.bg.border,
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: DAMAGE_COLORS[level],
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>
                  );
                })}
            </CardContent>
          </Card>
        </Grid>

        {/* Model performance snapshot */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="overline" sx={{ color: COLORS.text.label, display: 'block', mb: 2 }}>
                VLM Model Performance Snapshot
              </Typography>

              {[
                { label: 'Accuracy', value: mockMetrics.accuracy },
                { label: 'Precision (weighted)', value: mockMetrics.precision },
                { label: 'Recall (weighted)', value: mockMetrics.recall },
                { label: 'F1 Score (weighted)', value: mockMetrics.f1Score },
              ].map((metric) => (
                <Box key={metric.label} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: COLORS.text.secondary }}>
                      {metric.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: '"Space Mono", monospace',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color:
                          metric.value >= 0.8
                            ? COLORS.accent.green
                            : metric.value >= 0.65
                            ? COLORS.accent.yellow
                            : COLORS.accent.red,
                      }}
                    >
                      {(metric.value * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={metric.value * 100}
                    sx={{
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: COLORS.bg.border,
                      '& .MuiLinearProgress-bar': {
                        backgroundColor:
                          metric.value >= 0.8
                            ? COLORS.accent.green
                            : metric.value >= 0.65
                            ? COLORS.accent.yellow
                            : COLORS.accent.red,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
              ))}

              <Divider sx={{ borderColor: COLORS.bg.border, my: 2 }} />

              <Typography variant="overline" sx={{ color: COLORS.text.label, display: 'block', mb: 1 }}>
                System Status
              </Typography>
              {[
                { label: 'VLM Pipeline', status: 'ONLINE', color: COLORS.accent.green },
                { label: 'FEMA Ground Truth', status: 'LOADED', color: COLORS.accent.cyan },
                { label: 'Geospatial Engine', status: 'READY', color: COLORS.accent.cyan },
                { label: 'Chatbot Interface', status: 'ACTIVE', color: COLORS.accent.green },
              ].map((s) => (
                <Box key={s.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: COLORS.text.secondary }}>
                    {s.label}
                  </Typography>
                  <Chip
                    label={s.status}
                    size="small"
                    sx={{
                      height: 18,
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '0.58rem',
                      backgroundColor: `${s.color}18`,
                      color: s.color,
                      border: `1px solid ${s.color}44`,
                      '& .MuiChip-label': { px: 0.8 },
                    }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
