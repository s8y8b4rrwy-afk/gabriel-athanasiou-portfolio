
import React from 'react';
import { HomeConfig } from '../../types';
import { THEME } from '../../theme';
import { useLocation, useNavigate } from 'react-router-dom';
import { OptimizedImage } from '../common/OptimizedImage';
// import { saveScrollPosition } from '../../utils/scrollRestoration';

interface AboutViewProps {
    config: HomeConfig;
}

export const AboutView: React.FC<AboutViewProps> = ({ config }) => {
    const [showContent, setShowContent] = React.useState(false);
    const isPostProduction = config.portfolioId === 'postproduction';
    
    React.useEffect(() => {
        if (THEME.pageTransitions.enabled) {
            setShowContent(false);
            const timer = setTimeout(() => setShowContent(true), THEME.pageTransitions.delay);
            return () => clearTimeout(timer);
        } else {
            setShowContent(true);
        }
    }, []);
    
    // Get dynamic title - use portfolio owner name or fall back to default
    const displayName = config.portfolioOwnerName || 'Gabriel Athanasiou';
    // Post-production doesn't show a role, directing shows "Freelance Director"
    const roleText = isPostProduction ? null : 'Freelance Director';
    
    return (
        <section className={`pt-24 md:pt-28 ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} min-h-[calc(100vh-80px)] flex flex-col transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'} animate-fade-in-up`}>
            {/* Scroll Top on Mount */}
            <span className="hidden" ref={() => window.scrollTo(0,0)}></span>
            
            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start flex-1">
                {/* Profile Image */}
                <div className="md:col-span-5">
                    <div className={`w-full aspect-[3/4] overflow-hidden relative transition duration-1000 ${isPostProduction ? 'bg-gray-100' : 'bg-gray-900 grayscale hover:grayscale-0'}`}>
                        <OptimizedImage
                            recordId="aboutImage"
                            fallbackUrl={config.about?.profileImage || ''}
                            type="config"
                            index={0}
                            totalImages={1}
                            alt="Profile"
                            loading="lazy"
                            preset={THEME.about.profileImagePreset}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
                
                {/* Content */}
                <div className="md:col-span-7 md:pl-8 lg:pl-12 flex flex-col justify-between h-full">
                    {/* Bio Section */}
                    <div className="mb-auto">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif italic mb-4 text-white">
                            {isPostProduction ? `Welcome to ${displayName}` : displayName}
                        </h1>
                        <p className="text-text-muted text-sm mb-6">
                            {roleText && <>{roleText}<span className="mx-2 opacity-50">·</span></>}
                            <span className="italic">London</span>
                            <span className="opacity-50 mx-1">&</span>
                            <span className="italic">Worldwide</span>
                        </p>
                        <div className="text-sm md:text-base leading-relaxed text-text-muted font-light space-y-4 max-w-xl">
                            {config.about?.bio?.split('\n').map((para, i) => (
                                para.trim() && <p key={i}>{para}</p>
                            ))}
                        </div>
                    </div>
                    
                    {/* Contact Section */}
                    <div className="border-t border-white/10 pt-8 mt-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12">
                            {/* Get in Touch */}
                            <div>
                                <p className={`${THEME.typography.meta} text-text-muted mb-4`}>Get in Touch</p>
                                {config.contact?.email && (
                                    <a 
                                        href={`mailto:${config.contact.email}`} 
                                        className="text-sm text-white hover:opacity-70 transition decoration-transparent block"
                                    >
                                        {config.contact.email}
                                    </a>
                                )}
                                {config.contact?.phone && <p className="text-text-muted text-sm mt-2">{config.contact.phone}</p>}
                                <div className="flex flex-wrap gap-4 mt-6">
                                    {config.contact?.instagram && <a href={config.contact.instagram} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>Instagram</a>}
                                    {config.contact?.vimeo && <a href={config.contact.vimeo} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>Vimeo</a>}
                                    {config.contact?.linkedin && <a href={config.contact.linkedin} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>LinkedIn</a>}
                                    {config.contact?.imdb && <a href={config.contact.imdb} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>IMDb</a>}
                                </div>
                            </div>
                            
                            {/* Representation */}
                            <div>
                                <p className={`${THEME.typography.meta} text-text-muted mb-4`}>Representation</p>
                                {config.contact?.repUK && (
                                    <div className="mb-4">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">UK / Europe</p>
                                        <p className="text-text-muted leading-relaxed text-sm whitespace-pre-line">{config.contact.repUK}</p>
                                    </div>
                                )}
                                {config.contact?.repUSA && (
                                    <div>
                                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">USA</p>
                                        <p className="text-text-muted leading-relaxed text-sm whitespace-pre-line">{config.contact.repUSA}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
