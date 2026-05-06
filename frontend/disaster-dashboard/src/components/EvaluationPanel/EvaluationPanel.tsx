import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Chip,
  Tabs,
  Tab,
  Tooltip,
  Paper,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TimelineIcon from '@mui/icons-material/Timeline';
import GridViewIcon from '@mui/icons-material/GridView';
import { COLORS } from '../../theme';
//import { mockMetrics, mockConfusionMatrix, mockBuildings } from '../../data/mockData';
import { mockMetrics, mockBuildings } from '../../data/mockData';
import { mockConfusionMatrix } from '../../data/trueData';
import type { DamageLevel } from '../../types';

// ── Damage color map ──────────────────────────────────────────────────────────
const DAMAGE_COLORS: Record<DamageLevel, string> = {
  'no-damage': COLORS.accent.green,
  'minor-damage': COLORS.accent.yellow,
  'major-damage': COLORS.accent.orange,
  'destroyed': COLORS.accent.red,
  'un-classified': COLORS.text.muted,
};

const DAMAGE_LABELS: Record<DamageLevel, string> = {
  'no-damage': 'No Damage',
  'minor-damage': 'Minor',
  'major-damage': 'Major',
  'destroyed': 'Destroyed',
  'un-classified': 'Unclassified',
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
  delta?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, color, delta }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2.5 }}>
      <Typography
        variant="overline"
        sx={{ color: COLORS.text.label, display: 'block', mb: 1 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: '"Space Mono", monospace',
          fontWeight: 700,
          fontSize: '2rem',
          color: color ?? COLORS.text.primary,
          lineHeight: 1,
          mb: 0.5,
        }}
      >
        {value}
      </Typography>
      {(subtext || delta) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {subtext && (
            <Typography sx={{ fontSize: '0.72rem', color: COLORS.text.secondary }}>
              {subtext}
            </Typography>
          )}
          {delta && (
            <Chip
              label={delta}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontFamily: '"Space Mono", monospace',
                backgroundColor: `${COLORS.accent.green}18`,
                color: COLORS.accent.green,
                '& .MuiChip-label': { px: 0.8 },
              }}
            />
          )}
        </Box>
      )}
    </CardContent>
  </Card>
);

// ── Confusion Matrix ──────────────────────────────────────────────────────────
const ConfusionMatrix: React.FC = () => {
  const { labels, matrix } = mockConfusionMatrix;
  const rowTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const maxVal = Math.max(...matrix.flat());

  return (
    <Box>
      <Typography
        variant="overline"
        sx={{ color: COLORS.text.label, display: 'block', mb: 0.5 }}
      >
        Confusion Matrix — Predicted vs Actual (FEMA)
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: COLORS.text.muted, mb: 2 }}>
        Rows = FEMA ground truth · Columns = Model prediction
      </Typography>

      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'inline-block', minWidth: 480 }}>
          {/* Column headers */}
          <Box sx={{ display: 'flex', ml: '120px', mb: 0.5 }}>
            {labels.map((label) => (
              <Box key={label} sx={{ width: 90, textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontFamily: '"Space Mono", monospace',
                    color: DAMAGE_COLORS[label],
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {DAMAGE_LABELS[label]}
                </Typography>
              </Box>
            ))}
            <Box sx={{ width: 60, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.6rem', color: COLORS.text.muted }}>TOTAL</Typography>
            </Box>
          </Box>

          {/* Rows */}
          {matrix.map((row, ri) => (
            <Box key={labels[ri]} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {/* Row label */}
              <Box sx={{ width: 120, pr: 1, textAlign: 'right' }}>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontFamily: '"Space Mono", monospace',
                    color: DAMAGE_COLORS[labels[ri]],
                  }}
                >
                  {DAMAGE_LABELS[labels[ri]]}
                </Typography>
              </Box>

              {/* Cells */}
              {row.map((val, ci) => {
                const isDiagonal = ri === ci;
                const intensity = val / maxVal;
                const bgColor = isDiagonal
                  ? `${COLORS.accent.cyan}${Math.round(intensity * 180).toString(16).padStart(2, '0')}`
                  : `${COLORS.accent.red}${Math.round(intensity * 120).toString(16).padStart(2, '0')}`;

                return (
                  <Tooltip
                    key={ci}
                    title={`Actual: ${DAMAGE_LABELS[labels[ri]]} → Predicted: ${DAMAGE_LABELS[labels[ci]]} | Count: ${val}`}
                  >
                    <Box
                      sx={{
                        width: 90,
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: val === 0 ? COLORS.bg.dark : bgColor,
                        border: `1px solid ${COLORS.bg.border}`,
                        borderRadius: 0.5,
                        mx: 0.25,
                        cursor: 'default',
                        transition: 'all 0.2s',
                        '&:hover': {
                          border: `1px solid ${isDiagonal ? COLORS.accent.cyan : COLORS.accent.red}66`,
                          transform: 'scale(1.03)',
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: isDiagonal ? 700 : 400,
                          fontSize: isDiagonal ? '1rem' : '0.85rem',
                          color: val === 0
                            ? COLORS.text.muted
                            : isDiagonal
                              ? COLORS.accent.cyan
                              : COLORS.text.primary,
                        }}
                      >
                        {val}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}

              {/* Row total */}
              <Box
                sx={{
                  width: 60,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.bg.dark,
                  border: `1px solid ${COLORS.bg.border}`,
                  borderRadius: 0.5,
                  mx: 0.25,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '0.75rem',
                    color: COLORS.text.secondary,
                  }}
                >
                  {rowTotals[ri]}
                </Typography>
              </Box>
            </Box>
          ))}

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, ml: '120px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: `${COLORS.accent.cyan}88`, borderRadius: 0.5 }} />
              <Typography sx={{ fontSize: '0.65rem', color: COLORS.text.muted }}>Correct prediction</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: `${COLORS.accent.red}66`, borderRadius: 0.5 }} />
              <Typography sx={{ fontSize: '0.65rem', color: COLORS.text.muted }}>Misclassification</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

// ── Per-Class Table ───────────────────────────────────────────────────────────
const PerClassTable: React.FC = () => {
  const classes: DamageLevel[] = ['no-damage', 'minor-damage', 'major-damage', 'destroyed'];

  return (
    <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'transparent' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Class</TableCell>
            <TableCell align="right">Precision</TableCell>
            <TableCell align="right">Recall</TableCell>
            <TableCell align="right">F1 Score</TableCell>
            <TableCell align="right">Support</TableCell>
            <TableCell sx={{ width: 140 }}>Precision Bar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {classes.map((cls) => {
            const m = mockMetrics.byClass[cls];
            return (
              <TableRow
                key={cls}
                sx={{ '&:hover': { backgroundColor: `${COLORS.bg.elevated}80` } }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DAMAGE_COLORS[cls],
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        fontFamily: '"Space Mono", monospace',
                        color: DAMAGE_COLORS[cls],
                      }}
                    >
                      {DAMAGE_LABELS[cls]}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    sx={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '0.78rem',
                      color: m.precision >= 0.8 ? COLORS.accent.green : m.precision >= 0.65 ? COLORS.accent.yellow : COLORS.accent.red,
                    }}
                  >
                    {(m.precision * 100).toFixed(1)}%
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    sx={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '0.78rem',
                      color: m.recall >= 0.8 ? COLORS.accent.green : m.recall >= 0.65 ? COLORS.accent.yellow : COLORS.accent.red,
                    }}
                  >
                    {(m.recall * 100).toFixed(1)}%
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    sx={{
                      fontFamily: '"Space Mono", monospace',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      color: m.f1 >= 0.8 ? COLORS.accent.green : m.f1 >= 0.65 ? COLORS.accent.yellow : COLORS.accent.red,
                    }}
                  >
                    {(m.f1 * 100).toFixed(1)}%
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ fontFamily: '"Space Mono", monospace', fontSize: '0.78rem', color: COLORS.text.secondary }}>
                    {m.support}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={`${(m.precision * 100).toFixed(1)}% precision`}>
                    <LinearProgress
                      variant="determinate"
                      value={m.precision * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: COLORS.bg.border,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: DAMAGE_COLORS[cls],
                          borderRadius: 3,
                        },
                      }}
                    />
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}

          {/* Weighted avg row */}
          <TableRow sx={{ backgroundColor: `${COLORS.bg.elevated}50` }}>
            <TableCell>
              <Typography sx={{ fontSize: '0.72rem', fontFamily: '"Space Mono", monospace', color: COLORS.text.label }}>
                WEIGHTED AVG
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography sx={{ fontFamily: '"Space Mono", monospace', fontSize: '0.78rem', color: COLORS.accent.cyan }}>
                {(mockMetrics.precision * 100).toFixed(1)}%
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography sx={{ fontFamily: '"Space Mono", monospace', fontSize: '0.78rem', color: COLORS.accent.cyan }}>
                {(mockMetrics.recall * 100).toFixed(1)}%
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography sx={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: '0.78rem', color: COLORS.accent.cyan }}>
                {(mockMetrics.f1Score * 100).toFixed(1)}%
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography sx={{ fontFamily: '"Space Mono", monospace', fontSize: '0.78rem', color: COLORS.text.secondary }}>
                {mockMetrics.totalBuildings}
              </Typography>
            </TableCell>
            <TableCell>
              <LinearProgress
                variant="determinate"
                value={mockMetrics.precision * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.bg.border,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: COLORS.accent.cyan,
                    borderRadius: 3,
                  },
                }}
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ── Sample Predictions Table ──────────────────────────────────────────────────
const PredictionsTable: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all');

  const filtered = mockBuildings.filter((b) => {
    if (filter === 'correct') return b.modelPrediction === b.femaLabel;
    if (filter === 'wrong') return b.modelPrediction !== b.femaLabel;
    return true;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {(['all', 'correct', 'wrong'] as const).map((f) => (
          <Chip
            key={f}
            label={f.toUpperCase()}
            size="small"
            onClick={() => setFilter(f)}
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.62rem',
              cursor: 'pointer',
              backgroundColor:
                filter === f
                  ? f === 'correct'
                    ? `${COLORS.accent.green}22`
                    : f === 'wrong'
                    ? `${COLORS.accent.red}22`
                    : `${COLORS.accent.cyan}22`
                  : COLORS.bg.dark,
              color:
                filter === f
                  ? f === 'correct'
                    ? COLORS.accent.green
                    : f === 'wrong'
                    ? COLORS.accent.red
                    : COLORS.accent.cyan
                  : COLORS.text.secondary,
              border: `1px solid ${
                filter === f
                  ? f === 'correct'
                    ? COLORS.accent.green
                    : f === 'wrong'
                    ? COLORS.accent.red
                    : COLORS.accent.cyan
                  : COLORS.bg.border
              }44`,
            }}
          />
        ))}
        <Typography sx={{ fontSize: '0.72rem', color: COLORS.text.muted, alignSelf: 'center', ml: 1 }}>
          {filtered.length} records
        </Typography>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'transparent', maxHeight: 360 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Address</TableCell>
              <TableCell align="center">Model Prediction</TableCell>
              <TableCell align="center">FEMA Label</TableCell>
              <TableCell align="center">Match</TableCell>
              <TableCell align="right">Confidence</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((b) => {
              const isCorrect = b.modelPrediction === b.femaLabel;
              return (
                <TableRow
                  key={b.id}
                  sx={{ '&:hover': { backgroundColor: `${COLORS.bg.elevated}80` } }}
                >
                  <TableCell>
                    <Typography sx={{ fontSize: '0.72rem', color: COLORS.text.secondary, maxWidth: 260 }} noWrap>
                      {b.address}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={DAMAGE_LABELS[b.modelPrediction]}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        fontFamily: '"Space Mono", monospace',
                        backgroundColor: `${DAMAGE_COLORS[b.modelPrediction]}18`,
                        color: DAMAGE_COLORS[b.modelPrediction],
                        '& .MuiChip-label': { px: 0.8 },
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={DAMAGE_LABELS[b.femaLabel]}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        fontFamily: '"Space Mono", monospace',
                        backgroundColor: `${DAMAGE_COLORS[b.femaLabel]}18`,
                        color: DAMAGE_COLORS[b.femaLabel],
                        '& .MuiChip-label': { px: 0.8 },
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {isCorrect ? (
                      <CheckCircleOutlineIcon sx={{ fontSize: 16, color: COLORS.accent.green }} />
                    ) : (
                      <Box sx={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Box sx={{ width: 12, height: 2, backgroundColor: COLORS.accent.red, borderRadius: 1 }} />
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        fontFamily: '"Space Mono", monospace',
                        fontSize: '0.72rem',
                        color:
                          b.confidence >= 0.8
                            ? COLORS.accent.green
                            : b.confidence >= 0.55
                            ? COLORS.accent.yellow
                            : COLORS.accent.red,
                      }}
                    >
                      {(b.confidence * 100).toFixed(0)}%
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ── Main Evaluation Panel ─────────────────────────────────────────────────────
export const EvaluationPanel: React.FC = () => {
  const [tab, setTab] = useState(0);

  const correctCount = mockBuildings.filter((b) => b.modelPrediction === b.femaLabel).length;
  const incorrectCount = mockBuildings.length - correctCount;

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="overline"
          sx={{ color: COLORS.accent.cyan, letterSpacing: '0.2em', fontSize: '0.65rem' }}
        >
          MODEL EVALUATION ／ FEMA GROUND TRUTH COMPARISON
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
          Hurricane Harvey — Houston, TX
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: COLORS.text.secondary, mt: 0.5 }}>
          VLM predictions vs FEMA Validated Damage Assessments · Dataset: 1,247 buildings
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Overall Accuracy"
            value={`${(mockMetrics.accuracy * 100).toFixed(1)}%`}
            subtext="vs FEMA labels"
            color={COLORS.accent.cyan}
            delta="+2.3%"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Weighted F1"
            value={`${(mockMetrics.f1Score * 100).toFixed(1)}%`}
            subtext="macro avg"
            color={COLORS.accent.green}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Correct"
            value={String(correctCount)}
            subtext={`of ${mockBuildings.length} samples`}
            color={COLORS.accent.green}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Misclassified"
            value={String(incorrectCount)}
            subtext={`${((incorrectCount / mockBuildings.length) * 100).toFixed(1)}% error rate`}
            color={COLORS.accent.red}
          />
        </Grid>
      </Grid>

      {/* Tabbed sections */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: `1px solid ${COLORS.bg.border}` }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              px: 2,
              '& .MuiTab-root': {
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: COLORS.text.muted,
                minHeight: 48,
                '&.Mui-selected': { color: COLORS.accent.cyan },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: COLORS.accent.cyan,
                height: 2,
              },
            }}
          >
            <Tab icon={<GridViewIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Confusion Matrix" />
            <Tab icon={<TimelineIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Per-Class Metrics" />
            <Tab icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Sample Predictions" />
          </Tabs>
        </Box>

        <CardContent sx={{ p: 3 }}>
          {tab === 0 && <ConfusionMatrix />}
          {tab === 1 && <PerClassTable />}
          {tab === 2 && <PredictionsTable />}
        </CardContent>
      </Card>

      {/* Bottom damage distribution bar */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="overline" sx={{ color: COLORS.text.label, display: 'block', mb: 1.5 }}>
            Damage Distribution — FEMA Ground Truth
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            {(['no-damage', 'minor-damage', 'major-damage', 'destroyed'] as DamageLevel[]).map((level) => {
              const m = mockMetrics.byClass[level];
              const pct = (m.support / mockMetrics.totalBuildings) * 100;
              return (
                <Tooltip key={level} title={`${DAMAGE_LABELS[level]}: ${m.support} buildings (${pct.toFixed(1)}%)`}>
                  <Box
                    sx={{
                      flex: m.support,
                      height: 24,
                      backgroundColor: DAMAGE_COLORS[level],
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'default',
                      opacity: 0.85,
                      '&:hover': { opacity: 1 },
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {m.support > 100 && (
                      <Typography sx={{ fontSize: '0.6rem', fontFamily: '"Space Mono", monospace', color: '#000', fontWeight: 700 }}>
                        {pct.toFixed(0)}%
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
            {(['no-damage', 'minor-damage', 'major-damage', 'destroyed'] as DamageLevel[]).map((level) => (
              <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: DAMAGE_COLORS[level] }} />
                <Typography sx={{ fontSize: '0.68rem', color: COLORS.text.secondary }}>
                  {DAMAGE_LABELS[level]} ({mockMetrics.byClass[level].support})
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
