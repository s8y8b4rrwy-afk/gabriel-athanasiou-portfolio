import React from 'react';
import { HomeConfig } from '../types';
import { THEME } from '../theme';

interface FooterProps {
    config: HomeConfig;
}

export const Footer: React.FC<FooterProps> = ({ config }) => {
    const hasContact = config.contact?.email || config.contact?.instagram || config.contact?.vimeo || config.contact?.linkedin || config.contact?.imdb;
    const hasRepresentation = config.contact?.repUK || config.contact?.repUSA;
    const hasOtherPortfolio = config.showOtherPortfolioLink && config.otherPortfolioUrl;
    const hasSocialLinks = config.contact?.instagram || config.contact?.vimeo || config.contact?.linkedin || config.contact?.imdb;
    
    // Get dynamic values from config
    const footerName = config.navTitle || config.portfolioOwnerName || 'Gabriel Athanasiou';
    const footerTitle = config.portfolioId === 'postproduction' 
        ? 'Freelance Colourist & Editor' 
        : 'Freelance Director';
    
    if (!hasContact && !hasRepresentation) return null;

    const currentYear = new Date().getFullYear();

    return (
        <footer className={`${THEME.header.paddingX} py-16 md:py-20 border-t border-white/10 bg-bg-main`}>
            <div className="max-w-7xl mx-auto">
                
                {/* Mobile: Stacked layout / Desktop: Grid layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
                    
                    {/* Column 1: Name, Title & Email */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium tracking-wider uppercase text-white">
                            {footerName}
                        </h3>
                        <p className="text-sm text-gray-400">
                            {footerTitle}
                        </p>
                        <p className="text-sm text-gray-500">
                            <span className="italic">London</span>
                            <span className="mx-1.5 text-gray-600">&</span>
                            <span className="italic">Worldwide</span>
                        </p>
                        {config.contact?.email && (
                            <a 
                                href={`mailto:${config.contact.email}`}
                                className="text-sm text-gray-400 hover:text-white transition-colors inline-block pt-1"
                            >
                                {config.contact.email}
                            </a>
                        )}
                    </div>

                    {/* Column 2: Representation */}
                    {hasRepresentation && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-medium tracking-wider uppercase text-gray-500">
                                Representation
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                {config.contact?.repUK && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-white uppercase tracking-wide">UK / Europe</p>
                                        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{config.contact.repUK}</p>
                                    </div>
                                )}
                                {config.contact?.repUSA && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-white uppercase tracking-wide">USA</p>
                                        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{config.contact.repUSA}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Column 3: Social Links */}
                    {hasSocialLinks && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-medium tracking-wider uppercase text-gray-500">
                                Connect
                            </h3>
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                {config.contact?.instagram && (
                                    <a href={config.contact.instagram} target="_blank" rel="noopener noreferrer" 
                                       className="text-sm text-gray-400 hover:text-white transition-colors">
                                        Instagram
                                    </a>
                                )}
                                {config.contact?.vimeo && (
                                    <a href={config.contact.vimeo} target="_blank" rel="noopener noreferrer" 
                                       className="text-sm text-gray-400 hover:text-white transition-colors">
                                        Vimeo
                                    </a>
                                )}
                                {config.contact?.linkedin && (
                                    <a href={config.contact.linkedin} target="_blank" rel="noopener noreferrer" 
                                       className="text-sm text-gray-400 hover:text-white transition-colors">
                                        LinkedIn
                                    </a>
                                )}
                                {config.contact?.imdb && (
                                    <a href={config.contact.imdb} target="_blank" rel="noopener noreferrer" 
                                       className="text-sm text-gray-400 hover:text-white transition-colors">
                                        IMDb
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Other Portfolio Link (for cross-portfolio navigation) */}
                {hasOtherPortfolio && (
                    <div className="mt-10 pt-8 border-t border-white/5">
                        <a 
                            href={config.otherPortfolioUrl}
                            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
                        >
                            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                            <span>{config.otherPortfolioLabel || 'View Other Portfolio'}</span>
                        </a>
                    </div>
                )}

                {/* Bottom row: Trading name & Copyright */}
                <div className="mt-12 pt-6 border-t border-white/5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Trading name disclosure (UK legal requirement for sole traders) */}
                        {config.tradingNameDisclosure && (
                            <p className="text-xs text-gray-500 order-2 sm:order-1">
                                {config.tradingNameDisclosure}
                            </p>
                        )}
                        <p className="text-xs text-gray-600 order-1 sm:order-2">
                            © {currentYear} {footerName}
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};
