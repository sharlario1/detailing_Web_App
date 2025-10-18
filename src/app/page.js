"use client";

import React, { useMemo, useRef, useState } from "react";
import { Roboto } from 'next/font/google';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Download, Ruler, Settings2 } from "lucide-react";
import { CircleDashed } from 'lucide-react';
import { motion } from "framer-motion";
import { Analytics } from "@vercel/analytics/next";
import Image from 'next/image'


const roboto = Roboto({
  weight: ['400', '700'],
  subsets: ['latin'],
});

/**
 * Plate Detail
 *
 * Features:
 * - Parametric inputs (width, thickness, center-hole Ø).
 * - Properties panel reflecting current values and constraints.
 * - Engineering dimensions overlay (feet–inches.decimal) or metric.
 * - Unit system toggle (in / mm) with precision.
 * - Zoom (simple zoom slider).
 */


// ---------- helpers ----------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  // Engineering format: feet'-inches.decimal"
function inchesToEngineeringStr(inches, precision = 2) {

  const sign = inches < 0 ? "-" : "";
  const abs = Math.abs(inches);
  const feet = Math.floor(abs / 12);
  const inch = abs - feet * 12;
  const inc = inch.toFixed(precision);
  return `${sign}${feet}'-${inc}\"`;
}

function formatValue({ valueInInches, unit, precision }) {
  if (unit === "in") return `${valueInInches.toFixed(precision)}\"`;
  // mm display
  const mm = valueInInches * 25.4;
  return `${mm.toFixed(1)} mm`;
}

function ensureNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- pipe data ----------
const PIPE_SCHEDULES = ["Sch. 40", "Sch. 160", "DBLE E.H."]; // display labels
const scheduleToKey = (s) => (s === "Sch. 40" ? "sch40" : (s === "Sch. 160" ? "sch160" : "dble"));
// Pipe table: values in inches. Missing entries are null (i.e., not available for that schedule).
const PIPE_DATA = {
  "1 ½": { od: 1.900, sch40: 1.610, sch160: 1.338, dble: 1.100 },
  "2":   { od: 2.375, sch40: 2.067, sch160: 1.689, dble: 1.503 },
  "2 ½": { od: 2.875, sch40: 2.469, sch160: 2.125, dble: 1.771 },
  "3":   { od: 3.500, sch40: 3.068, sch160: 2.626, dble: 2.300 },
  "3 ½": { od: 4.000, sch40: 3.548, sch160: null, dble: 2.728 }, // Not available in Sch 160
  "4":   { od: 4.500, sch40: 4.026, sch160: 3.438, dble: 3.152 },
  "4 ½": { od: 5.000, sch40: null, sch160: null, dble: 3.580 }, // Not available in Sch 40 or Sch 160  
  "5":   { od: 5.563, sch40: 5.047, sch160: 4.313, dble: 4.063 },
  "6":   { od: 6.625, sch40: 6.065, sch160: 5.189, dble: 4.897 },
  "7":   { od: 7.625, sch40: null, sch160: null,  dble: 5.875 }, // Not available in Sch 40 or Sch 160
  "8":   { od: 8.625, sch40: 7.981, sch160: 6.813, dble: 6.875 },
};

// Title component
function PageTitle() {
  return (
    <div className={`w-full text-left py-6 flex items-center gap-4 ${roboto.className}`}>
      <Image 
      src="/logo.svg" 
      alt="DYWIDAG_Logo" 
      width={200} 
      height={200} 
      />
      <h1 className="text-3xl font-bold text-gray-800">DETAILING WEB APP</h1>
    </div>
  );
}

// ---------- main component ----------
export default function BlockCreator() {
  // Base geometry uses *inches* internally
  const [unit, setUnit] = useState("in"); // "in" | "mm"
  const [precision, setPrecision] = useState(2);
  const [showDims, setShowDims] = useState(true);
  const [zoom, setZoom] = useState(2.5);
  // Pan-only interaction state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef({ startClientX: 0, startClientY: 0, panStartX: 0, panStartY: 0 });

  const uiVal = (inches) => {
  if (inches === undefined || inches === null || inches === '') return '';
  return unit === "in" ? inches : inches * 25.4;
  };

  const fromUi = (val) => {
    if (val === undefined || val === null || val === '') return '';
    return unit === "in" ? val : val / 25.4;
  };


  const [params, setParams] = useState({
    width_in: 8, 
    thickness_in: 1.75, 
    centerHoleDia_in: 1.5, 
    pipeLength_in: 6,
  });

  const [inputVals, setInputVals] = useState({
    width_in: uiVal(params.width_in),
    thickness_in: uiVal(params.thickness_in),
    pipeLength_in: uiVal(params.pipeLength_in),
  });

  // Pipe UI state
  const [showPipe, setShowPipe] = useState(false);
  const [pipeSchedule, setPipeSchedule] = useState("Sch. 40");
  const [pipeSize, setPipeSize] = useState(() => {
    const key = scheduleToKey("Sch. 40");
    const first = Object.keys(PIPE_DATA).find(sz => PIPE_DATA[sz][key] != null) || Object.keys(PIPE_DATA)[0];
    return first;
  });
  const sizeOptions = useMemo(() => {
    const key = scheduleToKey(pipeSchedule);
    let sizes = Object.keys(PIPE_DATA).filter(sz => PIPE_DATA[sz][key] != null);
    if (pipeSchedule === "Sch. 40") {
      sizes = sizes.filter(sz => sz !== "4 ½" && sz !== "7");
    } else if (pipeSchedule === "Sch. 160") {
      sizes = sizes.filter(sz => sz !== "3 ½" && sz !== "4 ½" && sz !== "7");
    }
    return sizes.sort((a, b) => {
      const numA = parseFloat(a.replace(' ½', '.5'));
      const numB = parseFloat(b.replace(' ½', '.5'));
      return numA - numB;
    });
}, [pipeSchedule]);
  React.useEffect(() => {
    const key = scheduleToKey(pipeSchedule);
    if (PIPE_DATA[pipeSize]?.[key] == null) {
      const first = Object.keys(PIPE_DATA).find(sz => PIPE_DATA[sz][key] != null);
      if (first) setPipeSize(first);
    }
    // eslint-disable-next-line
  }, [pipeSchedule]);
  const selectedPipe = useMemo(() => {
    const rec = PIPE_DATA[pipeSize];
    if (!rec) return null;
    const key = scheduleToKey(pipeSchedule);
    const id = rec[key];
    if (id == null) return null;
    return { od_in: rec.od, id_in: id, size: pipeSize, schedule: pipeSchedule };
  }, [pipeSize, pipeSchedule]);

  // ---------- materials and quantity UI state ----------
  const [showQty, setShowQty] = useState(false);
  const [qty, setQty] = useState("");
  const [useCustomMaterials, setUseCustomMaterials] = useState(false);
  const [customMaterialsText, setCustomMaterialsText] = useState("");
  const [plateMaterial, setPlateMaterial] = useState(""); 
  const [coating, setCoating] = useState(""); 

  // constraints / computed
  const computed = useMemo(() => {
    const p = { ...params };
    p.width_in = clamp(p.width_in, 1, 36);
    p.thickness_in = clamp(p.thickness_in, 0.1, 10);
    p.centerHoleDia_in = clamp(p.centerHoleDia_in, 0.1, p.width_in * 0.9);
    p.pipeLength_in = clamp(p.pipeLength_in, 2, 36);

    const scale = 8; // px per inch at zoom=1
    const px = (x) => x * scale * zoom;

    const hw = p.width_in / 2; // half width
    const ht = p.thickness_in / 2; // half thickness 

    return { p, px, hw, ht, scale };
  }, [params, zoom]);

  const svgRef = useRef(null);
  const userHasPannedRef = useRef(false);

  // unit conversion helpers for inputs
  
  const setParam = (key, uiValue) =>
    setParams((s) => ({ ...s, [key]: fromUi(ensureNumber(uiValue, uiVal(s[key])) ) }));

  const downloadSVG = () => {
    const node = svgRef.current;
    if (!node) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(node);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acad-block-simple.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(params, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acad-block-params.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  

  // When params or unit changes, update inputVals
  React.useEffect(() => {
    setInputVals({
      width_in: uiVal(params.width_in),
      thickness_in: uiVal(params.thickness_in),
      centerHoleDia_in: uiVal(params.centerHoleDia_in),
      pipeLength_in: uiVal(params.pipeLength_in),
    });
    // eslint-disable-next-line
  }, [params, unit]);

  const handleInputChange = (k, val) => {
    setInputVals((s) => ({ ...s, [k]: val === '' ? '' : val }));
  };

  const handleInputBlur = (k, val) => {
    setParam(k, val);
  };

  // ------------- drawing helpers -------------
  function Dim({ x1, y1, x2, y2, offset = 20, text, orient = "h", rotate, textPos = "above",  }) {
    // simple dimension representation with arrows
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / (len || 1);
    const uy = dy / (len || 1);
    const nx = -uy; // normal
    const ny = ux;

    const ox = x1 + nx * offset;
    const oy = y1 + ny * offset;
    const px = x2 + nx * offset;
    const py = y2 + ny * offset;

    const arrow = 10;

    // text offset depending on orientation & position

    const midX = (ox + px) / 2;
    const midY = (oy + py) / 2;

    const textOffsetX = rotate ? 14 : 0;
    const textOffsetY = rotate
    ? (textPos === "above" ? -22 : +1)
    : (textPos === "above" ? -6 : +16);

    return (
      <g className="text-xs" stroke="#0F0E0E" fill="none">
        {/* extension lines */}
        <line x1={x1} y1={y1} x2={ox} y2={oy} strokeWidth={0.5}/>
        <line x1={x2} y1={y2} x2={px} y2={py} strokeWidth={0.5}/>
        {/* dimension line */}
        <line x1={ox} y1={oy} x2={px} y2={py} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        {/* text */}
        <text
          x={midX + textOffsetX}
          y={midY + textOffsetY}
          textAnchor="middle"
          fill="#0F0E0E"
          {...(rotate ? { transform: `rotate(${rotate} ${midX + textOffsetX} ${midY})` } : {})}
        >
          {text}
        </text>
      </g>
    );
  }

  // ---------- render ----------
  const { p, px, hw, ht } = computed;

  // ---------- description ----------
  const fmtInches = (n) => {
    const s = Number(n).toFixed(2);
    return `${s.replace(/\.?0+$/, '')}"`;
  };

  const deriveCoatingPhrase = (coat) => {
    if (!coat) return "";
    const c = coat.toUpperCase();
    if (c.includes("GALVANIZED")) return "Assembly Galvanized";
    if (c.startsWith("EPOXY-COATED")) return "Assembly Epoxy-Coated";
    if (c.includes("UNCOATED")) return "Assembly Uncoated";
    return coat;
  };

  const description = useMemo(() => {
    const parts = [];

    if (showQty && qty) {
      parts.push(`${qty} ea`);
    }

    // Plate size
    parts.push(`${fmtInches(p.width_in)}x${fmtInches(p.width_in)}x${fmtInches(p.thickness_in)}`);

    // Grade from selected plate material (e.g., "ASTM A572, GRADE 50" -> 50)
    const m = /GRADE\s*(\d+)/i.exec(plateMaterial || "");
    if (m && m[1]) {
      parts.push(`GR${m[1]}`);
    }

    parts.push("Plate w/");
    parts.push(`${fmtInches(p.centerHoleDia_in)} C.H`);

    // Pipe portion (only when active)
    if (showPipe && selectedPipe) {
      const sched = selectedPipe.schedule.toUpperCase().replace(/\./g, "");
      parts.push(`Welded to ${selectedPipe.size}" ${sched} Pipe x ${fmtInches(p.pipeLength_in)} Long.`);
    }

    // Coating summary at the end
    const coatPhrase = deriveCoatingPhrase(coating);
    if (coatPhrase) parts.push(coatPhrase);

    return parts.join(" ");
  }, [showQty, qty, p.width_in, p.thickness_in, p.centerHoleDia_in, p.pipeLength_in, plateMaterial, showPipe, selectedPipe, coating]);

  // canvas size basis (computed later from geometryBounds + padding)
  const PADDING = 100;
  let widthPx = 0;
  let heightPx = 0;

  // geometry in *inches* (origin at plate center)
  const left = -ht;
  const right = ht;
  const top = -hw;
  const bottom = hw;

  const leftEdge = px(-p.width_in/2);
  const dimOffset = -30;
  const sectionCenterX = px(p.thickness_in/2 + (showPipe && selectedPipe ? p.pipeLength_in : 0)) + 30;
  const planCenterX = px(p.width_in/2 + (showPipe && selectedPipe ? p.pipeLength_in : 0)) + 30;

  // Compute geometry bounds (in viewBox px, before pan) for clamping
  const geometryBounds = useMemo(() => {
    // Plan group offset
    const planOffsetX = -px(p.width_in);

    // Plan plate rect
    const planX0 = planOffsetX + (-30);
    const planX1 = planX0 + px(p.width_in);
    const planY0 = px(top);
    const planY1 = planY0 + px(p.width_in);

    let minX = Math.min(planX0, planX1);
    let maxX = Math.max(planX0, planX1);
    let minY = Math.min(planY0, planY1);
    let maxY = Math.max(planY0, planY1);

    // Plan circles (center hole and optional pipe)
    const planCx = planOffsetX + (px(p.width_in / 2) - 30);
    const holeR = px(p.centerHoleDia_in / 2);
    let extraR = holeR;
    if (showPipe && selectedPipe) {
      extraR = Math.max(extraR, px(selectedPipe.od_in / 2), px(selectedPipe.id_in / 2));
    }
    minX = Math.min(minX, planCx - extraR);
    maxX = Math.max(maxX, planCx + extraR);
    minY = Math.min(minY, -extraR);
    maxY = Math.max(maxY, +extraR);

    // Section group offset
    const sectionOffsetX = sectionCenterX;

    // Section plate rect
    const secX0 = sectionOffsetX + px(left);
    const secX1 = sectionOffsetX + px(right);
    const secY0 = px(top);
    const secY1 = secY0 + px(p.width_in);

    minX = Math.min(minX, secX0);
    maxX = Math.max(maxX, secX1);
    minY = Math.min(minY, secY0);
    maxY = Math.max(maxY, secY1);

    // Section pipe (if any)
    if (showPipe && selectedPipe) {
      const pipeLeft = sectionOffsetX + px(-p.thickness_in / 2 - p.pipeLength_in);
      const pipeRight = sectionOffsetX + px(-p.thickness_in / 2);
      const pipeTop = px(-selectedPipe.od_in / 2);
      const pipeBottom = px(selectedPipe.od_in / 2);

      minX = Math.min(minX, pipeLeft);
      maxX = Math.max(maxX, pipeRight, secX1);
      minY = Math.min(minY, pipeTop);
      maxY = Math.max(maxY, pipeBottom);
    }

    return { minX, maxX, minY, maxY };
  }, [p, px, showPipe, selectedPipe, sectionCenterX, left, right, top]);

  // Compute canvas/viewBox size from geometry bounds + padding (in viewBox px)
  const contentW = geometryBounds.maxX - geometryBounds.minX;
  const contentH = geometryBounds.maxY - geometryBounds.minY;
  widthPx = contentW + 2 * PADDING;
  heightPx = contentH + 2 * PADDING;

  // ---------- materials lines (for below-canvas display) ----------
  const materialsLines = useMemo(() => {
    if (useCustomMaterials && customMaterialsText.trim()) {
      return customMaterialsText.split(/\r?\n/);
    }
    if (showPipe && selectedPipe) {
      return [
        "MATERIALS:",
        `PLATE: ${plateMaterial || ""}`,
        "PIPE: ASTM A53 OR A500",
        coating || ""
      ];
    }
    return [
      "MATERIAL:",
      plateMaterial || "",
      coating || ""
    ];
  }, [useCustomMaterials, customMaterialsText, showPipe, selectedPipe, plateMaterial, coating]);

  // Pan limits so that geometry stays within viewport with ≥200px padding
  const panLimits = useMemo(() => {
    const padding = PADDING;
    const leftV = -widthPx / 2;
    const rightV = widthPx / 2;
    const topV = -heightPx / 2;
    const bottomV = heightPx / 2;

    let xMin = (leftV + padding) - geometryBounds.minX;
    let xMax = (rightV - padding) - geometryBounds.maxX;
    let yMin = (topV + padding) - geometryBounds.minY;
    let yMax = (bottomV - padding) - geometryBounds.maxY;

    // If geometry is larger than the viewport minus padding, lock pan to center
    if (xMin > xMax) {
      const centerV = (leftV + rightV) / 2;
      const centerG = (geometryBounds.minX + geometryBounds.maxX) / 2;
      xMin = xMax = centerV - centerG;
    }
    if (yMin > yMax) {
      const centerV = (topV + bottomV) / 2;
      const centerG = (geometryBounds.minY + geometryBounds.maxY) / 2;
      yMin = yMax = centerV - centerG;
    }

    return { xMin, xMax, yMin, yMax };
  }, [geometryBounds, widthPx, heightPx]);

  // Re-clamp current pan whenever limits change
  React.useEffect(() => {
    setPan(prev => {
      const nx = clamp(prev.x, panLimits.xMin, panLimits.xMax);
      const ny = clamp(prev.y, panLimits.yMin, panLimits.yMax);
      if (nx === prev.x && ny === prev.y) return prev;
      return { x: nx, y: ny };
    });
  }, [panLimits]);

  // Auto-center pan to geometry when bounds/limits change, unless user has panned
  React.useEffect(() => {
    if (userHasPannedRef.current) return;
    const geomCX = (geometryBounds.minX + geometryBounds.maxX) / 2;
    const geomCY = (geometryBounds.minY + geometryBounds.maxY) / 2;
    const targetX = -geomCX;
    const targetY = -geomCY;
    const nx = clamp(targetX, panLimits.xMin, panLimits.xMax);
    const ny = clamp(targetY, panLimits.yMin, panLimits.yMax);
    setPan(prev => (prev.x === nx && prev.y === ny ? prev : { x: nx, y: ny }));
  }, [geometryBounds, panLimits]);

  // Pointer handlers for pan (left mouse drag)
  const handlePointerDown = React.useCallback((e) => {
    if (e.button !== 0) return; // left button only
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsPanning(true);
    userHasPannedRef.current = true;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      panStartX: pan.x,
      panStartY: pan.y,
    };
  }, [pan.x, pan.y]);

  const handlePointerMove = React.useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    const desiredX = dragRef.current.panStartX + dx;
    const desiredY = dragRef.current.panStartY + dy;
    const clampedX = clamp(desiredX, panLimits.xMin, panLimits.xMax);
    const clampedY = clamp(desiredY, panLimits.yMin, panLimits.yMax);
    setPan(prev => (prev.x === clampedX && prev.y === clampedY ? prev : { x: clampedX, y: clampedY }));
  }, [isPanning, panLimits]);

  const handlePointerUp = React.useCallback((e) => {
    if (!isPanning) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setIsPanning(false);
  }, [isPanning]);

  return (
    <div className="w-full min-h-screen p-6 bg-neutral-50">
      <PageTitle />
      <div className="w-full">
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_320px] gap-6">
        {/* left: controls */}
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl"><Settings2 className="h-5 w-5"/>PARAMETERS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="geom">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="geom">Geometry</TabsTrigger>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="display">Display</TabsTrigger>
              </TabsList>
              <TabsContent value="geom" className="space-y-4">
                {[
                  {
                    k: "width_in",
                    label: "Width",
                    min: unit === "in" ? 1 : 152.4,      // 6 in = 152.4 mm
                    max: unit === "in" ? 36 : 915,       // 36 in = 915 mm
                    step: unit === "in" ? 0.1 : 1,
                  },
                  {
                    k: "thickness_in",
                    label: "Thickness",
                    min: unit === "in" ? 0.5 : 12.7,     // 0.5 in = 12.7 mm
                    max: unit === "in" ? 10 : 254,       // 10 in = 254 mm
                    step: unit === "in" ? 0.05 : 0.5,
                  },
                  {
                    k: "centerHoleDia_in",
                    label: "Center Hole Ø",
                    min: unit === "in" ? 0.25 : 6.35,    // 0.25 in = 6.35 mm
                    max: unit === "in"
                      ? Math.max(0.25, p.width_in * 0.9)
                      : Math.max(6.35, p.width_in * 25.4 * 0.9),
                    step: unit === "in" ? 0.05 : 0.5,
                  },
                  
                ].map(({ k, label, min, max, step }) => {
                  const v = uiVal(p[k]);
                  return (
                    <div key={k} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={k}>{label}</Label>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {unit === "in" ? `${v.toFixed(2)}\"` : `${v.toFixed(1)} mm`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id={k}
                          type="number"
                          step={step}
                          min={min}
                          max={max}
                          value={inputVals[k] ?? ''}
                          onChange={(e) => handleInputChange(k, e.target.value)}
                          onBlur={(e) => handleInputBlur(k, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleInputBlur(k, e.target.value);
                          }}
                        />
                      </div>
                      <Slider
                        value={[v]}
                        min={min}
                        max={max}
                        step={step}
                        onValueChange={(vals) => setParam(k, vals[0])}
                      />
                    </div>
                  );
                })}
                
                {/* Quantity toggle and input */}
                <div className={`flex items-center justify-between ${roboto.className}`}>
                  <Label className="flex items-center gap-2">Show Quantity</Label>
                  <Switch checked={showQty} onCheckedChange={setShowQty}/>
                </div>
                {showQty && (
                  <div className={`space-y-2 ${roboto.className}`}>
                    <div className="flex items-center gap-2">
                      <Input
                        id="quantity_each"
                        type="number"
                        min={0}
                        step={1}
                        placeholder="Enter quantity"
                        value={qty}
                        onChange={(e)=>setQty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2"><CircleDashed className="h-4 w-4"/> Show Welded Steel Pipe</Label>
                    <Switch checked={showPipe} onCheckedChange={setShowPipe}/>
                </div>
                {showPipe && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Schedule</Label>
                      <select
                        className="w-full border rounded-md px-2 py-2 bg-white"
                        value={pipeSchedule}
                        onChange={(e)=>setPipeSchedule(e.target.value)}
                      >
                        {PIPE_SCHEDULES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Pipe Size</Label>
                      <select
                        className="w-full border rounded-md px-2 py-2 bg-white"
                        value={pipeSize}
                        onChange={(e)=>setPipeSize(e.target.value)}
                      >
                        {sizeOptions.map(sz => (
                          <option key={sz} value={sz}>{sz} in</option>
                        ))}
                      </select>
                    </div>
                    {showPipe && selectedPipe && (
                      <div className="text-sm tabular-nums text-muted-foreground">
                        OD: {formatValue({ valueInInches: selectedPipe.od_in, unit, precision })}, 
                        <br />
                        ID: {formatValue({ valueInInches: selectedPipe.id_in, unit, precision })}
                      </div>
                    )}
                  </div>
                )}
                {showPipe && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pipeLength_in">Pipe Length</Label>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {unit === "in" ? `${uiVal(p.pipeLength_in).toFixed(2)}\"` : `${uiVal(p.pipeLength_in).toFixed(1)} mm`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="pipeLength_in"
                        type="number"
                        step={unit === "in" ? 0.1 : 1}
                        min={unit === "in" ? 1 : 25.4}
                        max={unit === "in" ? 36 : 914.4}
                        value={inputVals.pipeLength_in}
                        onChange={(e) => handleInputChange("pipeLength_in", e.target.value)}
                        onBlur={(e) => handleInputBlur("pipeLength_in", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInputBlur("pipeLength_in", e.target.value);
                        }}
                      />
                    </div>
                    <Slider
                      value={[uiVal(p.pipeLength_in)]}
                      min={unit === "in" ? 1 : 25.4}
                      max={unit === "in" ? 36 : 914.4}
                      step={unit === "in" ? 0.1 : 1}
                      onValueChange={(vals) => setParam("pipeLength_in", vals[0])}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between"></div>
              </TabsContent>
                

              <TabsContent value="display" className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Ruler className="h-4 w-4"/> Show Dimensions</Label>
                  <Switch checked={showDims} onCheckedChange={setShowDims}/>
                </div>
                
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Units</Label>
                    <div className="flex gap-2">
                      <Button variant={unit==="in"?"default":"outline"} onClick={()=>setUnit("in")}>in</Button>
                      <Button variant={unit==="mm"?"default":"outline"} onClick={()=>setUnit("mm")}>mm</Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Precision</Label>
                    <Input type="number" min={0} max={4} value={precision}
                      onChange={(e)=>setPrecision(clamp(Number(e.target.value)||0,0,4))}/>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Zoom</Label>
                    <Slider value={[zoom]} min={0.5} max={10} step={0.01} onValueChange={(v)=>setZoom(v[0])}/>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {/* <Button onClick={downloadSVG} className="gap-2"><Download className="h-4 w-4"/>Export SVG</Button>
                  <Button variant="outline" onClick={downloadJSON} className="gap-2"><Download className="h-4 w-4"/>Export JSON</Button> */}
                </div>
              </TabsContent>
              <TabsContent value="materials" className={`space-y-4 ${roboto.className}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">Custom materials text</Label>
                    <Switch checked={useCustomMaterials} onCheckedChange={setUseCustomMaterials}/>
                  </div>
                  {useCustomMaterials ? (
                    <div className="space-y-1">
                      <textarea
                        id="customMaterials"
                        className="w-full min-h-28 border rounded-md px-3 py-2 bg-white text-sm"
                        placeholder='Example:
                          MATERIALS:
                          PLATE: ASTM A572, GRADE 50
                          PIPE: ASTM A53 OR A500
                          UNCOATED'
                        value={customMaterialsText}
                        onChange={(e)=>setCustomMaterialsText(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Plate material</Label>
                          <select
                            className="w-full border rounded-md px-2 py-2 bg-white"
                            value={plateMaterial}
                            onChange={(e)=>setPlateMaterial(e.target.value)}
                          >
                            <option value="">— Select —</option>
                            <option value="ASTM A572, GRADE 50">ASTM A572, GRADE 50</option>
                            <option value="ASTM A709, GRADE 36">ASTM A709, GRADE 36</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Protective coating</Label>
                          <select
                            className="w-full border rounded-md px-2 py-2 bg-white"
                            value={coating}
                            onChange={(e)=>setCoating(e.target.value)}
                          >
                            <option value="">— Select —</option>
                            <option value="UNCOATED">UNCOATED</option>
                            <option value="EPOXY-COATED">EPOXY-COATED</option>
                            <option value="HOT DIP GALVANIZED AFTER FABRICATION">HOT DIP GALVANIZED AFTER FABRICATION</option>
                            <option value="EPOXY-COATED PER ASTM A775">EPOXY-COATED PER ASTM A775</option>
                            <option value="EPOXY-COATED PER ASTM A934">EPOXY-COATED PER ASTM A934</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* center: canvas */}
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">PLATE DETAIL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`mb-3 ${roboto.className}`}>
              <div className="text-xs text-slate-500 font-medium">Description:</div>
              <div className="text-sm text-slate-800">{description}</div>
            </div>
            <div className="w-full overflow-hidden rounded-xl bg-white border">
              <motion.svg
                ref={svgRef}
                width={widthPx}
                height={heightPx}
                viewBox={`${-widthPx/2} ${-heightPx/2} ${widthPx} ${heightPx}`}
                className={`mx-auto block ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{ touchAction: "none" }}
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#0F0E0E" />
                  </marker>
                  <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#44444E" strokeWidth="2" />
                  </pattern>
                </defs>
                <g transform={`translate(${pan.x} ${pan.y})`}>

               
                
                
                {/* Plate - Plan View */}
                <g transform={`translate(${-px(p.width_in)}, 0)`}>
                  {/* plate outline */}
                  <rect
                    x={(-30)}
                    y={px(top)}
                    width={px(p.width_in)}
                    height={px(p.width_in)}
                    fill="transparent"
                    stroke="#0F0E0E"
                    strokeWidth={2}
                  />
                  {/* center hole */}
                  <circle
                    cx={px(p.width_in/2) - 30}
                    cy={0}
                    r={px(p.centerHoleDia_in/2)}
                    fill="#fff"
                    stroke="#0F0E0E"
                    strokeWidth={2}
                  />
                  {/* pipe in plan (OD/ID) */}
                  {showPipe && selectedPipe && (
                    <>
                      <circle
                        cx={px(p.width_in/2) - 30}
                        cy={0}
                        r={px(selectedPipe.od_in/2)}
                        fill="transparent"
                        opacity={0.4}
                        stroke="#0F0E0E"
                        strokeDasharray="4 8"
                        strokeWidth={0.7}
                      />
                      <circle
                        cx={px(p.width_in/2) - 30}
                        cy={0}
                        r={px(selectedPipe.id_in/2)}
                        fill="transparent"
                        opacity={0.4}
                        stroke="#0F0E0E"
                        strokeDasharray="4 8"
                        strokeWidth={0.7}
                      />
                    </>
                  )}
                  <text
                    x={px(p.width_in/2) - 30}
                    y={px(p.width_in / 2) + 30}
                    textAnchor="middle"
                    className="text-xs font-bold fill-black-700 font-sans" // Added font-sans here
                  >
                    PLAN
                  </text>
                </g>

                {/* Plate - Section View */}
                <g transform={`translate(${sectionCenterX}, 0)`}>
                  {/* hatched */}
                  <rect x={px(left)} y={px(top)} width={px(p.thickness_in)} height={px(p.width_in)} fill="url(#hatch)" opacity={0.7} />
                  {/* Plate outline */}
                  <rect x={px(left)} y={px(top)} width={px(p.thickness_in)} height={px(p.width_in)} fill="transparent" stroke="#0F0E0E" strokeWidth={2} />
                  {/* center hole */}
                <rect x={px(-p.thickness_in/2)} y={px(-p.centerHoleDia_in/2)} width={px(p.thickness_in)} height={px(p.centerHoleDia_in)} fill="#ffffff" stroke="#0F0E0E" strokeWidth={2} />
                {/* pipe in section (OD/ID) */}
                {showPipe && selectedPipe && (
                  <>
                    <rect
                      x={px(-p.thickness_in/2 - p.pipeLength_in)}
                      y={px(-selectedPipe.od_in/2)}
                      width={px(p.pipeLength_in)}
                      height={px(selectedPipe.od_in)}
                      fill="url(#hatch)"
                      opacity={0.7}
                      stroke="#0F0E0E"
                      strokeWidth={2}
                    />
                    <rect
                      x={px(-p.thickness_in/2 - p.pipeLength_in)}
                      y={px(-selectedPipe.id_in/2)}
                      width={px(p.pipeLength_in)}
                      height={px(selectedPipe.id_in)}
                      fill="#ffffff"
                      stroke="#0F0E0E"
                      strokeWidth={2}
                    />
                  </>
                )}
                <text
                  x={showPipe && selectedPipe ? px(-p.pipeLength_in / 2) : 0}
                  y={px(p.width_in / 2) + 30}
                  textAnchor="middle"
                  className="text-xs font-bold fill-black-700 font-sans"
                >
                  SECTION
                </text>

                </g>

                
                {/* axes */}
                <line //horizontal reference line
                  x1={-widthPx}
                  y1={0}
                  x2={widthPx}
                  y2={0}
                  stroke="#94a3b8"
                  strokeDasharray="20 6 6 6 20"
                  strokeWidth={.5}
                />
                {/*<line //center reference line
                  x1={0}
                  y1={-heightPx-50}
                  x2={0}
                  y2={heightPx-50}
                  stroke="#53e436ff"
                  strokeDasharray="20 6 6 6 20"
                />*/}
                <line //Left vertical line
                  x1={-px(p.width_in/2) - 30}
                  y1={-heightPx-50}
                  x2={-px(p.width_in/2) - 30}
                  y2={heightPx-50}
                  stroke="#94a3b8"
                  strokeDasharray="20 6 6 6 20"
                  strokeWidth={.5}
                />
                <line //Right vertical line
                  x1={sectionCenterX}
                  y1={-heightPx-50}
                  x2={sectionCenterX}
                  y2={heightPx-50}
                  stroke="#94a3b8"
                  strokeDasharray="20 6 6 6 20"
                  strokeWidth={.5}
                />

                {/* dimensions */}
                {showDims && (
                <>  {/*Section View Dimensions*/}
                  <g transform={`translate(${sectionCenterX}, 0)`}>
                    {/* THICKNESS */}
                    <Dim x1={px(left)} y1={px(top)} x2={px(right)} y2={px(top)} offset={-20} text={`${formatValue({valueInInches:p.thickness_in, unit, precision})}`} />

                    {/* PIPE LENGTH (aligned with THICKNESS dimension line) */}
                    {showPipe && selectedPipe && (
                      <Dim
                        x1={px(-p.thickness_in/2 - p.pipeLength_in)}
                        y1={px(-selectedPipe.od_in/2)}
                        x2={px(-p.thickness_in/2)}
                        y2={px(-selectedPipe.od_in/2)}
                        offset={px(top) - 20 - px(-selectedPipe.od_in/2)}
                        text={`${unit === "in" ? inchesToEngineeringStr(p.pipeLength_in, precision) : formatValue({ valueInInches: p.pipeLength_in, unit, precision })}`}
                        textPos="above"
                      />
                    )}



                    {/* CENTER HOLE */}
                    
                    <Dim 
                    x1={px(right)} 
                    y1={px(-p.centerHoleDia_in/2)} 
                    x2={px(right)} 
                    y2={px(p.centerHoleDia_in/2)} 
                    offset={-20} 
                    text={`⌀${formatValue({valueInInches:p.centerHoleDia_in, unit, precision})}`} 
                    rotate={-90} 
                    textPos="below" />
                    
                  </g>
                    {/*Plan View Dimensions*/}
                  <g transform={`translate(${-px(p.width_in)}, 0)`}>

                    {/* WIDTH Vertical */}
                    <Dim 
                    x1={dimOffset}
                    y1={px(-p.width_in/2)} 
                    x2={dimOffset}
                    y2={px(p.width_in/2)} 
                    offset={20} 
                    text={`${unit === "in"? inchesToEngineeringStr(p.width_in, precision): formatValue({ valueInInches: p.width_in, unit, precision })}`} 
                    rotate={-90} 
                    />    

                    {/* WIDTH Horizontal*/}
                    <Dim 
                    x1={-30} 
                    y1={px(top)} 
                    x2={-30 + px(p.width_in)} 
                    y2={px(top)} 
                    offset={-20} 
                    text={`${unit === "in"? inchesToEngineeringStr(p.width_in, precision): formatValue({ valueInInches: p.width_in, unit, precision })}`} />
                  </g>
                </>

                  

                )}
                </g>
              </motion.svg>
            </div>
            {/* Below-canvas quantity/materials text */}
            <div className={`mt-4 text-left ${roboto.className}`}>
              {showQty && (
                <pre className="whitespace-pre-wrap text-xs text-slate-800 mb-2">{`QUANTITY:
${(qty ?? "").toString()} EACH`}</pre>
              )}
              {materialsLines.length > 0 && (
                <pre className="whitespace-pre-wrap text-xs text-slate-800">
                  {materialsLines.join("\n")}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>

        {/* right: properties */}
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">PROPERTIES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <h4 className="font-semibold text-slate-700 mb-2">Plate</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { k: "width_in", label: "Width" },
                { k: "thickness_in", label: "Thickness" },
                { k: "centerHoleDia_in", label: "Center Hole Ø" },
                
              ].map(({ k, label }) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="tabular-nums text-slate-600">
                    {formatValue({ valueInInches: p[k], unit, precision })}
                  </span>
                </div>
              ))}
            </div>
            

            {showPipe && selectedPipe && (
              <>
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Pipe</h4>
                </div>
                
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  
                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="font-semibold">{selectedPipe.size}&quot; { }
                      {selectedPipe.schedule.toUpperCase()} STEEL PIPE</div>
                    <div>O.D. = {formatValue({ valueInInches: selectedPipe.od_in, unit, precision })}</div>
                    <div>I.D. = {formatValue({ valueInInches: selectedPipe.id_in, unit, precision })}</div>
                    <div>L = {formatValue({ valueInInches: params.pipeLength_in || 6, unit, precision })}</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
            
        </Card>
      </div>
      </div>
    <Analytics/>

    </div>
    
      
  );
}
