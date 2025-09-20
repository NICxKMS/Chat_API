import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './SettingsSidebarOverlay.module.css';
import { useEscapeKey } from '../../../hooks/useEventHandlers';

const SettingsSidebarOverlay = ({ isOpen, onClose, children }) => {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (isOpen && panelRef.current) panelRef.current.focus();
  }, [isOpen]);

  return (
    <>
      <div
        ref={overlayRef}
        className={`${styles.overlay} ${isOpen ? styles['overlay--open'] : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <div
        ref={panelRef}
        className={`${styles.panel} ${isOpen ? styles['panel--open'] : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex="-1"
      >
        {children}
      </div>
    </>
  );
};

SettingsSidebarOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node
};

export default SettingsSidebarOverlay; 