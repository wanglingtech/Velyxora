import React from 'react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';
import { Youtube, Instagram, Facebook, Twitter, MessageCircle, MessagesSquare, Music2, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, param?: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const socialLinks = [
    { label: 'YouTube de WangLing', href: 'https://www.youtube.com/@xWangLingx', icon: Youtube },
    { label: 'Instagram de WangLing', href: 'https://instagram.com/xwanglingx', icon: Instagram },
    { label: 'TikTok de WangLing', href: 'https://tiktok.com/@xwanglingx', icon: Music2 },
    { label: 'Facebook', href: 'https://facebook.com/AniMe-Of-LeGends-103320744933189', icon: Facebook },
    { label: 'X de Kevin', href: 'https://x.com/KevinGOD123478', icon: Twitter },
    { label: 'Comunidad de WhatsApp', href: 'https://chat.whatsapp.com/CuUrTGI4Mfy7DFpD2cY5VP', icon: MessageCircle },
    { label: 'Discord WangLing Army', href: 'https://discord.gg/tkDPuxAXz', icon: MessagesSquare },
  ];
  return (
    <footer className="mt-16 w-full min-w-0 border-t border-white/[0.06] bg-[#08090D] px-4 pb-28 pt-8 sm:px-6 lg:pb-24">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        {/* Brand + credit line: centered on phones, left-aligned from large screens. */}
        <div className="min-w-0 space-y-2 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <VelyxoraLogo variant="isotype" size="sm" />
            <span className="min-w-0 text-xs text-slate-400 [overflow-wrap:anywhere]">
              VELYXORA © 2026 WangLing Tech. Todos los derechos reservados.
            </span>
          </div>
          <p className="text-xs text-slate-500">Hecho con <span aria-label="amor">❤️</span> por WangLing Tech</p>
        </div>

        {/* Site links: wrap naturally; right-aligned on large screens. */}
        <nav
          aria-label="Enlaces del sitio"
          className="flex min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 lg:justify-end"
        >
          <button
            onClick={() => onNavigate('category', 'all')}
            className="min-h-11 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Herramientas
          </button>
          <button
            onClick={() => onNavigate('about')}
            className="min-h-11 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Acerca de
          </button>
          <button
            onClick={() => onNavigate('support')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-rose-300/90 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            <Heart className="h-3.5 w-3.5" />
            Apoyar
          </button>
          <button
            onClick={() => onNavigate('complaints')}
            className="min-h-11 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >Libro de Reclamaciones</button>
          <button
            onClick={() => onNavigate('suggestions')}
            className="min-h-11 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >Sugerencias y mejoras</button>
          <button
            onClick={() => onNavigate('privacy')}
            className="min-h-11 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Privacidad
          </button>
          <button
            onClick={() => onNavigate('terms')}
            className="min-h-11 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Términos
          </button>
        </nav>
      </div>

      <nav
        aria-label="Redes sociales y comunidad"
        className="mx-auto mt-8 flex max-w-6xl flex-wrap items-center justify-center gap-2 border-t border-white/[0.06] pt-6"
      >
        {socialLinks.map(({ label, href, icon: Icon }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 transition-colors hover:border-indigo-500/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </a>
        ))}
      </nav>
    </footer>
  );
};
