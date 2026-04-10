'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function MetaUpdater() {
  const { t } = useTranslation();

  useEffect(() => {
    // Обновляем title
    const title = t('home.siteTitle', 'Roadmap Platform');
    if (document.title !== title) {
      document.title = title;
    }

    // Обновляем meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    const description = t('home.siteDescription', 'Platform for learning and development');
    metaDescription.setAttribute('content', description);

    // Обновляем og:title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', title);

    // Обновляем og:description
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', description);
  }, [t]);

  return null;
}
