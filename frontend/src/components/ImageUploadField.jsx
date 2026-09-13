import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, Link as LinkIcon, X, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

/**
 * Compress an image file to a lightweight data URI (WebP/JPEG)
 */
const compressImage = (file, maxWidth = 1600, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer webp, fallback to jpeg
        const dataUrl = canvas.toDataURL("image/webp", quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function ImageUploadField({
  value,
  onChange,
  label = "Project Image / Layout Photo",
  hint = "Upload JPG, PNG, WebP photo directly from your device",
  required = false,
}) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please select an image file (JPG, PNG, WebP).");
    }

    if (file.size > 20 * 1024 * 1024) {
      return toast.error("Image file is too large. Max size is 20MB.");
    }

    setFileName(file.name);
    setLoading(true);
    try {
      const compressedDataUri = await compressImage(file);
      onChange(compressedDataUri);
      toast.success(`Attached "${file.name}" from local folder!`);
    } catch (err) {
      console.error("Compression error:", err);
      toast.error("Failed to process image. Please try another image.");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-slate-400 hover:text-emerald-700 underline"
        >
          {showUrlInput ? "← Back to File Upload" : "Or paste image URL"}
        </button>
      </div>

      {showUrlInput ? (
        <div className="flex gap-2">
          <Input
            type="url"
            value={value || ""}
            onChange={(e) => {
              setFileName("");
              onChange(e.target.value);
            }}
            placeholder="https://images.unsplash.com/... or web URL"
            className="text-xs"
          />
        </div>
      ) : value ? (
        /* Image Preview with Local File info */
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 p-2 shadow-inner">
          <div className="relative h-44 w-full overflow-hidden rounded-lg bg-slate-100">
            <img
              src={value}
              alt="Uploaded preview"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">
                {fileName ? fileName : "Image Attached from Local Folder"}
              </span>
            </div>
            <div className="absolute right-2 top-2 flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 bg-white/95 px-2.5 text-xs font-semibold text-slate-800 shadow backdrop-blur hover:bg-white"
              >
                <RefreshCw className="mr-1 h-3 w-3 text-emerald-600" /> Replace from Folder
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => {
                  setFileName("");
                  onChange("");
                }}
                className="h-7 w-7 p-0 shadow"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Primary Local Folder Upload Dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragOver
              ? "border-emerald-500 bg-emerald-50/60"
              : "border-slate-300 bg-slate-50/70 hover:border-emerald-600 hover:bg-emerald-50/30"
          }`}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
            {loading ? (
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
            ) : (
              <UploadCloud className="h-6 w-6 text-emerald-700" />
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {loading ? "Processing local image..." : "Choose Image from Local Folder"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Click here to browse your files, or drag and drop image here
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <UploadCloud className="h-3.5 w-3.5 text-emerald-600" /> Browse Local Files (.jpg, .png, .webp)
          </div>
        </div>
      )}

      {/* Hidden Native File Input targeting OS File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
