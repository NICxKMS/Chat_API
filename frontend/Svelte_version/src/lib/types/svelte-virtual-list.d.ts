/**
 * Type declarations for @sveltejs/svelte-virtual-list
 */

declare module '@sveltejs/svelte-virtual-list' {
  import { SvelteComponent } from 'svelte';

  interface VirtualListProps<T> {
    items?: T[];
    height?: string | number;
    itemHeight?: number;
    start?: number;
    end?: number;
  }

  export default class VirtualList<T = any> extends SvelteComponent<VirtualListProps<T>> {}
}
