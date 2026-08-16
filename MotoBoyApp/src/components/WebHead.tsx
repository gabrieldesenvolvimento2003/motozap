import { useEffect } from 'react';
import { Platform } from 'react-native';

export function WebHead() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const head = document.head;
    if (!head.querySelector('link[href*="material-icons"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      head.appendChild(link);
    }
    if (!head.querySelector('link[href*="roboto"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap';
      head.appendChild(link);
    }
    const style = document.createElement('style');
    style.innerHTML = `
      .material-icons {
        font-family: 'Material Icons' !important;
        font-weight: normal;
        font-style: normal;
        font-size: 24px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
      }
    `;
    head.appendChild(style);
  }, []);
  return null;
}