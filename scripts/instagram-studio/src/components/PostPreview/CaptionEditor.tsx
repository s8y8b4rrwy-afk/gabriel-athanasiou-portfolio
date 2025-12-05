import React, { useState, useCallback } from 'react';
import './CaptionEditor.css';
import { getCaptionLength } from '../../utils';

interface CaptionEditorProps {
  caption: string;
  hashtags: string[];
  onCaptionChange: (caption: string) => void;
  onHashtagsChange: (hashtags: string[]) => void;
  onCopy: () => void;
  onRegenerate: () => void;
}

export function CaptionEditor({
  caption,
  hashtags,
  onCaptionChange,
  onHashtagsChange,
  onCopy,
  onRegenerate,
}: CaptionEditorProps) {
  const [showHashtagEditor, setShowHashtagEditor] = useState(false);
  const [newHashtag, setNewHashtag] = useState('');
  const [copied, setCopied] = useState(false);

  const { length, isValid, remaining } = getCaptionLength(caption);

  const handleCopy = useCallback(() => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  const handleAddHashtag = () => {
    if (newHashtag.trim()) {
      const tag = newHashtag.startsWith('#') ? newHashtag : `#${newHashtag}`;
      if (!hashtags.includes(tag)) {
        onHashtagsChange([...hashtags, tag.toLowerCase().replace(/\s+/g, '')]);
      }
      setNewHashtag('');
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    onHashtagsChange(hashtags.filter((h) => h !== tag));
  };

  return (
    <div className="caption-editor">
      <div className="caption-editor-header">
        <h3>Caption</h3>
        <div className="caption-editor-actions">
          <button className="caption-action" onClick={onRegenerate} title="Regenerate Caption">
            🔄 Regenerate
          </button>
          <button
            className={`caption-action caption-action--primary ${copied ? 'caption-action--copied' : ''}`}
            onClick={handleCopy}
            title="Copy Caption"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="caption-textarea-container">
        <textarea
          className="caption-textarea"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Your caption will appear here..."
          rows={12}
        />
        <div className={`caption-counter ${!isValid ? 'caption-counter--error' : ''}`}>
          {length} / 2,200 characters
          {remaining < 200 && isValid && (
            <span className="caption-counter-warning"> ({remaining} remaining)</span>
          )}
        </div>
      </div>

      <div className="hashtag-section">
        <button
          className="hashtag-toggle"
          onClick={() => setShowHashtagEditor(!showHashtagEditor)}
        >
          <span>🏷️ Hashtags ({hashtags.length})</span>
          <span className="hashtag-toggle-icon">{showHashtagEditor ? '▲' : '▼'}</span>
        </button>

        {showHashtagEditor && (
          <div className="hashtag-editor">
            <div className="hashtag-add">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
                placeholder="Add hashtag..."
                className="hashtag-input"
              />
              <button className="hashtag-add-button" onClick={handleAddHashtag}>
                +
              </button>
            </div>
            <div className="hashtag-list">
              {hashtags.map((tag) => (
                <span key={tag} className="hashtag-tag">
                  {tag}
                  <button
                    className="hashtag-remove"
                    onClick={() => handleRemoveHashtag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
