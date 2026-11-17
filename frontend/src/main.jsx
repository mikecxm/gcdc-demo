import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { AuthProvider as SessionProvider } from './context/SessionContext';
import LoginView from './components/auth/LoginView';
import DashboardPlaceholder from './components/auth/DashboardPlaceholder';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<LoginView />} />
            <Route
              path="/admin"
              element={<DashboardPlaceholder title="Dashboard de Administrador" />}
            />
            <Route
              path="/comite"
              element={<DashboardPlaceholder title="Dashboard del Comité" />}
            />
            <Route
              path="/autor"
              element={<DashboardPlaceholder title="Dashboard del Autor" />}
            />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </AuthProvider>
  </StrictMode>,
);