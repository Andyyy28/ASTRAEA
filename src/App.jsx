import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Customer Pages
import Home from './pages/customer/Home';
const Shop = lazy(() => import('./pages/customer/Shop'));
const ShopDetail = lazy(() => import('./pages/customer/ShopDetail'));
const Customize = lazy(() => import('./pages/customer/Customize'));
const OtherProducts = lazy(() => import('./pages/customer/OtherProducts'));
const OtherProductDetail = lazy(() => import('./pages/customer/OtherProductDetail'));
const Cart = lazy(() => import('./pages/customer/Cart'));
const Checkout = lazy(() => import('./pages/customer/Checkout'));
const TrackOrder = lazy(() => import('./pages/customer/TrackOrder'));
const FAQ = lazy(() => import('./pages/customer/FAQ'));
const Contact = lazy(() => import('./pages/customer/Contact'));
const Share = lazy(() => import('./pages/customer/Share'));

// Admin Pages
import AdminLayout from './components/AdminLayout';
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminBouquets = lazy(() => import('./pages/admin/AdminBouquets'));
const AdminOtherProducts = lazy(() => import('./pages/admin/AdminOtherProducts'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

const CustomerLayout = () => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-grow">
      <Outlet />
    </main>
    <Footer />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <Router>
            <Suspense fallback={<div role="status" className="text-center p-16">Loading Astraea…</div>}>
            <Routes>
            {/* Customer Routes */}
            <Route element={<CustomerLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:id" element={<ShopDetail />} />
              <Route path="/customize" element={<Customize />} />
              <Route path="/other-products" element={<OtherProducts />} />
              <Route path="/other-products/:id" element={<OtherProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/share" element={<Share />} />
              <Route path="*" element={<div className="text-center p-20">Page Coming Soon</div>} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
              <Route path="/admin/inventory" element={<AdminInventory />} />
              <Route path="/admin/bouquets" element={<AdminBouquets />} />
              <Route path="/admin/other-products" element={<AdminOtherProducts />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
            </Routes>
            </Suspense>
          </Router>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
