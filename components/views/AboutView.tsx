
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
    React.useEffect(() => {
        if (THEME.pageTransitions.enabled) {
            setShowContent(false);
            const timer = setTimeout(() => setShowContent(true), THEME.pageTransitions.delay);
            return () => clearTimeout(timer);
        } else {
            setShowContent(true);
        }
    }, []);
    return (
        <section className={`${THEME.filmography.paddingTop} ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} min-h-screen flex flex-col justify-between transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'} animate-fade-in-up`}>
            {/* Scroll Top on Mount */}
            <span className="hidden" ref={() => window.scrollTo(0,0)}></span>
            
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
                <div className="md:col-span-5">
                    <div className="w-full aspect-[3/4] bg-gray-900 overflow-hidden relative grayscale hover:grayscale-0 transition duration-1000">
                        <OptimizedImage
                            recordId="config-profile"
                            fallbackUrl={config.about?.profileImage || ''}
                            type="config"
                            index={0}
                            totalImages={1}
                            alt="Profile"
                            loading="lazy"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
                <div className="md:col-span-7 md:pl-12 flex flex-col h-full">
                    <div className="mb-16">
                        <h1 className={`${THEME.typography.h1} mb-12 mix-blend-difference text-white`}>Gabriel Athanasiou</h1>
                        <div className="text-lg md:text-xl leading-relaxed text-gray-300 font-light space-y-8 max-w-2xl">
                            {config.about?.bio?.split('\n').map((para, i) => (
                                para.trim() && <p key={i}>{para}</p>
                            ))}
                        </div>
                    </div>
                    {/* Contact Section */}
                    <div className="mt-auto border-t border-white/10 pt-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div>
                                <p className={`${THEME.typography.meta} text-text-muted mb-6`}>Get in Touch</p>
                                {config.contact?.email && (
                                    <a 
                                        href={`mailto:${config.contact.email}`} 
                                        className={`${THEME.typography.h3} text-white hover:opacity-70 transition mb-6 decoration-transparent block`}
                                    >
                                        {config.contact.email}
                                    </a>
                                )}
                                {config.contact?.phone && <p className="text-gray-400 mb-6">{config.contact.phone}</p>}
                                <div className="flex gap-6 mt-8">
                                    {config.contact?.instagram && <a href={config.contact.instagram} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>Instagram</a>}
                                    {config.contact?.vimeo && <a href={config.contact.vimeo} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>Vimeo</a>}
                                    {config.contact?.linkedin && <a href={config.contact.linkedin} target="_blank" rel="noopener noreferrer" className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>LinkedIn</a>}
                                </div>
                            </div>
                            <div>
                                <p className={`${THEME.typography.meta} text-text-muted mb-6`}>Representation</p>
                                {config.contact?.repUK && (
                                    <div className="mb-6">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">UK / Europe</p>
                                        <p className="text-gray-400 leading-relaxed text-sm whitespace-pre-line">{config.contact.repUK}</p>
                                    </div>
                                )}
                                {config.contact?.repUSA && (
                                    <div>
                                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">USA</p>
                                        <p className="text-gray-400 leading-relaxed text-sm whitespace-pre-line">{config.contact.repUSA}</p>
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
