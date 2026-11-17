import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider as SessionProvider } from './context/SessionContext';
import LoginView from './components/auth/LoginView';
import DashboardPlaceholder from './components/auth/DashboardPlaceholder';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginView />} />
          <Route
            path="/admin"
            element={
              <DashboardPlaceholder
                title="Dashboard de Administrador"
                requiredRole="ADMIN"
              />
            }
          />
          <Route
            path="/comite"
            element={
              <DashboardPlaceholder
                title="Dashboard del Comité"
                requiredRole="COMITE"
              />
            }
          />
          <Route
            path="/autor"
            element={
              <DashboardPlaceholder
                title="Dashboard del Autor"
                requiredRole="AUTOR"
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);