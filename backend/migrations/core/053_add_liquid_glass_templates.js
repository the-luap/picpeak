/**
 * Migration: Add Liquid Glass CSS Templates
 * Updates template slots 2 and 3 with Apple-inspired Liquid Glass designs
 */

const LIQUID_GLASS_LIGHT = `/*
 * PicPeak Custom CSS Template: Liquid Glass Light
 * Inspired by Apple's iOS 26 Liquid Glass Design Language
 *
 * Features:
 * - Translucent frosted glass surfaces
 * - Dynamic light refraction effects
 * - Subtle specular highlights
 * - Soft depth shadows
 */

/* ===== Base Theme Variables ===== */
.gallery-page {
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-bg-elevated: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(255, 255, 255, 0.5);
  --glass-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
  --glass-blur: 20px;
  --glass-saturation: 180%;

  --gallery-bg: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  --gallery-text: #1a1a2e;
  --gallery-text-muted: rgba(26, 26, 46, 0.7);
  --gallery-accent: #667eea;
  --gallery-accent-hover: #764ba2;
  --gallery-radius: 24px;
  --gallery-spacing: 20px;
}

/* ===== Page Background ===== */
.gallery-page {
  background: var(--gallery-bg);
  min-height: 100vh;
  position: relative;
}

/* Animated gradient background */
.gallery-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.2) 0%, transparent 40%);
  pointer-events: none;
  z-index: 0;
}

/* ===== Glass Card Base ===== */
.glass-surface {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    inset 0 -1px 1px rgba(0, 0, 0, 0.05);
}

/* Liquid shine effect */
.glass-surface::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  border-radius: var(--gallery-radius) var(--gallery-radius) 0 0;
  pointer-events: none;
}

/* ===== Gallery Header ===== */
.gallery-header {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(30px) saturate(200%);
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  border-bottom: 1px solid var(--glass-border);
  padding: calc(var(--gallery-spacing) * 1.5);
  position: sticky;
  top: 0;
  z-index: 100;
}

.gallery-title {
  color: var(--gallery-text);
  font-weight: 700;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
}

/* ===== Photo Grid ===== */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--gallery-spacing);
  padding: calc(var(--gallery-spacing) * 2);
  position: relative;
  z-index: 1;
}

/* ===== Photo Cards - Glass Style ===== */
.photo-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.6);
}

.photo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.3) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
  border-radius: var(--gallery-radius) var(--gallery-radius) 0 0;
}

.photo-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow:
    0 20px 40px rgba(102, 126, 234, 0.3),
    0 8px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.8);
}

.photo-card img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.photo-card:hover img {
  transform: scale(1.05);
}

.photo-card-info {
  padding: var(--gallery-spacing);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.3) 100%
  );
}

/* ===== Buttons - Glass Style ===== */
.gallery-btn {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: calc(var(--gallery-radius) / 2);
  padding: 12px 24px;
  color: var(--gallery-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.gallery-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 100%
  );
}

.gallery-btn:hover {
  background: var(--glass-bg-elevated);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.gallery-btn-primary {
  background: linear-gradient(135deg, var(--gallery-accent) 0%, var(--gallery-accent-hover) 100%);
  color: white;
  border: none;
}

/* ===== Lightbox - Glass Style ===== */
.lightbox-overlay {
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
}

.lightbox-content {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}

/* ===== Category Pills ===== */
.category-pill {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gallery-text);
  transition: all 0.3s ease;
}

.category-pill:hover,
.category-pill.active {
  background: var(--gallery-accent);
  color: white;
  border-color: var(--gallery-accent);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .gallery-page {
    --gallery-radius: 16px;
    --gallery-spacing: 12px;
    --glass-blur: 16px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .photo-card img {
    height: 180px;
  }
}

/* ===== Accessibility: Reduce Motion ===== */
@media (prefers-reduced-motion: reduce) {
  .photo-card,
  .gallery-btn {
    transition: none;
  }

  .photo-card:hover {
    transform: none;
  }
}

/* ===== Accessibility: Reduce Transparency ===== */
@media (prefers-reduced-transparency: reduce) {
  .glass-surface,
  .photo-card,
  .gallery-btn {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(255, 255, 255, 0.95);
  }
}`;

const LIQUID_GLASS_DARK = `/*
 * PicPeak Custom CSS Template: Liquid Glass Dark
 * Inspired by Apple's iOS 26 Liquid Glass Design Language
 *
 * Features:
 * - Deep translucent dark surfaces
 * - Neon accent highlights
 * - Dramatic glass reflections
 * - Subtle animated gradients
 */

/* ===== Base Theme Variables ===== */
.gallery-page {
  --glass-bg: rgba(15, 15, 35, 0.7);
  --glass-bg-elevated: rgba(25, 25, 55, 0.85);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-border-highlight: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --glass-blur: 24px;
  --glass-saturation: 150%;

  --gallery-bg: #0a0a1a;
  --gallery-text: #f0f0f5;
  --gallery-text-muted: rgba(240, 240, 245, 0.6);
  --gallery-accent: #00d4ff;
  --gallery-accent-secondary: #ff00e5;
  --gallery-accent-hover: #00ffea;
  --gallery-radius: 20px;
  --gallery-spacing: 20px;

  /* Neon glow variables */
  --neon-glow: 0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(0, 212, 255, 0.2);
  --neon-glow-secondary: 0 0 20px rgba(255, 0, 229, 0.5), 0 0 40px rgba(255, 0, 229, 0.2);
}

/* ===== Page Background ===== */
.gallery-page {
  background: var(--gallery-bg);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Animated mesh gradient background */
.gallery-page::before {
  content: '';
  position: fixed;
  top: -50%;
  left: -50%;
  right: -50%;
  bottom: -50%;
  background:
    radial-gradient(circle at 30% 20%, rgba(0, 212, 255, 0.15) 0%, transparent 40%),
    radial-gradient(circle at 70% 80%, rgba(255, 0, 229, 0.1) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(100, 100, 255, 0.05) 0%, transparent 60%);
  animation: gradientShift 20s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes gradientShift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(2%, 2%) rotate(1deg); }
  50% { transform: translate(-1%, 3%) rotate(-1deg); }
  75% { transform: translate(3%, -2%) rotate(2deg); }
}

/* ===== Gallery Header ===== */
.gallery-header {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(30px) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(30px) saturate(var(--glass-saturation));
  border-bottom: 1px solid var(--glass-border-highlight);
  padding: calc(var(--gallery-spacing) * 1.5);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.gallery-title {
  color: var(--gallery-text);
  font-weight: 700;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--gallery-text) 0%, var(--gallery-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ===== Photo Grid ===== */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--gallery-spacing);
  padding: calc(var(--gallery-spacing) * 2);
  position: relative;
  z-index: 1;
}

/* ===== Photo Cards - Dark Glass Style ===== */
.photo-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border: 1px solid var(--glass-border);
  border-radius: var(--gallery-radius);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Top highlight reflection */
.photo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  z-index: 2;
}

/* Inner glow effect */
.photo-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--gallery-radius);
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(0, 212, 255, 0) 0%,
    rgba(0, 212, 255, 0) 40%,
    rgba(0, 212, 255, 0.1) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.photo-card:hover {
  transform: translateY(-8px) scale(1.02);
  border-color: var(--glass-border-highlight);
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 212, 255, 0.2),
    var(--neon-glow);
}

.photo-card:hover::after {
  opacity: 1;
}

.photo-card img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  transition: transform 0.4s ease, filter 0.4s ease;
  filter: brightness(0.9);
}

.photo-card:hover img {
  transform: scale(1.05);
  filter: brightness(1);
}

.photo-card-info {
  padding: var(--gallery-spacing);
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.2) 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
  color: var(--gallery-text);
}

.photo-card-info p {
  color: var(--gallery-text-muted);
  font-size: 0.875rem;
}

/* ===== Buttons - Neon Glass Style ===== */
.gallery-btn {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: calc(var(--gallery-radius) / 2);
  padding: 12px 24px;
  color: var(--gallery-text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.gallery-btn:hover {
  border-color: var(--gallery-accent);
  box-shadow: var(--neon-glow);
  color: var(--gallery-accent);
}

.gallery-btn-primary {
  background: linear-gradient(135deg, var(--gallery-accent) 0%, var(--gallery-accent-secondary) 100%);
  color: white;
  border: none;
  box-shadow: var(--neon-glow);
}

.gallery-btn-primary:hover {
  box-shadow:
    0 0 30px rgba(0, 212, 255, 0.6),
    0 0 60px rgba(0, 212, 255, 0.3),
    0 0 90px rgba(255, 0, 229, 0.2);
  transform: translateY(-2px);
}

/* ===== Lightbox - Dark Glass ===== */
.lightbox-overlay {
  background: rgba(5, 5, 15, 0.9);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
}

.lightbox-content {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border-highlight);
  border-radius: var(--gallery-radius);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.5),
    var(--neon-glow);
}

/* ===== Category Pills ===== */
.category-pill {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gallery-text-muted);
  transition: all 0.3s ease;
}

.category-pill:hover {
  border-color: var(--gallery-accent);
  color: var(--gallery-accent);
  box-shadow: var(--neon-glow);
}

.category-pill.active {
  background: linear-gradient(135deg, var(--gallery-accent) 0%, var(--gallery-accent-secondary) 100%);
  color: white;
  border-color: transparent;
  box-shadow: var(--neon-glow);
}

/* ===== Scrollbar Styling ===== */
.gallery-page ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gallery-page ::-webkit-scrollbar-track {
  background: var(--glass-bg);
  border-radius: 4px;
}

.gallery-page ::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--gallery-accent) 0%, var(--gallery-accent-secondary) 100%);
  border-radius: 4px;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .gallery-page {
    --gallery-radius: 16px;
    --gallery-spacing: 12px;
    --glass-blur: 16px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .photo-card img {
    height: 180px;
  }

  /* Reduce animation complexity on mobile */
  .gallery-page::before {
    animation: none;
  }
}

/* ===== Accessibility: Reduce Motion ===== */
@media (prefers-reduced-motion: reduce) {
  .gallery-page::before {
    animation: none;
  }

  .photo-card,
  .gallery-btn {
    transition: none;
  }

  .photo-card:hover {
    transform: none;
  }
}

/* ===== Accessibility: Reduce Transparency ===== */
@media (prefers-reduced-transparency: reduce) {
  .photo-card,
  .gallery-btn,
  .gallery-header {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .gallery-page {
    --glass-bg: rgba(20, 20, 40, 0.98);
    --glass-bg-elevated: rgba(30, 30, 60, 0.98);
  }
}`;

exports.up = async function(knex) {
  // Update template slot 2 with Liquid Glass Light
  await knex('css_templates')
    .where({ slot_number: 2 })
    .update({
      name: 'Liquid Glass Light',
      css_content: LIQUID_GLASS_LIGHT,
      is_enabled: true,
      is_default: false,
      updated_at: knex.fn.now()
    });

  // Update template slot 3 with Liquid Glass Dark
  await knex('css_templates')
    .where({ slot_number: 3 })
    .update({
      name: 'Liquid Glass Dark',
      css_content: LIQUID_GLASS_DARK,
      is_enabled: true,
      is_default: false,
      updated_at: knex.fn.now()
    });
};

exports.down = async function(knex) {
  // Revert to empty templates
  await knex('css_templates')
    .where({ slot_number: 2 })
    .update({
      name: 'Untitled',
      css_content: '',
      is_enabled: false,
      is_default: false,
      updated_at: knex.fn.now()
    });

  await knex('css_templates')
    .where({ slot_number: 3 })
    .update({
      name: 'Untitled',
      css_content: '',
      is_enabled: false,
      is_default: false,
      updated_at: knex.fn.now()
    });
};

// Export templates for use elsewhere
module.exports.LIQUID_GLASS_LIGHT = LIQUID_GLASS_LIGHT;
module.exports.LIQUID_GLASS_DARK = LIQUID_GLASS_DARK;
