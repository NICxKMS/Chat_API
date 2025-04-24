import React, { useState, useEffect, Suspense } from 'react';

/**
 * LazyMarkdownRenderer dynamically imports react-markdown and markdown plugins
 * to avoid bundling heavy libraries in the initial bundle.
 */
export default function LazyMarkdownRenderer({ children, components = {} }) {
  const [modules, setModules] = useState(null);

  useEffect(() => {
    let canceled = false;
    Promise.all([
      import(/* webpackChunkName: "react-markdown" */ 'react-markdown'),
      import(/* webpackChunkName: "remark-gfm" */ 'remark-gfm'),
      import(/* webpackChunkName: "remark-emoji" */ 'remark-emoji'),
      import(/* webpackChunkName: "remark-math" */ 'remark-math'),
      import(/* webpackChunkName: "rehype-katex" */ 'rehype-katex'),
    ]).then(([md, gfm, emoji, math, katex]) => {
      if (canceled) return;
      // Load KaTeX CSS
      import(/* webpackChunkName: "katex-css" */ 'katex/dist/katex.min.css');
      setModules({
        Markdown: md.default,
        remarkPlugins: [gfm.default, emoji.default, math.default],
        rehypePlugins: [katex.default]
      });
    }).catch(err => console.error('LazyMarkdownRenderer load error:', err));
    return () => { canceled = true; };
  }, []);

  if (!modules) {
    return null;
  }

  const { Markdown, remarkPlugins, rehypePlugins } = modules;
  return (
    <Suspense fallback={null}>
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        skipHtml={false}
      >
        {children}
      </Markdown>
    </Suspense>
  );
} 