import React, { lazy, Suspense } from 'react';
import PropTypes from 'prop-types';

// Lazy-load the heavy Markdown renderer only when first used
const MarkdownRenderer = lazy(() => import(/* webpackChunkName: "markdown-renderer", webpackPrefetch: true */ './MarkdownRenderer'));

export default function LazyMarkdownRenderer({ children }) {
  return (
    <Suspense fallback={<div>{children}</div>}>
      <MarkdownRenderer>{children}</MarkdownRenderer>
    </Suspense>
  );
}

LazyMarkdownRenderer.propTypes = {
  markdownText: PropTypes.string.isRequired
}; 