import React from 'react';
import { VelyxoraLogo } from '../logo/VelyxoraLogo';
import { Youtube, Instagram, Facebook, Twitter, MessageCircle, MessagesSquare, Music2 } from 'lucide-react';

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
    <footer className="w-full border-t border-white/[0.06] bg-[#08090D] py-8 px-4 sm:px-6 mt-16 pb-20 lg:pb-8">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-5">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-center gap-3 text-center sm:text-left">
          <VelyxoraLogo variant="isotype" size="sm" />
          <span className="text-xs text-slate-400">
            VELYXORA © {new Date().getFullYear()} • Universal Conversion & Media Toolkit
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <button
            onClick={() => onNavigate('category', 'all')}
            className="min-h-11 rounded-lg px-2 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Herramientas
          </button>
          <button
            onClick={() => onNavigate('about')}
            className="min-h-11 rounded-lg px-2 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Acerca de
          </button>
          <button
            onClick={() => onNavigate('privacy')}
            className="min-h-11 rounded-lg px-2 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Privacidad
          </button>
          <button
            onClick={() => onNavigate('terms')}
            className="min-h-11 rounded-lg px-2 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
          >
            Términos
          </button>
        </div>
        </div>

        <nav aria-label="Redes sociales y comunidad" className="flex max-w-full flex-wrap items-center justify-center gap-2 border-t border-white/[0.06] pt-4">
          {socialLinks.map(({ label, href, icon: Icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 transition-colors hover:border-indigo-500/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};
