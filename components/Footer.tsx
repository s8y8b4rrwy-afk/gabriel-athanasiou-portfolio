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
    
    // Get dynamic values from config
    const footerName = config.navTitle || config.portfolioOwnerName || 'Gabriel Athanasiou';
    const footerTitle = config.portfolioId === 'postproduction' 
        ? 'Freelance Colourist & Editor' 
        : 'Freelance Director';
    
    if (!hasContact && !hasRepresentation) return null;

    const currentYear = new Date().getFullYear();

    return (
        <footer className={`${THEME.header.paddingX} py-12 md:py-16 border-t border-white/10 bg-bg-main`}>
            <div className="max-w-7xl mx-auto">
                {/* Main info row */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 md:gap-12">
                    {/* Left: Name & Title */}
                    <div className="flex-shrink-0">
                        <p className={`${THEME.typography.meta} text-white mb-2`}>{footerName}</p>
                        <p className="text-gray-400 text-sm">
                            {footerTitle}
                            <span className="mx-2 text-gray-600">·</span>
                            <span className="italic">London</span>
                            <span className="text-gray-500 mx-1">&</span>
                            <span className="italic">Worldwide</span>
                        </p>
                        {config.contact?.email && (
                            <a 
                                href={`mailto:${config.contact.email}`}
                                className="text-gray-400 text-sm hover:text-white transition mt-2 block"
                            >
                                {config.contact.email}
                            </a>
                        )}
                    </div>

                    {/* Middle: Representation */}
                    {hasRepresentation && (
                        <div>
                            <p className={`${THEME.typography.meta} text-text-muted mb-3`}>Rep'd by</p>
                            <div className="flex gap-8 md:gap-12">
                                {config.contact?.repUK && (
                                    <div>
                                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">UK / Europe</p>
                                        <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-line">{config.contact.repUK}</p>
                                    </div>
                                )}
                                {config.contact?.repUSA && (
                                    <div>
                                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">USA</p>
                                        <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-line">{config.contact.repUSA}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right: Social Links */}
                    <div>
                        <p className={`${THEME.typography.meta} text-text-muted mb-3`}>Find me on</p>
                        <div className="flex gap-4 md:gap-6">
                            {config.contact?.instagram && (
                                <a href={config.contact.instagram} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>
                                    Instagram
                                </a>
                            )}
                            {config.contact?.vimeo && (
                                <a href={config.contact.vimeo} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>
                                    Vimeo
                                </a>
                            )}
                            {config.contact?.linkedin && (
                                <a href={config.contact.linkedin} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>
                                    LinkedIn
                                </a>
                            )}
                            {config.contact?.imdb && (
                                <a href={config.contact.imdb} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>
                                    IMDb
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Other Portfolio Link (for cross-portfolio navigation) */}
                {hasOtherPortfolio && (
                    <div className="mt-8 pt-6 border-t border-white/5">
                        <a 
                            href={config.otherPortfolioUrl}
                            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition group"
                        >
                            <span>→</span>
                            <span>{config.otherPortfolioLabel || 'View Other Portfolio'}</span>
                        </a>
                    </div>
                )}

                {/* Copyright row */}
                <div className="mt-10 pt-6 border-t border-white/5 flex justify-end">
                    <p className="text-gray-600 text-xs">
                        © {currentYear} Designed by {footerName}.
                    </p>
                </div>
            </div>
        </footer>
    );
};
