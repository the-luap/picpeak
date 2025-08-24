import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProtectedImage } from '../ProtectedImage';

// Mock canvas and image APIs
const mockCanvas = {
  getContext: jest.fn(() => ({
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4).fill(255)
    })),
    putImageData: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 }))
  })),
  width: 100,
  height: 100,
  style: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => mockCanvas.getContext()
});

// Mock Image constructor
global.Image = class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  naturalWidth = 100;
  naturalHeight = 100;
  width = 100;
  height = 100;
  crossOrigin = '';

  constructor() {
    // Simulate image loading
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 10);
  }
} as any;

describe('ProtectedImage', () => {
  const defaultProps = {
    src: '/test-image.jpg',
    alt: 'Test image'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<ProtectedImage {...defaultProps} />);
    expect(screen.getByRole('img', { name: /loading test image/i })).toBeInTheDocument();
  });

  it('renders canvas after image loads', async () => {
    render(<ProtectedImage {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    });
  });

  it('applies protection level classes and events', async () => {
    const onViolation = jest.fn();
    
    render(
      <ProtectedImage 
        {...defaultProps} 
        protectionLevel="enhanced"
        onProtectionViolation={onViolation}
      />
    );

    await waitFor(() => {
      const canvas = screen.getByRole('img', { name: 'Test image' });
      expect(canvas).toBeInTheDocument();
    });

    // Test context menu blocking
    const canvas = screen.getByRole('img', { name: 'Test image' });
    fireEvent.contextMenu(canvas);
    
    expect(onViolation).toHaveBeenCalledWith('canvas_context_menu');
  });

  it('applies watermark text when specified', async () => {
    render(
      <ProtectedImage 
        {...defaultProps} 
        watermarkText="Test Watermark"
        protectionLevel="standard"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    });

    // Verify canvas context methods were called for watermark
    expect(mockCanvas.getContext().fillText).toHaveBeenCalled();
  });

  it('handles fragment grid rendering', async () => {
    render(
      <ProtectedImage 
        {...defaultProps} 
        fragmentGrid={true}
        gridSize={4}
        protectionLevel="enhanced"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    });

    // Verify multiple drawImage calls for fragments
    expect(mockCanvas.getContext().drawImage).toHaveBeenCalled();
  });

  it('blocks interactions in maximum protection mode', async () => {
    const onViolation = jest.fn();
    
    render(
      <ProtectedImage 
        {...defaultProps} 
        protectionLevel="maximum"
        onProtectionViolation={onViolation}
      />
    );

    await waitFor(() => {
      const canvas = screen.getByRole('img', { name: 'Test image' });
      expect(canvas).toBeInTheDocument();
      
      // Test click blocking
      fireEvent.click(canvas);
      expect(onViolation).toHaveBeenCalledWith('canvas_interaction_blocked');
    });
  });

  it('handles image loading errors gracefully', async () => {
    // Mock image error
    global.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 10);
      }
    } as any;

    const onViolation = jest.fn();
    
    render(
      <ProtectedImage 
        {...defaultProps} 
        onProtectionViolation={onViolation}
        fallbackSrc="/fallback.jpg"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });

    expect(onViolation).toHaveBeenCalledWith('image_load_error');
  });

  it('applies invisible watermark for enhanced protection', async () => {
    render(
      <ProtectedImage 
        {...defaultProps} 
        watermarkText="Hidden"
        invisibleWatermark={true}
        protectionLevel="enhanced"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    });

    // Verify getImageData and putImageData called for steganography
    expect(mockCanvas.getContext().getImageData).toHaveBeenCalled();
    expect(mockCanvas.getContext().putImageData).toHaveBeenCalled();
  });

  it('scrambles fragments when enabled', async () => {
    render(
      <ProtectedImage 
        {...defaultProps} 
        fragmentGrid={true}
        scrambleFragments={true}
        protectionLevel="maximum"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    });

    // Fragment scrambling should result in multiple drawImage calls
    expect(mockCanvas.getContext().drawImage).toHaveBeenCalled();
  });

  it('adds random noise in maximum protection', async () => {
    render(
      <ProtectedImage 
        {...defaultProps} 
        protectionLevel="maximum"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Test image' })).toBeInTheDocument();
    });

    // Noise injection requires getImageData and putImageData
    expect(mockCanvas.getContext().getImageData).toHaveBeenCalled();
    expect(mockCanvas.getContext().putImageData).toHaveBeenCalled();
  });
});