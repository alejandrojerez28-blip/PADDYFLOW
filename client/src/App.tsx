import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import BillingSettings from './pages/BillingSettings';
import BillingSuccess from './pages/BillingSuccess';
import BillingCancel from './pages/BillingCancel';
import FiscalSettings from './pages/FiscalSettings';
import Sales from './pages/Sales';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings/billing" element={<BillingSettings />} />
          <Route path="/settings/fiscal" element={<FiscalSettings />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
