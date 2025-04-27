import { processMessageContent } from './messageHelpers';

describe('processMessageContent', () => {
  test('returns empty arrays for falsy content', () => {
    const result = processMessageContent(null);
    expect(result).toEqual({ images: [], text: null });
  });

  test('returns correct text for simple string content', () => {
    const text = 'Hello, world!';
    const result = processMessageContent(text);
    expect(result).toEqual({ images: [], text });
  });

  test('processes array of parts correctly', () => {
    const parts = [
      { type: 'text', text: 'Part1' },
      { type: 'image_url', image_url: { url: 'http://img.com/1.png', alt: 'First' } },
      { type: 'text', text: 'Part2' },
      { type: 'image_url', image_url: { url: 'http://img.com/2.png' } },
      { type: 'other', foo: 'bar' }
    ];
    const result = processMessageContent(parts);
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({ url: 'http://img.com/1.png', alt: 'First' });
    expect(result.images[1]).toEqual({ url: 'http://img.com/2.png', alt: null });
    expect(result.text).toBe('Part1 Part2');
  });

  test('trims and joins multiple text parts with spaces', () => {
    const parts = [
      { type: 'text', text: '  Leading' },
      { type: 'text', text: 'and Trailing  ' },
    ];
    const result = processMessageContent(parts);
    expect(result.images).toEqual([]);
    expect(result.text).toBe('  Leading and Trailing  ');
  });

  test('handles empty array input', () => {
    const result = processMessageContent([]);
    expect(result).toEqual({ images: [], text: '' });
  });
}); 