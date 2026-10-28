import { createIcons, icons } from 'lucide';
import { EditorApp } from './EditorApp';

// Attach lucide globally for dynamic icon creation
(window as any).lucide = {
  createIcons: () => createIcons({ icons }),
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize initial icons in DOM
  createIcons({ icons });

  const app = new EditorApp();
  try {
    await app.init();
    createIcons({ icons });
    console.log('✅ 3D Hotspot Editor initialized successfully!');
  } catch (err) {
    console.error('❌ Failed to initialize 3D Hotspot Editor:', err);
  }
});
