import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { EvaluationPanel } from './components/EvaluationPanel/EvaluationPanel';
import { MapView } from './components/MapView/MapView';
import { ChatBot } from './components/ChatBot/ChatBot';
import { Overview } from './pages/Overview';
import { SignIn } from './pages/SignIn';
import { UploadPage } from './pages/upload';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Mission Overview', subtitle: 'Hurricane Harvey · Houston, TX · 2017' },
  '/map': { title: 'Geospatial Map', subtitle: 'Interactive aerial imagery + damage overlays' },
  '/evaluation': { title: 'Model Evaluation', subtitle: 'VLM predictions vs FEMA ground truth labels' },
  '/chatbot': { title: 'Query Bot', subtitle: 'Natural language damage impact queries' },
  '/upload': { title: 'Damage Assessment', subtitle: 'Pre/post imagery comparison' },
};

const AppLayout: React.FC<{ path: string; children: React.ReactNode }> = ({ path, children }) => {
  const meta = PAGE_META[path] ?? PAGE_META['/'];
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar title={meta.title} subtitle={meta.subtitle} />
        <Box sx={{ flex: 1, overflowY: 'auto', backgroundColor: 'background.default' }}>
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
          <Route
            path="/"
            element={
              <AppLayout path="/">
                <Overview />
              </AppLayout>
            }
          />
          <Route
            path="/map"
            element={
              <AppLayout path="/map">
                <MapView />
              </AppLayout>
            }
          />
          <Route
            path="/evaluation"
            element={
              <AppLayout path="/evaluation">
                <EvaluationPanel />
              </AppLayout>
            }
          />
          <Route
            path="/chatbot"
            element={
              <AppLayout path="/chatbot">
                <ChatBot />
              </AppLayout>
            }
            />
            <Route
            path="/login" 
            element={<AppLayout path="/login">
                <SignIn />
              </AppLayout>
            }
	    />
	    
	    <Route
	    path="/upload"
	    element={
	    <AppLayout path="/upload">
	    <UploadPage />
	    </AppLayout>
	    }
	    />
          
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
