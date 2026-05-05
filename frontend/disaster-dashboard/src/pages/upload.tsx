import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

import {
  CloudUploadOutlined as CloudUploadOutlinedIcon,
  RestartAlt as RestartAltIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircleOutlined as CheckCircleOutlineIcon,
  ErrorOutlined as ErrorOutlineIcon,
  FiberManualRecord as FiberManualRecordIcon,
} from '@mui/icons-material';

import { COLORS } from '../theme';

/**
 * Damage assessment — pre/post imagery comparison.
 * Two upload slots, then dispatches both images to a backend for analysis.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AnalysisStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge — STANDBY / READY / ANALYZING / COMPLETE / ERROR
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status, ready }: { status: AnalysisStatus; ready: boolean }) {
  let label = 'STANDBY';
  let color: string = COLORS.text.label;
  let pulsing = false;

  if (status.kind === 'running') {
    label = 'ANALYZING';
    color = COLORS.accent.orange;
    pulsing = true;
  } else if (status.kind === 'done') {
    label = 'COMPLETE';
    color = COLORS.accent.green;
  } else if (status.kind === 'error') {
    label = 'ERROR';
    color = COLORS.accent.red;
  } else if (ready) {
    label = 'READY';
    color = COLORS.accent.cyan;
    pulsing = true;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        border: `1px solid ${color}`,
        backgroundColor: COLORS.bg.dark,
        borderRadius: 0.5,
      }}
    >
      <FiberManualRecordIcon
        sx={{
          fontSize: 8,
          color,
          animation: pulsing ? 'pulse 1.6s ease-in-out infinite' : 'none',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.3 },
          },
        }}
      />
      <Typography variant="overline" sx={{ color, lineHeight: 1 }}>
        {label}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropzone — single upload slot
// ─────────────────────────────────────────────────────────────────────────────

interface DropzoneProps {
  label: string;
  sublabel: string;
  slotIndex: number;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function Dropzone({ label, sublabel, slotIndex, file, onFileChange }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Manage blob URL lifecycle so we revoke the previous one when file changes
  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
      return undefined;
    }
  }, [file]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) onFileChange(selected);
      e.target.value = '';
    },
    [onFileChange],
  );

  const filled = file !== null;
  const borderColor = isDragging
    ? COLORS.accent.cyan
    : filled
      ? COLORS.accent.cyanDim
      : COLORS.bg.border;

  return (
    <Box
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.target !== e.currentTarget) return;
        setIsDragging(false);
      }}
      onDrop={handleDrop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      sx={{
        position: 'relative',
        backgroundColor: filled ? COLORS.bg.card : COLORS.bg.panel,
        border: `1px ${isDragging ? 'solid' : 'dashed'} ${borderColor}`,
        cursor: 'pointer',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minHeight: 320,
        transition: 'all 0.15s',
        outline: 'none',
        overflow: 'hidden',
        '&:hover': { borderColor: COLORS.accent.cyan },
        '&:focus-visible': {
          borderColor: COLORS.accent.cyan,
          boxShadow: `0 0 0 2px ${COLORS.accent.cyan}33`,
        },
        '&::before': isDragging
          ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(135deg, transparent 49.5%, ${COLORS.accent.cyan}22 49.5%, ${COLORS.accent.cyan}22 50.5%, transparent 50.5%)`,
              backgroundSize: '14px 14px',
              opacity: 0.5,
              pointerEvents: 'none',
            }
          : undefined,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-label={`Choose ${label}`}
      />

      {/* Slot tag header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
          borderBottom: `1px solid ${COLORS.bg.border}`,
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: COLORS.accent.cyan, display: 'block', lineHeight: 1.4 }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: COLORS.text.label,
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}
          >
            {sublabel}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: '"Space Mono", monospace',
            fontSize: '0.6rem',
            color: COLORS.text.muted,
            letterSpacing: '0.1em',
          }}
        >
          SLOT_{String(slotIndex).padStart(2, '0')}
        </Typography>
      </Box>

      {/* Body — empty state or preview */}
      {filled && previewUrl ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            flex: 1,
            minHeight: 0,
          }}
        >
          <Box
            component="img"
            src={previewUrl}
            alt={`${label} preview`}
            sx={{
              width: '100%',
              flex: 1,
              minHeight: 140,
              maxHeight: 200,
              objectFit: 'cover',
              border: `1px solid ${COLORS.bg.border}`,
              backgroundColor: COLORS.bg.deepest,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              title={file?.name}
              sx={{
                fontSize: '0.75rem',
                color: COLORS.text.primary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '"IBM Plex Sans", sans-serif',
              }}
            >
              {file?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: COLORS.text.label, display: 'block' }}>
              {file ? formatBytes(file.size) : ''}
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
            sx={{
              alignSelf: 'flex-start',
              color: COLORS.text.secondary,
              border: `1px solid ${COLORS.bg.border}`,
              minWidth: 0,
              '&:hover': {
                borderColor: COLORS.accent.cyan,
                color: COLORS.accent.cyan,
                backgroundColor: 'transparent',
              },
            }}
          >
            Replace
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            flex: 1,
            textAlign: 'center',
            p: 2,
          }}
        >
          <CloudUploadOutlinedIcon
            sx={{
              fontSize: 36,
              color: isDragging ? COLORS.accent.cyan : COLORS.text.label,
              transition: 'color 0.15s',
            }}
          />
          <Typography
            sx={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '0.85rem',
              color: COLORS.text.primary,
              letterSpacing: '0.05em',
            }}
          >
            {isDragging ? 'RELEASE_TO_UPLOAD' : 'DROP_OR_CLICK_TO_BROWSE'}
          </Typography>
          <Typography variant="caption" sx={{ color: COLORS.text.label }}>
            JPG · PNG · TIFF · single file
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function UploadPage() {
  const [preFile, setPreFile] = useState<File | null>(null);
  const [postFile, setPostFile] = useState<File | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>({ kind: 'idle' });

  const ready = preFile !== null && postFile !== null;
  const canAnalyze = ready && status.kind !== 'running';

  const handleAnalyze = useCallback(async () => {
    if (!preFile || !postFile) return;
    setStatus({ kind: 'running' });

    try {
      const formData = new FormData();
      formData.append('pre', preFile);
      formData.append('post', postFile);

      // ─────────────────────────────────────────────────────────────────────
      // BACKEND HOOK — replace the simulated block below with a real request.
      //
      // Example (POST to your VPS / FastAPI / Express endpoint):
      //
      //   const res = await fetch("/api/analyze", {
      //     method: "POST",
      //     body: formData,
      //   });
      //   if (!res.ok) throw new Error(`HTTP ${res.status}`);
      //   const data: { summary: string } = await res.json();
      //   setStatus({ kind: "done", summary: data.summary });
      //
      // The backend should accept multipart/form-data with two image fields
      // ("pre" and "post") and return JSON of the form { summary: string }.
      // ─────────────────────────────────────────────────────────────────────

      // Simulated response (remove when wiring to a backend):
      await new Promise((r) => setTimeout(r, 1200));
      const fakeSummary =
        'Detected moderate structural damage across ~32% of the surveyed area.';
      setStatus({ kind: 'done', summary: fakeSummary });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [preFile, postFile]);

  const reset = useCallback(() => {
    setPreFile(null);
    setPostFile(null);
    setStatus({ kind: 'idle' });
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: COLORS.bg.deepest,
        backgroundImage: `
          radial-gradient(circle at 0% 0%, rgba(0, 212, 255, 0.04) 0%, transparent 50%),
          radial-gradient(circle at 100% 100%, rgba(255, 107, 43, 0.03) 0%, transparent 50%)
        `,
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 980, mx: 'auto' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            pb: 2,
            mb: 3,
            borderBottom: `1px solid ${COLORS.bg.border}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 3, height: 32, backgroundColor: COLORS.accent.cyan }} />
            <Box>
              <Typography
                variant="overline"
                sx={{ color: COLORS.accent.cyan, display: 'block', mb: 0.5 }}
              >
                MODULE / DAMAGE_ASSESS
              </Typography>
              <Typography variant="h4" sx={{ color: COLORS.text.primary }}>
                PRE_POST_COMPARISON
              </Typography>
            </Box>
          </Box>
          <StatusBadge status={status} ready={ready} />
        </Box>

        {/* Two dropzones */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 1.5,
          }}
        >
          <Dropzone
            label="PRE-DISASTER"
            sublabel="Baseline imagery"
            slotIndex={1}
            file={preFile}
            onFileChange={setPreFile}
          />
          <Dropzone
            label="POST-DISASTER"
            sublabel="Imagery after event"
            slotIndex={2}
            file={postFile}
            onFileChange={setPostFile}
          />
        </Box>

        {/* Controls */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 1,
            mt: 2,
          }}
        >
          <Button
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            onClick={reset}
            disabled={status.kind === 'running'}
            sx={{
              color: COLORS.text.secondary,
              border: `1px solid ${COLORS.bg.border}`,
              '&:hover': {
                backgroundColor: COLORS.bg.card,
                borderColor: COLORS.text.secondary,
              },
              '&:disabled': {
                color: COLORS.text.muted,
                borderColor: COLORS.bg.border,
              },
            }}
          >
            Reset
          </Button>
          <Button
            startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            sx={{
              color: COLORS.bg.deepest,
              backgroundColor: COLORS.accent.cyan,
              border: `1px solid ${COLORS.accent.cyan}`,
              fontWeight: 700,
              '&:hover': {
                backgroundColor: COLORS.accent.cyanDim,
                borderColor: COLORS.accent.cyanDim,
              },
              '&:disabled': {
                backgroundColor: COLORS.bg.elevated,
                color: COLORS.text.muted,
                borderColor: COLORS.bg.border,
              },
            }}
          >
            {status.kind === 'running' ? 'Analyzing…' : 'Run analysis'}
          </Button>
        </Box>

        {/* Output strip */}
        <Box
          aria-live="polite"
          sx={{
            mt: 4,
            p: 2,
            backgroundColor: COLORS.bg.panel,
            border: `1px solid ${COLORS.bg.border}`,
            borderLeft: `3px solid ${
              status.kind === 'error'
                ? COLORS.accent.red
                : status.kind === 'done'
                  ? COLORS.accent.green
                  : status.kind === 'running'
                    ? COLORS.accent.orange
                    : COLORS.accent.cyan
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            minHeight: 64,
          }}
        >
          <Typography
            variant="overline"
            sx={{
              color:
                status.kind === 'error'
                  ? COLORS.accent.red
                  : status.kind === 'done'
                    ? COLORS.accent.green
                    : COLORS.accent.cyan,
              flexShrink: 0,
            }}
          >
            RESULT
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {status.kind === 'idle' && (
              <Typography
                sx={{
                  color: COLORS.text.label,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  fontSize: '0.85rem',
                }}
              >
                Upload both images, then run analysis.
              </Typography>
            )}
            {status.kind === 'running' && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <FiberManualRecordIcon
                  sx={{
                    fontSize: 8,
                    color: COLORS.accent.orange,
                    animation: 'pulse 1.2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.3, transform: 'scale(0.85)' },
                      '50%': { opacity: 1, transform: 'scale(1)' },
                    },
                  }}
                />
                <Typography
                  sx={{
                    color: COLORS.text.primary,
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  PROCESSING_IMAGERY…
                </Typography>
              </Box>
            )}
            {status.kind === 'done' && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <CheckCircleOutlineIcon
                  sx={{ fontSize: 16, color: COLORS.accent.green, mt: 0.25 }}
                />
                <Typography
                  sx={{
                    color: COLORS.text.primary,
                    fontFamily: '"IBM Plex Sans", sans-serif',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  {status.summary}
                </Typography>
              </Box>
            )}
            {status.kind === 'error' && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <ErrorOutlineIcon
                  sx={{ fontSize: 16, color: COLORS.accent.red, mt: 0.25 }}
                />
                <Typography
                  sx={{
                    color: COLORS.accent.red,
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '0.85rem',
                  }}
                >
                  ERROR: {status.message}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            mt: 5,
            pt: 2,
            borderTop: `1px solid ${COLORS.bg.border}`,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: COLORS.text.muted }}>
            // CLIENT-SIDE PREVIEW · MULTIPART/FORM-DATA POST · {new Date().toISOString().slice(0, 10)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default UploadPage;
