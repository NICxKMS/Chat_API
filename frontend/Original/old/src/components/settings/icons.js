// SVG Icon factory
const createIcon = (width, height, path) => () => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {typeof path === 'string' 
      ? <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> 
      : path}
  </svg>
);

// Icon components
export const IconSlider = createIcon(18, 18, "M4 21V14M4 14C5.65685 14 7 12.6569 7 11C7 9.34315 5.65685 8 4 8C2.34315 8 1 9.34315 1 11C1 12.6569 2.34315 14 4 14ZM12 16V3M12 3C13.6569 3 15 4.34315 15 6C15 7.65685 13.6569 9 12 9C10.3431 9 9 7.65685 9 6C9 4.34315 10.3431 3 12 3ZM20 21V10M20 10C21.6569 10 23 8.65685 23 7C23 5.34315 21.6569 4 20 4C18.3431 4 17 5.34315 17 7C17 8.65685 18.3431 10 20 10Z");

export const IconStream = createIcon(18, 18, "M13 5C13 3.89543 12.1046 3 11 3C9.89543 3 9 3.89543 9 5M13 5C13 6.10457 12.1046 7 11 7C9.89543 7 9 6.10457 9 5M13 5H21M9 5H3M17 12C17 10.8954 16.1046 10 15 10C13.8954 10 13 10.8954 13 12M17 12C17 13.1046 16.1046 14 15 14C13.8954 14 13 13.1046 13 12M17 12H21M13 12H3M13 19C13 17.8954 12.1046 17 11 17C9.89543 17 9 17.8954 9 19M13 19C13 20.1046 12.1046 21 11 21C9.89543 21 9 20.1046 9 19M13 19H21M9 19H3");

export const IconCache = createIcon(18, 18, [
  <path key="1" d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  <path key="2" d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
]);

export const IconOutput = createIcon(18, 18, "M3 7H21M9 12H21M3 17H21");

export const IconRepeat = createIcon(18, 18, "M17 2L21 6M21 6L17 10M21 6H7C4.79086 6 3 7.79086 3 10C3 12.2091 4.79086 14 7 14M7 22L3 18M3 18L7 14M3 18H17C19.2091 18 21 16.2091 21 14C21 11.7909 19.2091 10 17 10");

export const IconClose = createIcon(20, 20, "M18 6L6 18M6 6L18 18");

export const IconRefresh = createIcon(14, 14, "M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M19.7545 7.42909L17 5M19.7545 7.42909L22 4.5");

export const InfoIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
); 