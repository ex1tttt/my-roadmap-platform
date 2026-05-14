"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare2, BarChart3, X } from "lucide-react";

type CreateTypeModalProps = {
  isOpen: boolean;
  onSelectActionList: () => void;
  onSelectGantt: () => void;
  onClose: () => void;
};

export default function CreateTypeModal({
  isOpen,
  onSelectActionList,
  onSelectGantt,
  onClose,
}: CreateTypeModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 flex items-center justify-center bg-black/50 p-4 min-h-[calc(100dvh-4rem)]">
      <div className="w-full max-w-md rounded-lg shadow-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("create.selectType") || "Выбери тип создания"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Action List */}
          <button
            onClick={onSelectActionList}
            className="w-full p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                <CheckSquare2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t("create.actionList") || "Список действий"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t("create.actionListDesc") ||
                    "Пошаговая дорожная карта с действиями, ресурсами и медиа"}
                </p>
              </div>
            </div>
          </button>

          {/* Gantt Diagram */}
          <button
            onClick={onSelectGantt}
            className="w-full p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t("create.ganttDiagram") || "Диаграмма Gantt"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t("create.ganttDiagramDesc") ||
                    "Визуальная диаграмма временной шкалы проекта"}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t("common.cancel") || "Отмена"}
          </button>
        </div>
      </div>
    </div>
  );
}
