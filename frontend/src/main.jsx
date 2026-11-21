import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider as SessionProvider } from './context/SessionContext';
import LoginView from './components/auth/LoginView';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/admin" element={<Navigate to="/#usuarios" replace />} />
          <Route path="/comite" element={<Navigate to="/#usuarios" replace />} />
          <Route path="/autor" element={<Navigate to="/#articulos" replace />} />
          <Route path="/usuarios" element={<Navigate to="/#usuarios" replace />} />
          <Route path="/catalogo" element={<Navigate to="/#articulos" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);