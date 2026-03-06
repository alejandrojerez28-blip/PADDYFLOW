import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import BillingSettings from './pages/BillingSettings';
import BillingSuccess from './pages/BillingSuccess';
import BillingCancel from './pages/BillingCancel';
import FiscalSettings from './pages/FiscalSettings';
import Sales from './pages/Sales';
import WeighTickets from './pages/WeighTickets';
import WeighTicketPrint from './pages/WeighTicketPrint';
import ThirdParties from './pages/ThirdParties';
import Settlements from './pages/Settlements';
import SettlementsNew from './pages/SettlementsNew';
import SettlementDetail from './pages/SettlementDetail';
import SupplierSettlementPrint from './pages/SupplierSettlementPrint';
import Lots from './pages/Lots';
import LotDetail from './pages/LotDetail';
import Inventory from './pages/Inventory';
import YieldReport from './pages/YieldReport';
import LegalTerms from './pages/LegalTerms';
import LegalPrivacy from './pages/LegalPrivacy';

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
          <Route path="/weigh-tickets" element={<WeighTickets />} />
          <Route path="/third-parties" element={<ThirdParties />} />
          <Route path="/settlements" element={<Settlements />} />
          <Route path="/settlements/new" element={<SettlementsNew />} />
          <Route path="/settlements/:id" element={<SettlementDetail />} />
          <Route path="/print/supplier-settlement/:id" element={<SupplierSettlementPrint />} />
          <Route path="/lots" element={<Lots />} />
          <Route path="/lots/:id" element={<LotDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reports/yield" element={<YieldReport />} />
          <Route path="/legal/terms" element={<LegalTerms />} />
          <Route path="/legal/privacy" element={<LegalPrivacy />} />
          <Route path="/print/weigh-ticket/:id" element={<WeighTicketPrint />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
