import { describe, it, expect } from 'vitest';
import { 
  normalizeTitle, 
  parseCreditsText, 
  escapeHtml, 
  calculateReadingTime 
} from '../textHelpers.mjs';

describe('textHelpers', () => {
  describe('normalizeTitle', () => {
    it('should handle empty or null input', () => {
      expect(normalizeTitle('')).toBe('Untitled');
      expect(normalizeTitle(null)).toBe('Untitled');
      expect(normalizeTitle(undefined)).toBe('Untitled');
    });

    it('should normalize underscores and dashes to spaces', () => {
      expect(normalizeTitle('hello_world-test')).toBe('Hello World Test');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeTitle('hello    world   test')).toBe('Hello World Test');
    });

    it('should capitalize words properly', () => {
      expect(normalizeTitle('HELLO WORLD')).toBe('Hello World');
      expect(normalizeTitle('hello world')).toBe('Hello World');
      expect(normalizeTitle('hElLo WoRlD')).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      expect(normalizeTitle('  hello world  ')).toBe('Hello World');
    });

    it('should handle mixed formatting', () => {
      expect(normalizeTitle('  hello_world-TEST  multiple   spaces  ')).toBe('Hello World Test Multiple Spaces');
    });
  });

  describe('parseCreditsText', () => {
    it('should handle empty or null input', () => {
      expect(parseCreditsText('')).toEqual([]);
      expect(parseCreditsText(null)).toEqual([]);
      expect(parseCreditsText(undefined)).toEqual([]);
    });

    it('should parse comma-separated credits', () => {
      const result = parseCreditsText('Director: John Doe, Producer: Jane Smith');
      expect(result).toEqual([
        { role: 'Director', name: 'John Doe' },
        { role: 'Producer', name: 'Jane Smith' }
      ]);
    });

    it('should parse newline-separated credits', () => {
      const result = parseCreditsText('Director: John Doe\nProducer: Jane Smith');
      expect(result).toEqual([
        { role: 'Director', name: 'John Doe' },
        { role: 'Producer', name: 'Jane Smith' }
      ]);
    });

    it('should parse pipe-separated credits', () => {
      const result = parseCreditsText('Director: John Doe | Producer: Jane Smith');
      expect(result).toEqual([
        { role: 'Director', name: 'John Doe' },
        { role: 'Producer', name: 'Jane Smith' }
      ]);
    });

    it('should handle credits without colons', () => {
      const result = parseCreditsText('John Doe, Jane Smith');
      expect(result).toEqual([
        { role: 'Credit', name: 'John Doe' },
        { role: 'Credit', name: 'Jane Smith' }
      ]);
    });

    it('should handle multiple colons in credit', () => {
      const result = parseCreditsText('Website: https://example.com');
      expect(result).toEqual([
        { role: 'Website', name: 'https://example.com' }
      ]);
    });

    it('should trim whitespace from roles and names', () => {
      const result = parseCreditsText('  Director :  John Doe  ,  Producer :  Jane Smith  ');
      expect(result).toEqual([
        { role: 'Director', name: 'John Doe' },
        { role: 'Producer', name: 'Jane Smith' }
      ]);
    });

    it('should filter out empty entries', () => {
      const result = parseCreditsText('Director: John Doe,,, Producer: Jane Smith');
      expect(result).toEqual([
        { role: 'Director', name: 'John Doe' },
        { role: 'Producer', name: 'Jane Smith' }
      ]);
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape less than and greater than', () => {
      expect(escapeHtml('<div>Hello</div>')).toBe('&lt;div&gt;Hello&lt;/div&gt;');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;');
      expect(escapeHtml("It's fine")).toBe('It&#039;s fine');
    });

    it('should replace newlines with spaces', () => {
      expect(escapeHtml('Line 1\nLine 2')).toBe('Line 1 Line 2');
      expect(escapeHtml('Line 1\r\nLine 2')).toBe('Line 1 Line 2');
    });

    it('should handle multiple special characters', () => {
      expect(escapeHtml('<script>alert("XSS & more")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS &amp; more&quot;)&lt;/script&gt;'
      );
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('calculateReadingTime', () => {
    it('should return minimum reading time for empty content', () => {
      expect(calculateReadingTime('')).toBe('1 min read');
      expect(calculateReadingTime(null)).toBe('1 min read');
      expect(calculateReadingTime(undefined)).toBe('1 min read');
    });

    it('should calculate reading time for short content', () => {
      const words = Array(100).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe('1 min read');
    });

    it('should calculate reading time for medium content', () => {
      const words = Array(450).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe('2 min read');
    });

    it('should calculate reading time for long content', () => {
      const words = Array(1125).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe('5 min read');
    });

    it('should strip HTML tags before counting', () => {
      const content = '<p>Hello world</p><div>More text here</div>';
      const result = calculateReadingTime(content);
      expect(result).toBe('1 min read');
    });

    it('should round up to nearest minute', () => {
      const words = Array(226).fill('word').join(' '); // Just over 1 minute
      expect(calculateReadingTime(words)).toBe('2 min read');
    });

    it('should handle content with multiple spaces', () => {
      const content = 'word    word    word';
      expect(calculateReadingTime(content)).toBe('1 min read');
    });
  });
});
