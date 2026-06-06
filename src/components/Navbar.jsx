import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  HouseHeart,
  Mail,
  MapPin,
  PartyPopper,
  ShoppingBag,
  ShoppingCart,
  WandSparkles,
  X
} from 'lucide-react';

import { useCart } from '../context/CartContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { cartCount } = useCart();

  const flowerIcon = String.fromCodePoint(10047);

  const navLinks = [
    { name: 'Home', path: '/', icon: HouseHeart },
    { name: 'Shop', path: '/shop', icon: ShoppingBag, accent: 'flower' },
    { name: 'Customize', path: '/customize', icon: WandSparkles },
    { name: 'Other Products', path: '/other-products', icon: PartyPopper },
    { name: 'Track Order', path: '/track-order', icon: ClipboardList, accent: 'pin' },
    { name: 'Contact', path: '/contact', icon: Mail, accent: 'flower' },
  ];

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    document.body.style.position = isOpen ? 'fixed' : '';
    document.body.style.width = isOpen ? '100%' : '';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-30 border-b-2 border-dashed border-[#F58AB6]/70 bg-[#FFE7EF]/95 shadow-[0_8px_22px_rgba(249,168,201,0.12)] backdrop-blur-xl animate-fade-in transition-all">
      <div className="pointer-events-none absolute inset-x-0 bottom-[-18px] hidden h-8 items-center justify-center md:flex">
        <div className="h-px flex-1 border-t-2 border-dashed border-[#F58AB6]/80"></div>
        <span className="relative mx-5 h-8 w-12">
          <span className="absolute left-1 top-2 h-5 w-5 rotate-45 rounded-br-full rounded-tl-full border-2 border-[#F58AB6]"></span>
          <span className="absolute right-1 top-2 h-5 w-5 -rotate-45 rounded-bl-full rounded-tr-full border-2 border-[#F58AB6]"></span>
          <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F58AB6]"></span>
        </span>
        <div className="h-px flex-1 border-t-2 border-dashed border-[#F58AB6]/80"></div>
      </div>
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between gap-4 md:h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link
              to="/"
              className="font-heading flex items-center gap-3 rounded-full px-3 py-2 text-xl font-black tracking-wide text-[#C4658A] transition-colors hover:bg-white/70 sm:text-2xl md:text-[2rem]"
            >
              <img src="/web_logo.png" alt="Astraea Collection logo" className="h-[45px] w-[45px] rounded-full object-cover" />
              Astraea Collection
            </Link>
          </div>

          <div className="hidden items-center gap-2 md:flex xl:gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-bold transition-all hover:bg-white/80 hover:text-astraea-pink xl:px-5 xl:text-[16px]
                  ${isActive(link.path) ? 'bg-white text-astraea-pink shadow-[0_2px_0px_#F9A8C9,0_12px_24px_rgba(249,168,201,0.16)] ring-1 ring-[#F4BFCF]' : 'text-astraea-darkgray'}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/cart"
              className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-astraea-pink bg-white/80 text-astraea-darkgray shadow-[2px_2px_0px_#F9A8C9] transition-colors hover:text-astraea-pink"
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
                className="flex min-h-11 min-w-11 items-center justify-center rounded-[12px] border-2 border-[#F4BFCF] bg-white px-[10px] py-2 text-[#E891B8] shadow-[2px_2px_0px_#F9A8C9] focus:outline-none"
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
          className={`absolute left-0 top-0 z-50 flex h-[100dvh] w-[80vw] max-w-[300px] flex-col overflow-hidden bg-[#FDDDE6] shadow-[4px_0px_20px_rgba(249,168,201,0.4)] transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="border-b-2 border-dashed border-[#E891B8] bg-[#F9A8C9] px-5 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="font-heading flex items-center gap-2 text-[18px] font-bold text-[#C4658A]">
                <img src="/web_logo.png" alt="Astraea Collection logo" className="h-[45px] w-[45px] rounded-full object-cover" />
                Astraea Collection
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

          <nav className="min-h-0 flex-1 overflow-y-auto py-2">
            {navLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 border-b border-dashed border-[#F4BFCF] px-5 py-[14px] font-heading text-[16px] font-semibold text-[#3D2C35] transition-colors ${
                    isActive(link.path)
                      ? 'border-l-[3px] border-l-[#F9A8C9] bg-[#FDDDE6] text-[#E891B8]'
                      : 'bg-transparent hover:bg-[#FFF5F7] hover:text-[#E891B8]'
                  }`}
                >
                  <span className="relative grid h-7 w-7 shrink-0 place-items-center text-[#E06591]">
                    <Icon className="h-6 w-6" strokeWidth={2.2} />
                    {link.accent === 'flower' && (
                      <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#FDDDE6] font-heading text-[13px] leading-none text-[#E06591]">
                        {flowerIcon}
                      </span>
                    )}
                    {link.accent === 'pin' && (
                      <MapPin className="absolute -bottom-1 -right-1 h-4 w-4 fill-[#E06591] text-[#E06591]" strokeWidth={2.2} />
                    )}
                  </span>
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto shrink-0 border-t-2 border-dashed border-[#F4BFCF] bg-[#FDDDE6] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
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
