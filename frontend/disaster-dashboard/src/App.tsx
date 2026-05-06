import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { EvaluationPanel } from './components/EvaluationPanel/EvaluationPanel';
import { MapView } from './components/MapView/MapView';
import { ChatBot } from './components/ChatBot/ChatBot';
import { Overview } from './pages/Overview';
import { AuthPage } from './pages/SignIn';
import { UploadPage } from './pages/upload';
import ProtectedRoute from './components/ProtectedRoute';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/':           { title: 'Mission Overview',  subtitle: 'Hurricane Harvey · Houston, TX · 2017' },
  '/map':        { title: 'Geospatial Map',     subtitle: 'Interactive aerial imagery + damage overlays' },
  '/evaluation': { title: 'Model Evaluation',   subtitle: 'VLM predictions vs FEMA ground truth labels' },
  '/chatbot':    { title: 'Query Bot',           subtitle: 'Natural language damage impact queries' },
  '/upload':    { title: 'Upload',           subtitle: 'Tears but no Joy' },
};

const AppLayout: React.FC<{ path: string; children: React.ReactNode }> = ({ path, children }) => {
  const meta = PAGE_META[path] ?? PAGE_META['/'];
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar title={meta.title} subtitle={meta.subtitle} />
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: 'background.default' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public route — no layout, no auth required */}
          <Route path="/login" element={<AuthPage />} />

          {/* Protected routes — redirect to /login if not signed in */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout path="/">
                  <Overview />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <AppLayout path="/map">
                  <MapView />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/evaluation"
            element={
              <ProtectedRoute>
                <AppLayout path="/evaluation">
                  <EvaluationPanel />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chatbot"
            element={
              <ProtectedRoute>
                <AppLayout path="/chatbot">
                  <ChatBot />
                </AppLayout>
              </ProtectedRoute>
            }
          />
	  <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <AppLayout path="/upload">
                  <UploadPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;