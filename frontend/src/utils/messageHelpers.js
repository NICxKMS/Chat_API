export function processMessageContent(content) {
  if (!content) return { images: [], text: content };
  if (Array.isArray(content)) {
    const { images, texts } = content.reduce(
      (acc, part) => {
        if (part.type === 'image_url') {
          acc.images.push({
            url: part.image_url.url,
            alt: part.image_url.alt || part.alt || null
          });
        } else if (part.type === 'text') {
          acc.texts.push(part.text);
        }
        return acc;
      },
      { images: [], texts: [] }
    );
    return { images, text: texts.join(' ') };
  }
  return { images: [], text: content };
}

export function formatTime(ms) {
  if (!ms) return '0.0s';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
} 