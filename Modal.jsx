import React from 'react';
import './Modal.css'; // Import the CSS file

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-button">
          Close
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;