import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  Chip,
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { COLORS } from '../../theme';
import type { ChatMessage } from '../../types';

const SUGGESTED_QUERIES = [
  'How many buildings were destroyed on Gulf Freeway?',
  'What is the damage level at 1245 Almeda Rd?',
  'Show streets with major damage',
  'Compare model accuracy for destroyed class',
  'Which areas had the highest flood impact?',
];

const MOCK_RESPONSES: Record<string, string> = {
  default: `I'm the DisasterSight Query Bot. I can answer questions about building damage assessments, specific addresses, streets, and model evaluation results for Hurricane Harvey (Houston, TX 2017). Try asking about a specific address or damage category.`,
  alameda: `📍 1245 Almeda Rd, Houston TX 77054\n\nFEMA Label: DESTROYED\nModel Prediction: DESTROYED ✓ (Correct)\nConfidence: 94%\n\nNotes: Complete structural failure reported. Located in the Almeda corridor which experienced severe inundation (est. 60+ inches water depth).`,
  gulf: `🛣️ Gulf Freeway Corridor Analysis\n\n8823 Gulf Freeway — Major Damage (model: Major ✓)\n\nThe Gulf Freeway corridor showed significant damage concentration, with 68% of assessed structures reporting major or destroyed classification. Primary cause: storm surge + extended flooding.`,
  destroyed: `📊 Destroyed Class Performance\n\nPrecision: 88% | Recall: 85% | F1: 86.5%\nTrue Positives: 173 | Total Labeled: 203\n\nThe VLM performs best on the "Destroyed" category — likely because total structural collapse presents unambiguous visual features in post-event imagery.`,
};

function getResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('almeda') || q.includes('1245')) return MOCK_RESPONSES.alameda;
  if (q.includes('gulf') || q.includes('freeway')) return MOCK_RESPONSES.gulf;
  if (q.includes('destroy') || q.includes('accuracy')) return MOCK_RESPONSES.destroyed;
  return MOCK_RESPONSES.default;
}

export const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: MOCK_RESPONSES.default,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getResponse(text),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="overline"
          sx={{ color: COLORS.accent.cyan, letterSpacing: '0.2em', fontSize: '0.65rem' }}
        >
          QUERY INTERFACE ／ NATURAL LANGUAGE DAMAGE LOOKUP
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
          DisasterSight Query Bot
        </Typography>
      </Box>

      {/* Chat window */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <CardContent
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {messages.map((msg) => (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                gap: 1.5,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  backgroundColor:
                    msg.role === 'assistant'
                      ? `${COLORS.accent.cyan}22`
                      : `${COLORS.accent.orange}22`,
                  border: `1px solid ${msg.role === 'assistant' ? COLORS.accent.cyan : COLORS.accent.orange}44`,
                  flexShrink: 0,
                }}
              >
                {msg.role === 'assistant' ? (
                  <SmartToyOutlinedIcon sx={{ fontSize: 16, color: COLORS.accent.cyan }} />
                ) : (
                  <PersonOutlineIcon sx={{ fontSize: 16, color: COLORS.accent.orange }} />
                )}
              </Avatar>
              <Box
                sx={{
                  maxWidth: '75%',
                  backgroundColor:
                    msg.role === 'assistant' ? COLORS.bg.elevated : `${COLORS.accent.orange}18`,
                  border: `1px solid ${
                    msg.role === 'assistant' ? COLORS.bg.border : `${COLORS.accent.orange}33`
                  }`,
                  borderRadius: 1.5,
                  px: 2,
                  py: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    color: COLORS.text.primary,
                    whiteSpace: 'pre-line',
                    lineHeight: 1.6,
                  }}
                >
                  {msg.content}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: COLORS.text.muted, mt: 0.5 }}>
                  {msg.timestamp.toLocaleTimeString('en-US', { hour12: false })}
                </Typography>
              </Box>
            </Box>
          ))}
          <div ref={bottomRef} />
        </CardContent>

        {/* Suggested queries */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${COLORS.bg.border}`,
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {SUGGESTED_QUERIES.map((q) => (
            <Chip
              key={q}
              label={q}
              size="small"
              onClick={() => sendMessage(q)}
              sx={{
                fontFamily: '"IBM Plex Sans", sans-serif',
                fontSize: '0.65rem',
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

        {/* Input */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${COLORS.bg.border}`,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(input); }}
            placeholder="Ask about an address, street, or damage category…"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: '"IBM Plex Sans", sans-serif',
                fontSize: '0.82rem',
                backgroundColor: COLORS.bg.dark,
                '& fieldset': { borderColor: COLORS.bg.border },
                '&:hover fieldset': { borderColor: COLORS.accent.cyan + '66' },
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
              '&:hover': { backgroundColor: `${COLORS.accent.cyan}33` },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Card>
    </Box>
  );
};
