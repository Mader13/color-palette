"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Copy,
  Check,
  RefreshCw,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { extractPalette, getContrastColor } from "@/lib/color-extraction";
import { useToast } from "@/hooks/use-toast";

interface ColorSwatch {
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage: number;
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [palette, setPalette] = useState<ColorSwatch[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [colorCount, setColorCount] = useState(6);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImage(dataUrl);

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const maxDim = 300;
            const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              setIsExtracting(true);
              setTimeout(() => {
                const result = extractPalette(imageData, colorCount);
                setPalette(result);
                setIsExtracting(false);
              }, 350);
            }
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [colorCount],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        processImage(file);
      }
    },
    [processImage],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processImage(file);
      }
    },
    [processImage],
  );

  const copyToClipboard = async (hex: string, index: number) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
      toast({
        title: "Copied",
        description: hex.toUpperCase(),
        duration: 1500,
      });
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = hex;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
      toast({
        title: "Copied",
        description: hex.toUpperCase(),
        duration: 1500,
      });
    }
  };

  const copyAllPalette = async () => {
    const allHex = palette.map((c) => c.hex.toUpperCase()).join(", ");
    try {
      await navigator.clipboard.writeText(allHex);
      toast({ title: "All colors copied", duration: 1500 });
    } catch {
      // silent
    }
  };

  const exportPalette = () => {
    const canvas = document.createElement("canvas");
    const width = palette.length * 120;
    canvas.width = width;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    palette.forEach((color, i) => {
      ctx.fillStyle = color.hex;
      ctx.fillRect(i * 120, 0, 120, 200);
      ctx.fillStyle = getContrastColor(color.hex);
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(color.hex, i * 120 + 60, 110);
      ctx.font = "11px sans-serif";
      ctx.fillText(`${color.percentage}%`, i * 120 + 60, 130);
    });

    const link = document.createElement("a");
    link.download = "palette.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const resetAll = () => {
    setImage(null);
    setPalette([]);
    setCopiedIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleColorCountChange = useCallback(
    (newCount: number) => {
      setColorCount(newCount);
      if (canvasRef.current && image) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setIsExtracting(true);
          setTimeout(() => {
            const result = extractPalette(imageData, newCount);
            setPalette(result);
            setIsExtracting(false);
          }, 350);
        }
      }
    },
    [image],
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {!image ? (
            /* Upload State */
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center justify-center pt-28 sm:pt-36"
            >
              {/* Headline */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-center mb-14"
              >
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
                  Image to Palette
                </h2>
                <p className="text-white/35 text-base max-w-sm mx-auto leading-relaxed">
                  Drop an image. Get dominant colors. Copy HEX.
                </p>
              </motion.div>

              {/* Drop Zone */}
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative w-full max-w-md aspect-[4/3] rounded-2xl cursor-pointer
                  border border-dashed transition-all duration-300 ease-out
                  flex flex-col items-center justify-center gap-3
                  ${
                    isDragging
                      ? "border-white/30 bg-white/[0.04]"
                      : "border-white/[0.1] bg-white/[0.015] hover:border-white/[0.2] hover:bg-white/[0.03]"
                  }
                `}
              >
                <Upload
                  className={`w-6 h-6 transition-colors duration-200 ${
                    isDragging ? "text-white/60" : "text-white/20"
                  }`}
                />
                <div className="text-center">
                  <p className="text-sm text-white/50 mb-0.5">
                    {isDragging ? "Drop it here" : "Drop image here"}
                  </p>
                  <p className="text-xs text-white/25">or click to browse</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </motion.div>
            </motion.div>
          ) : (
            /* Results State */
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="pt-8"
            >
              {/* Toolbar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="flex items-center justify-between mb-6"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30 font-medium whitespace-nowrap">
                    Colors
                  </span>
                  <Slider
                    value={[colorCount]}
                    onValueChange={([v]) => handleColorCountChange(v)}
                    min={3}
                    max={12}
                    step={1}
                    className="w-28"
                  />
                  <span className="text-xs text-white/50 font-mono w-4 text-right">
                    {colorCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAllPalette}
                    className="text-white/40 hover:text-white/80 hover:bg-white/[0.06] text-xs h-8 px-2.5"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exportPalette}
                    className="text-white/40 hover:text-white/80 hover:bg-white/[0.06] text-xs h-8 px-2.5"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAll}
                    className="text-white/40 hover:text-white/80 hover:bg-white/[0.06] text-xs h-8 px-2.5"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </motion.div>

              {/* Image + Palette */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Image Preview */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative group"
                >
                  <div className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06] p-2.5">
                    <div className="relative rounded-lg overflow-hidden aspect-[4/3]">
                      <img
                        src={image}
                        alt="Uploaded"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white/15 backdrop-blur-sm border-0 text-white hover:bg-white/25 text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1.5" />
                          Change
                        </Button>
                      </div>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </motion.div>

                {/* Color Palette */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex flex-col gap-3.5"
                >
                  {/* Palette Bar */}
                  <div className="rounded-xl overflow-hidden h-14 flex border border-white/[0.06]">
                    <AnimatePresence mode="wait">
                      {isExtracting ? (
                        <motion.div
                          key="extracting"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 flex items-center justify-center bg-white/[0.02]"
                        >
                          <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-white/30"
                                animate={{ opacity: [0.2, 0.7, 0.2] }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  delay: i * 0.12,
                                }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="palette-bar"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex w-full"
                        >
                          {palette.map((color, i) => (
                            <motion.div
                              key={color.hex + i}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{
                                duration: 0.4,
                                delay: i * 0.06,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              style={{
                                backgroundColor: color.hex,
                                flex: color.percentage,
                                transformOrigin: "left",
                              }}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Color Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <AnimatePresence mode="popLayout">
                      {palette.map((color, i) => (
                        <motion.div
                          key={color.hex + "-" + i}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{
                            duration: 0.3,
                            delay: i * 0.04,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="group/card"
                        >
                          <button
                            onClick={() => copyToClipboard(color.hex, i)}
                            className="w-full text-left rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <div
                              className="h-16 relative"
                              style={{ backgroundColor: color.hex }}
                            >
                              <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/15 transition-all duration-200 flex items-center justify-center opacity-0 group-hover/card:opacity-100">
                                {copiedIndex === i ? (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-7 h-7 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center"
                                  >
                                    <Check
                                      className="w-3.5 h-3.5"
                                      style={{
                                        color: getContrastColor(color.hex),
                                      }}
                                    />
                                  </motion.div>
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                                    <Copy
                                      className="w-3.5 h-3.5"
                                      style={{
                                        color: getContrastColor(color.hex),
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="px-2.5 py-2">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-mono font-medium text-white/80">
                                  {color.hex.toUpperCase()}
                                </span>
                                <span className="text-[9px] text-white/25">
                                  {color.percentage}%
                                </span>
                              </div>
                              <span className="text-[10px] text-white/25 font-mono">
                                {color.rgb.r}, {color.rgb.g}, {color.rgb.b}
                              </span>
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-5 mt-auto">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] text-white/20">
            Сделано{" "}
            <a
              href="https://minti-dev.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/55 underline underline-offset-2 decoration-white/25 hover:text-white/90 hover:decoration-white/70 transition-colors"
            >
              Minti
            </a>
          </p>
        </div>
      </footer>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
