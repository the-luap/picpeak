import { useEffect, useRef } from 'react';
import { ProtectionLevel } from './useImageProtection';

interface UseCSSProtectionOptions {
  enabled: boolean;
  protectionLevel: ProtectionLevel;
  applyWatermark?: boolean;
  watermarkText?: string;
  antiScreenshot?: boolean;
}

export const useCSSProtection = (options: UseCSSProtectionOptions) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!options.enabled || !containerRef.current) return;

    const container = containerRef.current;
    
    // Base protection class
    container.classList.add('protected-image');
    
    // Protection level specific classes
    switch (options.protectionLevel) {
      case 'standard':
        container.classList.add('protection-standard');
        break;
      case 'enhanced':
        container.classList.add('protection-enhanced');
        break;
      case 'maximum':
        container.classList.add('protection-maximum');
        break;
      default:
        break;
    }
    
    // Additional protection features
    if (options.antiScreenshot && options.protectionLevel !== 'basic') {
      container.classList.add('anti-screenshot');
    }
    
    // Create watermark overlay if requested
    if (options.applyWatermark && options.watermarkText && options.protectionLevel !== 'basic') {
      const watermarkOverlay = document.createElement('div');
      watermarkOverlay.className = 'watermark-overlay';
      
      const watermarkText = document.createElement('div');
      watermarkText.className = 'watermark-text';
      watermarkText.textContent = options.watermarkText;
      watermarkText.setAttribute('aria-hidden', 'true');
      
      watermarkOverlay.appendChild(watermarkText);
      container.appendChild(watermarkOverlay);
      
      // Make container relative if not already
      const computedStyle = window.getComputedStyle(container);
      if (computedStyle.position === 'static') {
        container.style.position = 'relative';
      }
    }
    
    // Apply inline styles for enhanced protection
    if (options.protectionLevel === 'enhanced' || options.protectionLevel === 'maximum') {
      // Disable various browser features
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
      container.style.webkitTouchCallout = 'none';
      container.style.webkitUserDrag = 'none';
      
      // Find all img and canvas elements and protect them
      const mediaElements = container.querySelectorAll('img, canvas');
      mediaElements.forEach(element => {
        (element as HTMLElement).draggable = false;
        (element as HTMLElement).style.userSelect = 'none';
        (element as HTMLElement).style.webkitUserSelect = 'none';
        (element as HTMLElement).style.webkitUserDrag = 'none';
        (element as HTMLElement).style.webkitTouchCallout = 'none';
        
        if (options.protectionLevel === 'maximum') {
          (element as HTMLElement).style.pointerEvents = 'none';
        }
      });
    }
    
    // Cleanup function
    return () => {
      // Remove protection classes
      container.classList.remove(
        'protected-image',
        'protection-standard',
        'protection-enhanced',
        'protection-maximum',
        'anti-screenshot'
      );
      
      // Remove watermark overlay
      const watermarkOverlay = container.querySelector('.watermark-overlay');
      if (watermarkOverlay) {
        container.removeChild(watermarkOverlay);
      }
      
      // Reset inline styles
      container.style.userSelect = '';
      container.style.webkitUserSelect = '';
      container.style.webkitTouchCallout = '';
      container.style.webkitUserDrag = '';
      
      // Reset media element styles
      const mediaElements = container.querySelectorAll('img, canvas');
      mediaElements.forEach(element => {
        (element as HTMLElement).style.userSelect = '';
        (element as HTMLElement).style.webkitUserSelect = '';
        (element as HTMLElement).style.webkitUserDrag = '';
        (element as HTMLElement).style.webkitTouchCallout = '';
        (element as HTMLElement).style.pointerEvents = '';
      });
    };
  }, [
    options.enabled,
    options.protectionLevel,
    options.applyWatermark,
    options.watermarkText,
    options.antiScreenshot
  ]);

  return containerRef;
};