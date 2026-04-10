'use client'

import { useTranslation } from 'react-i18next'
import { categories } from '@/constants/categories'

interface CategoryBadgeProps {
  categoryId?: string
}

export default function CategoryBadge({ categoryId }: CategoryBadgeProps) {
  const { i18n } = useTranslation()
  
  if (!categoryId) return null
  
  const category = categories.find((cat) => cat.id === categoryId)
  if (!category) return null
  
  const lang = i18n.language as 'en' | 'ru' | 'uk' | 'pl' | undefined
  const displayName = (lang && category.translations[lang]) || category.translations.en
  
  return (
    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400">
      {displayName}
    </span>
  )
}
