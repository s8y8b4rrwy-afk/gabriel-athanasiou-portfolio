
import React from 'react';
import { getEmbedUrl } from '../services/cmsService';

interface VideoEmbedProps {
  url: string;
  autoplay?: boolean;
  muted?: boolean;
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, autoplay = false, muted = false }) => {
  const embedUrl = getEmbedUrl(url, autoplay, muted);

  if (!embedUrl) return null;

  return (
    <div className="w-full h-full bg-black">
      <iframe 
        src={embedUrl}
        className="w-full h-full"
        frameBorder="0" 
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </div>
  );
};
