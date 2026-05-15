"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { getCircularAvatarBlob } from "@/lib/crop-avatar";

type Props = {
  imageSrc: string;
  onClose: () => void;
  onApply: (file: File) => void | Promise<void>;
};

export default function AvatarCropModal({ imageSrc, onClose, onApply }: Props) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleApply() {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await getCircularAvatarBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], "avatar.png", { type: "image/png" });
      await onApply(file);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="avatar-crop-title"
    >
      <div className="relative flex w-full max-w-md flex-col rounded-2xl border border-slate-700/80 bg-slate-900 p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="avatar-crop-title" className="text-lg font-semibold text-white">
            {t("settings.avatarCropTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-2 text-xs text-slate-400">{t("settings.avatarCropHint")}</p>

        <div className="relative mx-auto h-[min(55vh,320px)] w-full max-w-[320px] overflow-hidden rounded-xl bg-slate-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">{t("settings.avatarCropZoom")}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!croppedAreaPixels || applying}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("settings.avatarCropApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
