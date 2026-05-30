import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, X } from 'lucide-react';

import { useCart } from '../context/CartContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { cartCount } = useCart();

  const flowerIcon = String.fromCodePoint(10047);
  const heartIcon = String.fromCodePoint(9825);
  const starIcon = String.fromCodePoint(9733);
  const sparkIcon = String.fromCodePoint(10022);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Customize', path: '/customize' },
    { name: 'Other Products', path: '/other-products' },
    { name: 'Track Order', path: '/track-order' },
    { name: 'Contact', path: '/contact' },
  ];

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-30 bg-astraea-blush/95 backdrop-blur-md border-b-2 border-dashed border-astraea-pink shadow-[0_2px_0px_#F9A8C9] animate-fade-in transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link
              to="/"
              className="font-heading text-xl sm:text-2xl md:text-3xl font-extrabold text-astraea-darkgray tracking-wide flex items-center gap-2 rounded-full px-3 py-2 hover:bg-white/70"
            >
              <span className="text-astraea-pink">{flowerIcon}</span>
              Astraea Collection
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all hover:bg-white/80 hover:text-astraea-pink
                  ${isActive(link.path) ? 'bg-white text-astraea-pink shadow-[2px_2px_0px_#F9A8C9]' : 'text-astraea-darkgray'}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/cart"
              className="relative min-h-11 min-w-11 p-2 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink transition-colors rounded-full bg-white/70 border border-dashed border-astraea-pink"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-astraea-pink rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-[12px] border-2 border-[#F4BFCF] bg-white px-[10px] py-2 text-[#E891B8] shadow-[2px_2px_0px_#F9A8C9] focus:outline-none"
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <span className="flex flex-col gap-1">
                    <span className="block h-0.5 w-5 rounded-full bg-[#E891B8]" />
                    <span className="block h-0.5 w-5 rounded-full bg-[#E891B8]" />
                    <span className="block h-0.5 w-5 rounded-full bg-[#E891B8]" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          aria-label="Close drawer backdrop"
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 h-full w-full bg-[#3D2C35] opacity-50"
        />

        <div
          className={`absolute left-0 top-0 z-50 flex h-screen w-[80vw] max-w-[300px] flex-col overflow-y-auto bg-[#FDDDE6] shadow-[4px_0px_20px_rgba(249,168,201,0.4)] transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="border-b-2 border-dashed border-[#E891B8] bg-[#F9A8C9] px-5 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="font-heading text-[18px] font-bold text-white">
                <span className="mr-1">{flowerIcon}</span>Astraea Collection
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#E891B8] bg-white text-[18px] text-[#E891B8]"
                aria-label="Close menu"
              >
                {String.fromCodePoint(215)}
              </button>
            </div>
          </div>

          <nav className="flex-1 py-2">
            {navLinks.map((link, index) => {
              const icons = [heartIcon, flowerIcon, starIcon, sparkIcon, heartIcon, flowerIcon];
              const icon = icons[index] || flowerIcon;

              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block border-b border-dashed border-[#F4BFCF] px-5 py-[14px] font-heading text-[16px] font-semibold text-[#3D2C35] transition-colors ${
                    isActive(link.path)
                      ? 'border-l-[3px] border-l-[#F9A8C9] bg-[#FDDDE6] text-[#E891B8]'
                      : 'bg-transparent hover:bg-[#FFF5F7] hover:text-[#E891B8]'
                  }`}
                >
                  <span className="mr-2 inline-block">{icon}</span>
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="border-t-2 border-dashed border-[#F4BFCF] p-5">
            <Link
              to="/cart"
              onClick={() => setIsOpen(false)}
              className="kawaii-btn-primary w-full justify-center bg-[#F9A8C9] px-4 py-3 text-base text-white"
            >
              <ShoppingCart className="h-4 w-4" />
              View Cart ({cartCount} {cartCount === 1 ? 'item' : 'items'})
            </Link>
            <p className="mt-3 text-center font-accent text-[18px] text-[#C4658A]">
              Sweet blooms, handmade with care.
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
