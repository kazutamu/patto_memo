import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Login, ProtectedRoute } from './components';
import { MainApp } from './MainApp';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;