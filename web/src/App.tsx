import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Enter } from './pages/Enter';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { Library } from './pages/Library';

/**
 * Basta con tener un token en el navegador para entrar.
 * El token se emite al escribir un nombre, sin contraseña.
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/entrar" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/entrar"
          element={
            <PublicRoute>
              <Enter />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/sala/:roomId"
          element={
            <PrivateRoute>
              <Room />
            </PrivateRoute>
          }
        />
        <Route
          path="/biblioteca"
          element={
            <PrivateRoute>
              <Library />
            </PrivateRoute>
          }
        />
        {/* Rutas viejas por si alguien tiene un enlace guardado */}
        <Route path="/login" element={<Navigate to="/entrar" replace />} />
        <Route path="/register" element={<Navigate to="/entrar" replace />} />
        <Route path="/upload" element={<Navigate to="/biblioteca" replace />} />
        <Route path="/room/:roomId" element={<Navigate to="/sala/:roomId" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
