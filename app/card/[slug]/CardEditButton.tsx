'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';

interface CardEditButtonProps {
  cardId: string;
}

export default function CardEditButton({ cardId }: CardEditButtonProps) {
  return (
    <Link
      href={`/card/${cardId}/edit`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
      title="Edit card"
    >
      <Pencil className="h-4 w-4" />
      <span className="text-sm">Edit</span>
    </Link>
  );
}
